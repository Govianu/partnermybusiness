// Business-opportunity emails after sign-up (utils/drip.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pmb-drip-'));
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.DRIP_INTERVAL_DAYS = '3';

const mailer = require('../utils/mailer');
const sent = [];
mailer.sendMail = async m => { sent.push(m); return { sent: true }; };

const express = require('express');
const cookieParser = require('cookie-parser');
const { initialize } = require('../utils/jsonModel');
const User = require('../models/User');
const drip = require('../utils/drip');
const DAY = 24 * 60 * 60 * 1000;

let base, server;
const call = (method, url, body) => fetch(base + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  .then(async r => ({ status: r.status, text: await r.text() }));

test.before(async () => {
  initialize();
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  app.use('/api/enquiry', require('../routes/enquiry'));
  app.use('/api/public', require('../routes/public'));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server?.close());

test('a new café gets ten emails, revenue and cost saving in turn, three days apart, then stops', async () => {
  const r = await call('POST', '/enquiry', { role: 'host', phone: '+91 98765 43210', name: 'Divya', email: 'smoor.drip@example.com', business: 'smoor', business_type_id: 3, location: 'RR Nagar', termsAccepted: true });
  assert.equal(r.status, 201);
  const user = await User.findOne({ email: 'smoor.drip@example.com' });
  assert.equal(user.drip.step, 0);
  const start = new Date(user.drip.startedAt).getTime();

  sent.length = 0;
  assert.equal((await drip.sendDue({ now: new Date(start + DAY), force: true })).sent, 0, 'nothing before 3 days');

  const subjects = [];
  for (let i = 1; i <= 11; i++) {
    sent.length = 0;
    await drip.sendDue({ now: new Date(start + i * 3 * DAY + 1000), force: true });
    if (sent[0]) subjects.push(sent[0].subject);
    if (i === 1) {
      const m = sent[0];
      assert.equal(m.to, 'smoor.drip@example.com');
      assert.match(m.html, /paid coworking seats/i, 'uses the team research for this café type');
      assert.match(m.html, /\/api\/public\/media\/[\w-]+\?w=1000/, 'shows the matching creative, served by our own server');
      assert.match(m.html, /activate\.html\?next=business\.html%23learn&amp;token=[a-f0-9]{64}/, 'one-tap button into the dashboard');
      assert.match(m.headers['List-Unsubscribe'], /\/api\/public\/unsubscribe\?u=/);
      assert.equal(m.replyTo, 'info@partnermybusiness.ai');
    }
  }
  assert.equal(subjects.length, 10, 'exactly ten emails');
  assert.equal(new Set(subjects).size, 10, 'ten different emails');
  assert.match(subjects[1], /^Save /, 'the second is about cost saving');
  assert.match(subjects[0], /smoor/);
});

test('the unsubscribe link asks first, then stops the emails', async () => {
  await call('POST', '/enquiry', { role: 'host', phone: '+91 98765 43210', name: 'Ravi', email: 'stop.me@example.com', business: 'Ravi Cafe', business_type_id: 3, location: 'Indiranagar', termsAccepted: true });
  const user = await User.findOne({ email: 'stop.me@example.com' });
  const url = new URL(drip.unsubscribeUrl(user));
  const q = url.search;

  const page = await call('GET', `/public/unsubscribe${q}`);
  assert.match(page.text, /Stop these emails/);
  assert.ok(!(await User.findById(user._id)).emailOptOut, 'opening the link alone does not unsubscribe');

  await call('POST', `/public/unsubscribe${q}`);
  assert.equal((await User.findById(user._id)).emailOptOut, true);
  sent.length = 0;
  await drip.sendDue({ now: new Date(Date.now() + 30 * DAY), force: true });
  assert.ok(!sent.some(m => m.to === 'stop.me@example.com'), 'no more emails');

  assert.equal((await call('POST', `/public/unsubscribe?u=${user._id}&t=wrong`)).status, 400, 'a forged link does nothing');
});

test('existing partners can be added to the emails once', async () => {
  await User.create({ role: 'business', name: 'Old Partner', email: 'old@example.com', sectorId: 1, status: 'approved', business: { businessName: 'Old Diner' } });
  assert.equal(await drip.enrollExisting(), 1);
  assert.equal(await drip.enrollExisting(), 0, 'not twice');
  sent.length = 0;
  await drip.sendDue({ now: new Date(Date.now() + 60 * 1000), force: true });
  assert.ok(sent.some(m => m.to === 'old@example.com'), 'first email goes out straight away');
});
