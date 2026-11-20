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

test('signing up sends one email: code, dashboard, 5 opportunities and 5 ways to save', async () => {
  const r = await call('POST', '/enquiry', { role: 'host', phone: '+91 98765 43210', name: 'Divya', email: 'mint@example.com', business: 'Mint Masala', business_type_id: 1, location: 'Sadashivanagar, Bengaluru', termsAccepted: true });
  assert.equal(r.status, 201);
  const user = await User.findOne({ email: 'mint@example.com' });
  assert.match(user.leadId, /^PMB-[A-Z]{3}\d{2}-\d{2,}$/);
  const lead = await Lead.findOne({ leadId: user.leadId });
  assert.ok(lead, 'the CRM lead has the same ID');

  const toLead = sent.filter(m => m.to === 'mint@example.com');
  assert.equal(toLead.length, 1, 'exactly one email to the lead');
  const mail = toLead[0];
  assert.ok(!mail.subject.includes(user.leadId) && !mail.html.includes(user.leadId), 'the lead ID never goes to the lead');
  assert.match(mail.html, /letter-spacing:8px[^>]*>\d{6}</, 'has the code');
  assert.match(mail.html, /activate\?token=[a-f0-9]{64}/, 'has the one-tap dashboard button');
  // Pitched, not a recipe: what it takes and that PMB does it, never the internal how-to notes
  // Five different ways to earn, not five versions of renting out the same hours
  for (const part of ['Rent out your space when it is empty', 'Let brands advertise in your place', 'Sell more to the customers you already have', 'Get big orders from companies', 'Earn from sending customers to partners', 'You just say yes'])
    assert.ok(mail.html.includes(part), `email pitches: ${part}`);
  assert.ok(!mail.html.includes('Milk, vegetables and staples straight from farms'), 'no do-it-yourself steps');
  for (const w of ['Partner we bring', 'With PMB:', 'Alone:']) assert.ok(!mail.html.includes(w), `no repeated "${w}" lines`);
  for (const part of ['5 ways to earn more', 'cloud kitchen in morning hours', '5 ways to save', 'Buy direct from farmers', 'My CTA'])
    assert.ok(mail.html.includes(part), `email has: ${part}`);

  // The team gets everything, even though no opportunity was picked
  const team = sent.find(m => m.to === 'info@partnermybusiness.ai' && m.subject.includes(user.leadId));
  assert.ok(team, 'team email carries the lead ID');
  for (const part of [user.leadId, 'No specific opportunity picked', '98765 43210', 'Mint Masala', 'Open this lead in the PMB team dashboard'])
    assert.ok(team.html.includes(part), `team email has: ${part}`);
  assert.ok(!team.html.includes('5 ways to save'), 'the team copy has the details only, not the plan we emailed');
  assert.ok(!/activate\?token=/.test(team.html), 'the team copy never contains the lead’s own sign-in link');

  // A second sign-up the same month gets the next number, and what they asked about reaches the team
  await call('POST', '/enquiry', { role: 'host', phone: '+91 98765 43210', name: 'Ravi', email: 'ravi@example.com', business: 'Ravi Cafe', business_type_id: 3, location: 'Indiranagar', termsAccepted: true, message: "I'd like to know more about: Paid coworking seats 11 AM–4 PM" });
  const second = await User.findOne({ email: 'ravi@example.com' });
  assert.equal(Number(second.leadId.split('-')[2]), Number(user.leadId.split('-')[2]) + 1);
  const team2 = sent.find(m => m.to === 'info@partnermybusiness.ai' && m.subject.includes(second.leadId));
  assert.match(team2.html, /Enquired about[\s\S]*Paid coworking seats 11 AM–4 PM/);
});

