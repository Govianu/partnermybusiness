// Business-opportunity emails after sign-up: five emails, a few days apart, each about one way this exact
// business type or profession can earn (from utils/catalog.json). People forget dashboards; these bring them back.
//
//   1. Services they could add          2. Products they could sell       3. Who they could team up with
//   4. Space and quiet hours            5. "Shall we set this up?" with a call to action
//
// Every email has a one-tap button into their dashboard, replies go to the team inbox, and a one-click
// unsubscribe (also as a List-Unsubscribe header, which Gmail and Yahoo expect from regular senders).
// Settings: DRIP_INTERVAL_DAYS (default 3), DRIP_ENABLED (default on), DRIP_MAX_PER_RUN (default 40).
const crypto = require('crypto');
const User = require('../models/User');
const { sectorById, sectorFor, listOf, plural, withArticle } = require('./catalog');
const { sendMail } = require('./mailer');
const { issueLink } = require('./links');
const { layout, p, button, esc, inr, firstName, APP_URL, TEAM_INBOX, PHONE } = require('./emails');

const STEPS = 5;
const DAY = 24 * 60 * 60 * 1000;
const intervalMs = () => (Number(process.env.DRIP_INTERVAL_DAYS) || 3) * DAY;
const enabled = () => !/^(0|false|no|off)$/i.test(process.env.DRIP_ENABLED || '');
const ROLES = ['business', 'associate'];

// ---------- Unsubscribe links (signed, so nobody can unsubscribe someone else) ----------
const sign = id => crypto.createHmac('sha256', String(process.env.JWT_SECRET || 'pmb')).update(`unsubscribe:${id}`).digest('hex').slice(0, 32);
const validUnsubscribe = (id, token) => {
  const want = Buffer.from(sign(id)), got = Buffer.from(String(token || ''));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
};
const unsubscribeUrl = user => `${APP_URL()}/api/public/unsubscribe?u=${encodeURIComponent(user._id)}&t=${sign(user._id)}`;

// ---------- Who gets them ----------
function enroll(user, startAt = Date.now()) {
  if (!ROLES.includes(user.role) || !user.email || user.emailOptOut) return false;
  if (user.drip?.startedAt) return false;
  user.drip = { step: 0, startedAt: new Date(startAt).toISOString(), nextAt: new Date(startAt + intervalMs()).toISOString() };
  return true;
}

