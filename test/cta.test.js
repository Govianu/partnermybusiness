// The CTA: lead IDs, the CTA email at sign-up, the preview before agreeing and the dashboard copy
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pmb-cta-'));
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const mailer = require('../utils/mailer');
const sent = [];
mailer.sendMail = async m => { sent.push(m); return { sent: true }; };

const express = require('express');
const cookieParser = require('cookie-parser');
const { initialize } = require('../utils/jsonModel');
const { prefixFor } = require('../utils/leadId');
const User = require('../models/User');
const Lead = require('../models/Lead');

let base, server;
async function call(method, url, body, cookie) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

test.before(async () => {
  initialize();
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  for (const r of ['auth', 'enquiry', 'public', 'growth']) app.use(`/api/${r}`, require(`../routes/${r}`));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server?.close());

test('lead IDs look like PMB-NOV26-01 and count up within the month', () => {
  assert.equal(prefixFor(new Date('2026-11-20T10:00:00+05:30')), 'PMB-NOV26-');
  assert.equal(prefixFor(new Date('2026-11-30T19:00:00Z')), 'PMB-DEC26-', 'months follow India time');
});

test('signing up gives a lead ID and sends the CTA with feasibility, revenue, cost saving and terms', async () => {
  const r = await call('POST', '/enquiry', { role: 'host', name: 'Divya', email: 'mint@example.com', business: 'Mint Masala', business_type_id: 1, location: 'Sadashivanagar, Bengaluru', termsAccepted: true });
  assert.equal(r.status, 201);
  const user = await User.findOne({ email: 'mint@example.com' });
  assert.match(user.leadId, /^PMB-[A-Z]{3}\d{2}-\d{2,}$/);
  const lead = await Lead.findOne({ leadId: user.leadId });
  assert.ok(lead, 'the CRM lead has the same ID');

  const ctaMail = sent.find(m => m.to === 'mint@example.com' && /^Your CTA/.test(m.subject));
  assert.ok(ctaMail, 'CTA email sent');
  assert.match(ctaMail.subject, new RegExp(user.leadId));
  for (const part of ['Feasibility summary', 'Revenue opportunities', 'Cost saving', 'Cloud kitchen in morning hours', 'Buy direct from farmers', 'Terms you agreed to'])
    assert.ok(ctaMail.html.includes(part), `CTA email has: ${part}`);
  assert.match(ctaMail.html, /activate\.html\?next=business\.html%23cta&amp;token=/, 'button opens the CTA in the dashboard');
  const team = sent.find(m => m.to === 'info@partnermybusiness.ai' && m.subject.includes(user.leadId));
  assert.ok(team, 'team email carries the lead ID');

  // A second sign-up the same month gets the next number
  await call('POST', '/enquiry', { role: 'host', name: 'Ravi', email: 'ravi@example.com', business: 'Ravi Cafe', business_type_id: 3, location: 'Indiranagar', termsAccepted: true });
  const second = await User.findOne({ email: 'ravi@example.com' });
  assert.equal(Number(second.leadId.split('-')[2]), Number(user.leadId.split('-')[2]) + 1);
});

test('anyone can preview the CTA for a business type before agreeing', async () => {
  const r = await call('GET', '/public/cta-preview?sector=3&name=smoor&area=RR%20Nagar');
  assert.equal(r.status, 200);
  assert.match(r.body.html, /smoor/);
  assert.match(r.body.html, /RR Nagar/);
  assert.match(r.body.html, /Commercial terms you agree to/);
  assert.equal((await call('GET', '/public/cta-preview')).status, 400, 'needs a business type');
  const pb = await call('GET', '/public/playbook/1');
  assert.ok(pb.body.images.length > 0 && pb.body.savings.levers.length === 5);
});

test('the dashboard shows their own CTA with lead ID and agreement', async () => {
  const user = await User.findOne({ email: 'mint@example.com' });
  const ctaMail = sent.find(m => m.to === 'mint@example.com' && /^Your CTA/.test(m.subject));
  const token = /token=([a-f0-9]{64})/.exec(ctaMail.html)[1];
  const signedIn = await call('POST', '/auth/activate', { token });
  assert.equal(signedIn.status, 200);
  const r = await call('GET', '/growth/my-cta', null, signedIn.cookie);
  assert.equal(r.body.leadId, user.leadId);
  assert.ok(r.body.agreed, 'records the agreement');
  assert.match(r.body.html, /Agreed\./);
  assert.equal(r.body.savings.levers.length, 5);
  // The welcome email's own button still works after the CTA one was used
  const welcome = sent.find(m => m.to === 'mint@example.com' && !/^Your CTA/.test(m.subject));
  const t2 = /token=([a-f0-9]{64})/.exec(welcome.html)[1];
  assert.equal((await call('POST', '/auth/activate', { token: t2 })).status, 200);
});

test('earlier sign-ups get lead IDs from the month they joined', async () => {
  const { backfillLeadIds } = require('../utils/leadId');
  const old = await User.create({ role: 'business', name: 'Old', email: 'old@example.com', status: 'approved', sectorId: 1, createdAt: '2026-10-05T10:00:00.000Z' });
  await User.findByIdAndUpdate(old._id, { createdAt: '2026-10-05T10:00:00.000Z' });
  assert.ok(await backfillLeadIds() >= 1);
  assert.match((await User.findById(old._id)).leadId, /^PMB-OCT26-\d{2}$/);
  assert.equal(await backfillLeadIds(), 0, 'only once');
});
