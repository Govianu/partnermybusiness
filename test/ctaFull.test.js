// The detailed CTA in the dashboard: Deal Sheet, terms, and acceptance with separate tick-boxes and a record
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pmb-ctafull-'));
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const mailer = require('../utils/mailer');
const sent = [];
mailer.sendMail = async m => { sent.push(m); return { sent: true }; };

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { initialize } = require('../utils/jsonModel');
const User = require('../models/User');
const { CONSENTS, CTA_VERSION } = require('../utils/ctaFull');

let base, server;
async function call(method, url, user, body) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', 'user-agent': 'test-agent',
    authorization: `Bearer ${jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET)}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

test.before(async () => {
  initialize();
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  app.use('/api/growth', require('../routes/growth'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server?.close());

test('the dashboard CTA has a Deal Sheet, 14 sections and a form that needs every required box', async () => {
  const u = await User.create({ role: 'business', name: 'Divya Rao', email: 'mint@example.com', status: 'approved', category: 'cafe', location: 'malleshwaram', business: { businessName: 'Mint Masala' } });
  const d = await call('GET', '/growth/my-cta', u);
  assert.equal(d.body.full.version, CTA_VERSION);
  assert.equal(d.body.full.sections.length, 14);
  assert.ok(d.body.full.dealSheet.some(([k]) => k === 'When you are paid'));
  assert.equal(d.body.full.accepted, null);

  const all = Object.fromEntries(CONSENTS.map(c => [c.id, c.required]));
  const short = await call('POST', '/growth/cta/accept', u, { version: CTA_VERSION, agreeAll: false, name: 'Divya Rao' });
  assert.equal(short.status, 400); assert.match(short.body.error, /Tick "I agree"/);
  assert.equal((await call('POST', '/growth/cta/accept', u, { version: 'old', consents: all, name: 'Divya Rao' })).status, 409);

  const ok = await call('POST', '/growth/cta/accept', u, { version: CTA_VERSION, agreeAll: true, consents: { marketing: true }, name: 'Divya Rao', designation: 'Owner' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.full.accepted.name, 'Divya Rao');
  const saved = await User.findById(u._id);
  const a = saved.ctaAcceptance;
  assert.equal(a.userAgent, 'test-agent'); assert.ok(a.ip); assert.match(a.termsHash, /^[a-f0-9]{64}$/); assert.match(a.atIST, /IST$/);
  assert.equal(a.consents.find(c => c.id === 'marketing').value, true);
  assert.ok(a.consents.filter(c => c.required).every(c => c.value), 'one "I agree" box records every point as agreed');
  assert.equal(a.consents.find(c => c.id === 'filming').value, false);
  assert.equal(saved.toJSON().ctaAcceptance, undefined, 'the signature record (IP, device) never goes out with the account');
  assert.ok(sent.some(m => m.to === 'mint@example.com' && /Your Partnermybusiness CTA/.test(m.subject) && /Your Deal Sheet/.test(m.html)), 'a copy is emailed');

  const off = await call('POST', '/growth/cta/optional', u, { id: 'marketing', value: false });
  assert.equal(off.body.full.accepted.optional.find(o => o.id === 'marketing').value, false, 'optional choices can be changed later');
  assert.equal((await call('POST', '/growth/cta/optional', u, { id: 'terms', value: false })).status, 404, 'required ones cannot be untoggled');
});