// ---------- The emails ----------
const li = items => `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.7;color:#0F1B3D">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const lower = s => String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1);

function contentFor(user, step, sector) {
  const isPro = sector.t === 'p';
  const noun = sector.noun;
  const nouns = plural(noun);
  const name = isPro ? '' : (user.business?.businessName || '');
  const you = isPro ? `you, as ${withArticle(noun)}` : (name || `your ${noun}`);
  const [products = 0, services = 0, partnering = 0] = sector.f || [];
  const illustrative = '<span style="font-size:13px;color:#47537C">Illustrative figure from our research for ' + esc(nouns) + '. Your manager checks what fits you.</span>';

  switch (step) {
    case 1: return {
      subject: isPro ? `Services ${nouns} are adding with Partnermybusiness` : `${sector.s.length} services ${nouns} like ${name || 'yours'} are adding`,
      title: isPro ? 'More ways to earn from your skills' : `New services for ${name || `your ${noun}`}`,
      body: p(`Here are services ${nouns} on Partnermybusiness are adding, without changing how they work today:`)
        + li(sector.s)
        + p(`Done well, services like these could be worth up to <strong>${inr(services)} a month</strong>. ${illustrative}`)
        + p(`We find the customers and partners, and handle bookings and billing. ${isPro ? 'You do the work you’re good at.' : 'You keep running your business.'}`),
      cta: 'Show me how this works'
    };
    case 2: return {
      subject: isPro ? `What you could sell alongside your work as ${withArticle(noun)}` : `What ${name || `your ${noun}`} could sell at the counter`,
      title: 'Products your customers would buy',
      body: p(`${isPro ? 'Alongside your work' : 'Where your customers already wait or pay'}, these sell well for ${nouns}:`)
        + li(sector.p)
        + p(`We bring the brands and the stock, agree the margins upfront, and all billing runs through our central desk, so you always see the same statement we do.`)
        + p(`Products could add up to <strong>${inr(products)} a month</strong>. ${illustrative}`),
      cta: 'Show me the products'
    };
    case 3: return {
      subject: `Who could team up with ${isPro ? `you as ${withArticle(noun)}` : (name || `your ${noun}`)}`,
      title: 'Partners ready to work with you',
      body: p(`Collaboration, not competition. These are the partners most likely to work with ${esc(you)}:`)
        + li(sector.c)
        + p(`<strong>For example:</strong> ${esc(sector.e)}`)
        + p(`We introduce you, agree the split in writing before anything starts, and stay in the middle the whole way. Partnerships like this could be worth up to <strong>${inr(partnering)} a month</strong>. ${illustrative}`),
      cta: 'Find me a partner'
    };
    case 4: return {
      subject: isPro ? `Where ${nouns} are running sessions` : `Your quiet hours are worth more, ${firstName(user.name)}`,
      title: isPro ? 'Spaces you can work from' : 'Your quiet hours and spare space',
      body: (isPro
        ? p(`You don’t need your own premises. ${nouns.charAt(0).toUpperCase() + nouns.slice(1)} on our network work from:`)
        : p(`Most ${nouns} have space and time that sits idle. Yours could be earning:`))
        + li(String(sector.a || '').split(',').map(x => x.trim()).filter(Boolean))
        + p(`Ways we set it up: ${esc(listOf((sector.m || []).map(lower)))}. Every arrangement shares net profit, never gross, and is agreed with you case by case.`),
      cta: isPro ? 'Find me a space' : 'Help me use my quiet hours'
    };
    default: return {
      subject: `Shall we set this up for ${isPro ? 'you' : (name || `your ${noun}`)}?`,
      title: 'Let’s get your first collaboration live',
      body: p(`Over the last few emails we’ve shared ${sector.s.length + sector.p.length} ideas for ${esc(you)}, from ${esc(lower(sector.s[0]))} to ${esc(lower(sector.p[0]))}.`)
        + p(`The quickest way to start is one pilot. Press the button below and we’ll call you to pick the one that fits, agree the terms in writing, and set it up with you.`)
        + p(`Or just reply to this email, or call us on ${PHONE}.`),
      cta: 'Help me launch one'
    };
  }
}

async function emailFor(user, step) {
  const sector = sectorById(user.sectorId) || sectorFor(user);
  if (!sector) return null;
  const c = contentFor(user, step, sector);
  const page = user.role === 'associate' ? 'associate.html' : 'business.html';
  const link = (await issueLink(user, 'signin')).replace('activate.html?', `activate.html?next=${encodeURIComponent(page + '#learn')}&`);
  const manager = user.assignedManager ? await User.findById(user.assignedManager) : null;
  const from = manager ? `${esc(manager.name)}, your Partnermybusiness manager` : 'The Partnermybusiness team';
  const unsub = unsubscribeUrl(user);
  const html = layout(c.title,
    p(`Hi ${esc(firstName(user.name))},`) + c.body + button(link, c.cta)
    + p(`${from}<br><span style="font-size:13px;color:#47537C">Reply to this email any time. It comes straight to our team.</span>`)
    + `<p style="margin:18px 0 0;font-size:12px;color:#8A93B2">Email ${step} of ${STEPS} about growing with Partnermybusiness. <a href="${esc(unsub)}" style="color:#8A93B2">Stop these emails</a></p>`);
  return {
    to: user.email, replyTo: TEAM_INBOX(), subject: c.subject, html,
    text: `Hi ${firstName(user.name)}, ${c.title}. Open your dashboard: ${link} . Stop these emails: ${unsub}`,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
  };
}

// ---------- Sending ----------
// Daytime in India only, so nobody gets a sales email at 2 a.m.
const daytimeInIndia = (now = new Date()) => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return hour >= 9 && hour < 19;
};

async function sendDue({ now = new Date(), force = false } = {}) {
  if (!enabled() || (!force && !daytimeInIndia(now))) return { sent: 0 };
  const max = Number(process.env.DRIP_MAX_PER_RUN) || 40;
  const due = (await User.find({})).filter(u => ROLES.includes(u.role) && u.email && !u.emailOptOut && u.status !== 'rejected'
    && u.drip && u.drip.step < STEPS && u.drip.nextAt && new Date(u.drip.nextAt) <= now)
    .sort((a, b) => String(a.drip.nextAt).localeCompare(String(b.drip.nextAt)))
    .slice(0, max);
  let sent = 0;
  for (const user of due) {
    const step = user.drip.step + 1;
    try {
      const mail = await emailFor(user, step);
      if (!mail) { user.drip = { ...user.drip, step: STEPS, stoppedAt: now.toISOString(), stopped: 'no business type' }; await user.save(); continue; }
      const result = await sendMail(mail);
      if (result.error) throw new Error(result.error);
      user.drip = { ...user.drip, step, lastSentAt: now.toISOString(), nextAt: step < STEPS ? new Date(now.getTime() + intervalMs()).toISOString() : null };
      await user.save();
      sent += 1;
    } catch (err) {
      console.error(`[drip] email ${step} to ${user.email} failed:`, err.message);
    }
  }
  if (sent) console.log(`[drip] sent ${sent} opportunity email(s)`);
  return { sent };
}

// DRIP_ENROLL_EXISTING=true: also start the emails for partners who signed up before they existed.
// Safe to leave on: anyone already started is skipped. First emails are spread out, 10 minutes apart.
async function enrollExisting(now = Date.now()) {
  const users = (await User.find({})).filter(u => ROLES.includes(u.role) && u.email && !u.emailOptOut && !u.drip?.startedAt && u.status !== 'rejected');
  let n = 0;
  for (const u of users) {
    if (!enroll(u, now - intervalMs() + n * 10 * 60 * 1000)) continue;   // first email due straight away, spaced out
    await u.save();
    n += 1;
  }
  if (n) console.log(`[drip] started opportunity emails for ${n} existing partner(s)`);
  return n;
}

let timer = null;
function startDripWorker() {
  if (timer || !enabled()) return;
  if (/^(1|true|yes)$/i.test(process.env.DRIP_ENROLL_EXISTING || '')) enrollExisting().catch(err => console.error('[drip] enrol existing failed:', err.message));
  timer = setInterval(() => sendDue().catch(err => console.error('[drip] worker error:', err.message)), 30 * 60 * 1000);
  timer.unref?.();
  console.log(`[drip] opportunity emails on: ${STEPS} emails, every ${Number(process.env.DRIP_INTERVAL_DAYS) || 3} days, 9am–7pm IST`);
}

module.exports = { enroll, enrollExisting, sendDue, emailFor, startDripWorker, validUnsubscribe, unsubscribeUrl, STEPS };
