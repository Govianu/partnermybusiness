// One email, several dashboards: each homepage enquiry or sign-up for a different business gets its own dashboard,
// and each code opens the dashboard it was sent for (not just the first one on that email).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pmb-multi-'));
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

// Capture emails: read the code from each one
const mailer = require('../utils/mailer');
const sent = [];
mailer.sendMail = async m => { sent.push(m); return { sent: true }; };
const codeIn = m => /letter-spacing:8px[^>]*>(\d{6})</.exec(m.html)[1];

const express = require('express');
const cookieParser = require('cookie-parser');
const { initialize } = require('../utils/jsonModel');

let base, server;
async function call(method, url, body, cookie) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
const EMAIL = 'owner.multi@example.com';
const enquire = business => call('POST', '/enquiry', { role: 'host', name: 'Divyaj', email: EMAIL, business, business_type_id: 3, location: 'RR Nagar, Bengaluru', termsAccepted: true });

test.before(async () => {
  initialize();
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/enquiry', require('../routes/enquiry'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server?.close());

test('a second business on the same email gets its own dashboard, and its code opens it', async () => {
  const first = await enquire('coffe katte');
  const second = await enquire('smoor');
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(String(first.body.profileId), String(second.body.profileId), 'two dashboards');

  const welcome = sent.filter(m => m.to === EMAIL && /smoor/.test(m.html) && !/^Your CTA/.test(m.subject)).at(-1);
  assert.match(welcome.html, /Open the smoor dashboard/);
  assert.match(welcome.html, /activate\.html\?token=[a-f0-9]{64}/, 'button signs in to this dashboard');

  // The smoor code opens smoor, even though coffe katte is older and has its own live code
  const smoor = await call('POST', '/auth/verify-otp', { email: EMAIL, code: codeIn(welcome) });
  assert.equal(smoor.status, 200);
  assert.equal(smoor.body.user.business.businessName, 'smoor');

  // The coffe katte code still opens coffe katte
  const katteMail = sent.filter(m => m.to === EMAIL && /coffe katte/.test(m.html) && !/^Your CTA/.test(m.subject)).at(-1);
  const katte = await call('POST', '/auth/verify-otp', { email: EMAIL, code: codeIn(katteMail) });
  assert.equal(katte.body.user.business.businessName, 'coffe katte');

  // Switch dashboard lists both, and switches
  const list = await call('GET', '/auth/profiles', null, katte.cookie);
  assert.deepEqual(list.body.profiles.map(p => p.label.split(' — ')[0]).sort(), ['coffe katte', 'smoor']);
  const sw = await call('POST', '/auth/switch-profile', { profileId: second.body.profileId }, katte.cookie);
  assert.equal(sw.body.user.business.businessName, 'smoor');
});

test('asking for a code for one dashboard sends it for that dashboard only', async () => {
  const profiles = (await call('GET', '/auth/profiles', null, (await call('POST', '/auth/verify-otp', { email: EMAIL, code: '000000' })).cookie)).body;
  assert.ok(!profiles.profiles, 'a wrong code signs nobody in');

  const smoorId = (await enquire('smoor')).body.profileId;   // same business again: reuses the smoor dashboard
  sent.length = 0;
  await call('POST', '/auth/request-otp', { email: EMAIL, profileId: smoorId });
  assert.match(sent[0].subject, /: smoor$/);
  const r = await call('POST', '/auth/verify-otp', { email: EMAIL, code: codeIn(sent[0]) });
  assert.equal(r.body.user.business.businessName, 'smoor');
});

test('the sign-up form allows a new business on an email that has one, but not the same business twice', async () => {
  const body = name => ({ role: 'business', name: 'Divyaj', email: EMAIL, businessName: name, category: 'cafe', location: 'RR Nagar', termsAccepted: true });
  const third = await call('POST', '/auth/signup', body('Third Wave Kiosk'));
  assert.equal(third.status, 201);
  assert.ok(third.body.profileId);
  // smoor exists and is verified: refused with its name
  const again = await call('POST', '/auth/signup', body('Smoor'));
  assert.equal(again.status, 409);
  assert.match(again.body.error, /smoor/);
});

test('the email button signs in to its own dashboard in one step, once', async () => {
  const linkIn = m => /href="([^"]*activate\.html\?token=[a-f0-9]{64})"/.exec(m.html)?.[1]?.replace(/&amp;/g, '&');
  sent.length = 0;
  const r = await call('POST', '/enquiry', { role: 'host', name: 'Divyaj', email: 'one.tap@example.com', business: 'smoor', business_type_id: 3, location: 'RR Nagar', termsAccepted: true });
  assert.equal(r.status, 201);
  const welcome = sent.find(m => m.to === 'one.tap@example.com');
  const link = linkIn(welcome);
  assert.ok(link, 'welcome email has a one-tap sign-in button');
  assert.match(welcome.html, /Open the smoor dashboard/);
  const token = new URL(link).searchParams.get('token');

  const opened = await call('POST', '/auth/activate', { token });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.user.business.businessName, 'smoor');
  assert.ok(opened.cookie.startsWith('pmb_token='), 'signed in');
  assert.equal((await call('POST', '/auth/activate', { token })).status, 410, 'works once');

  // Code emails from the login page carry a button too, for the dashboard they name
  sent.length = 0;
  await call('POST', '/auth/request-otp', { email: 'one.tap@example.com' });
  const again = await call('POST', '/auth/activate', { token: new URL(linkIn(sent[0])).searchParams.get('token') });
  assert.equal(again.body.user.business.businessName, 'smoor');
});