test('signing up on the sign-up page also sends one email, and tells the team', async () => {
  sent.length = 0;
  const r = await call('POST', '/auth/signup', { role: 'business', name: 'Sana', email: 'sana@example.com', phone: '+91 91234 56789', businessName: 'Sana Salon', category: 'salon', location: 'Jayanagar', termsAccepted: true });
  assert.equal(r.status, 201);
  const user = await User.findOne({ email: 'sana@example.com' });
  const toLead = sent.filter(m => m.to === 'sana@example.com');
  assert.equal(toLead.length, 1, 'one email');
  assert.match(toLead[0].html, /5 ways to save/);
  assert.ok(!toLead[0].html.includes(user.leadId) && !toLead[0].subject.includes(user.leadId));
  const team = sent.find(m => m.to === 'info@partnermybusiness.ai');
  assert.ok(team && team.subject.includes(user.leadId) && /New sign-up/.test(team.subject));
  assert.equal((await call('POST', '/auth/signup', { role: 'business', name: 'NoPhone', email: 'np@example.com', businessName: 'X', category: 'salon', location: 'Jayanagar', termsAccepted: true })).status, 400, 'phone is required');
});

test('anyone can preview the CTA for a business type before agreeing', async () => {
  const r = await call('GET', '/public/cta-preview?sector=3&name=smoor&area=RR%20Nagar');
  assert.equal(r.status, 200);
  assert.match(r.body.html, /smoor/);
  assert.match(r.body.html, /RR Nagar/);
  assert.match(r.body.html, /Policies you agree to/);
  assert.doesNotMatch(r.body.html, /Revenue opportunities|Feasibility/);
  assert.equal((await call('GET', '/public/cta-preview')).status, 400, 'needs a business type');
  const pb = await call('GET', '/public/playbook/1');
  assert.ok(pb.body.images.length > 0 && pb.body.savings.levers.length === 5);
});

test('the dashboard shows their own CTA and agreement, never the lead ID', async () => {
  const user = await User.findOne({ email: 'mint@example.com' });
  const mail = sent.find(m => m.to === 'mint@example.com') || null;
  const token = mail ? /token=([a-f0-9]{64})/.exec(mail.html)?.[1] : null;
  let cookie;
  if (token) cookie = (await call('POST', '/auth/activate', { token })).cookie;
  else {
    sent.length = 0;
    await call('POST', '/auth/request-otp', { email: 'mint@example.com' });
    const code = /letter-spacing:8px[^>]*>(\d{6})</.exec(sent[0].html)[1];
    cookie = (await call('POST', '/auth/verify-otp', { email: 'mint@example.com', code })).cookie;
  }
  const r = await call('GET', '/growth/my-cta', null, cookie);
  assert.equal(r.body.leadId, undefined, 'lead IDs are for the PMB team only');
  assert.ok(!JSON.stringify(r.body).includes(user.leadId), 'the lead ID is nowhere in the dashboard data');
  assert.ok(r.body.agreed, 'records the agreement');
  assert.match(r.body.html, /Agreed\./);
  assert.match(r.body.html, /Policies you agree to/);
});

test('earlier sign-ups get lead IDs from the month they joined', async () => {
  const { backfillLeadIds } = require('../utils/leadId');
  const old = await User.create({ role: 'business', name: 'Old', email: 'old@example.com', status: 'approved', sectorId: 1, createdAt: '2026-10-05T10:00:00.000Z' });
  await User.findByIdAndUpdate(old._id, { createdAt: '2026-10-05T10:00:00.000Z' });
  assert.ok(await backfillLeadIds() >= 1);
  assert.match((await User.findById(old._id)).leadId, /^PMB-OCT26-\d{2}$/);
  assert.equal(await backfillLeadIds(), 0, 'only once');
});

test('a sign-up with an unknown business type still sees its CTA and savings', async () => {
  sent.length = 0;
  const r = await call('POST', '/auth/signup', { role: 'business', name: 'Vg', email: 'vg.other@example.com', phone: '+91 91234 56780', businessName: 'vg', category: 'other', location: 'Malleshwaram', termsAccepted: true });
  assert.equal(r.status, 201);
  const code = /letter-spacing:8px[^>]*>(\d{6})</.exec(sent.find(m => m.to === 'vg.other@example.com').html)[1];
  const { cookie } = await call('POST', '/auth/verify-otp', { email: 'vg.other@example.com', code });
  const d = (await call('GET', '/growth/my-cta', null, cookie)).body;
  assert.match(d.html, /Policies you agree to/);
  assert.ok(d.savings && d.savings.levers.length === 5, 'savings show');
  assert.equal(d.ways.length, 5, 'the 5 ways to earn show');
});
