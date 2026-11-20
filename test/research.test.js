// Per-business research: a sign-up's own business is looked up (Claude + web search) and its own 5 ways to
// earn and 5 ways to save go into the sign-up email and the dashboard. A stand-in Claude server answers here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pmb-research-'));
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key';

const mailer = require('../utils/mailer');
const sent = [];
mailer.sendMail = async m => { sent.push(m); return { sent: true }; };

const ANSWER = {
  found: true,
  about: 'Mint Masala is a busy South Indian cafe on Sampige Road known for filter coffee and dosas.',
  busyHours: 'Mornings 7–11 AM and weekend evenings',
  quietHours: 'Weekday afternoons 2–5 PM',
  ways: {
    space: { line: 'Host small book clubs and study groups in the quiet afternoons.', examples: ['college study groups', 'weekday book club'], estMonthly: 18000 },
    ads: { line: 'Coffee and snack brands pay to sample in your cafe.', examples: ['filter coffee brand sampling'], estMonthly: 8000 },
    sell: { line: 'Sell your filter coffee powder and podi in packs.', examples: ['filter coffee powder', 'chutney podi'], estMonthly: 25000 },
    companies: { line: 'Breakfast orders for offices near Malleshwaram.', examples: ['office breakfast boxes'], estMonthly: 40000 },
    referrals: { line: 'Send customers to nearby sweet shops and earn a share.', examples: [], estMonthly: 5000 }
  },
  savings: [
    { title: 'Buy milk straight from a dairy', saving: '8–12% on milk' },
    { title: 'Buy coffee beans from an estate', saving: '10–15% on coffee' },
    { title: 'Share delivery riders', saving: '15–20% on delivery' },
    { title: 'Cheaper gas in bulk', saving: '5–8% on gas' },
    { title: 'Less waste by planning batter', saving: '10% on food waste' }
  ]
};
let claudeCalls = 0, lastBody = null;
const claude = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    claudeCalls++; lastBody = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Here it is:\n' + JSON.stringify(ANSWER) }], usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});

const express = require('express');
const cookieParser = require('cookie-parser');
const { initialize } = require('../utils/jsonModel');
const User = require('../models/User');

let base, server;
async function call(method, url, body, cookie) {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

test.before(async () => {
  await new Promise(r => claude.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${claude.address().port}`;
  initialize();
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  for (const r of ['auth', 'growth']) app.use(`/api/${r}`, require(`../routes/${r}`));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => { server?.close(); claude.close(); });

test('a cafe signing up gets its own 5 ways to earn and save, in the email and the dashboard', async () => {
  const r = await call('POST', '/auth/signup', { role: 'business', name: 'Divya', email: 'mint@example.com', phone: '9876543210',
    businessName: 'Mint Masala', category: 'cafe', location: 'Malleshwaram', termsAccepted: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(claudeCalls, 1, 'looked the business up once');
  const prompt = lastBody.messages[0].content;
  assert.match(prompt, /Mint Masala/); assert.match(prompt, /malleshwaram/i);
  assert.ok(lastBody.tools.some(t => t.type === 'web_search_20260209'), 'searches the web');
  assert.ok(!prompt.includes('mint@example.com') && !prompt.includes('9876543210'), 'no personal contact details sent');

  const user = await User.findOne({ email: 'mint@example.com' });
  assert.equal(user.research.quietHours, 'Weekday afternoons 2–5 PM');

  const mail = sent.find(m => m.to === 'mint@example.com');
  assert.match(mail.html, /What we found about you/);
  assert.match(mail.html, /Sampige Road/);
  assert.match(mail.html, /filter coffee powder and podi/);
  assert.match(mail.html, /Buy coffee beans from an estate/);
  assert.match(mail.html, /₹40,000 a month/);

  // Dashboard: sign in and load My CTA
  const code = mail.html.match(/letter-spacing:8px[^>]*>(\d{6})</)[1];
  const v = await call('POST', '/auth/verify-otp', { email: 'mint@example.com', code });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const dash = await call('GET', '/growth/my-cta', null, v.cookie);
  assert.equal(dash.status, 200);
  assert.match(dash.body.about.text, /Sampige Road/);
  assert.equal(dash.body.ways.length, 5);
  assert.equal(dash.body.ways[2].line, 'Sell your filter coffee powder and podi in packs.');
  assert.equal(dash.body.savings.levers[1].title, 'Buy coffee beans from an estate');
});

test('without a Claude key, or if the lookup fails, the general plan is used', async () => {
  const { normalise, parseJson } = require('../utils/research');
  assert.throws(() => normalise({ ways: {}, savings: [] }, false), /missing/);
  assert.deepEqual(parseJson('text {"a":1} more'), { a: 1 });
  const { planFor } = require('../utils/cta');
  const plan = planFor({ role: 'business', category: 'cafe', location: 'malleshwaram' });
  assert.equal(plan.researched, false);
  assert.equal(plan.ways.length, 5);
});
