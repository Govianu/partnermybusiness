// Opportunity emails after sign-up: ten emails, a few days apart, alternating the two verticals for this exact
// business type or profession: five ways to earn more and five ways to save. People forget dashboards; these
// bring them back.
//
// Every email has a one-tap button into their dashboard, replies go to the team inbox, and a one-click
// unsubscribe (also as a List-Unsubscribe header, which Gmail and Yahoo expect from regular senders).
// Settings: DRIP_INTERVAL_DAYS (default 3), DRIP_ENABLED (default on), DRIP_MAX_PER_RUN (default 40).
const crypto = require('crypto');
const User = require('../models/User');
const { sectorById, sectorFor } = require('./catalog');
const { sendMail } = require('./mailer');
const { issueLink } = require('./links');
const { layout, p, button, esc, firstName, APP_URL, TEAM_INBOX, PHONE } = require('./emails');
const { playbookFor, imageFor } = require('./playbook');
const { costSavingFor } = require('./costSaving');
const { PITCH } = require('./pitch');
const { assess } = require('./cta');

const STEPS = 10;
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
// Ten emails, alternating the two verticals: revenue (odd steps) and cost saving (even steps).
//   1 revenue: opportunity 1 (with the type's 30-second hook)   2 saving: lever 1 (with a worked example)
//   3 revenue: opportunity 2                                    4 saving: lever 2
//   ...                                                         10 saving: lever 5, then "shall we set this up?"
// Revenue emails use the team's research for this exact type (utils/playbook.js) and its creative where one exists.
const li = items => `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.7;color:#0F1B3D">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
const lower = s => (/^[A-Z]{2}/.test(s) ? s : String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1));
const muted = t => `<span style="font-size:13px;color:#47537C">${t}</span>`;
const image = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt)}" width="504" style="display:block;width:100%;max-width:504px;height:auto;border-radius:12px;border:1px solid #D5DCEC;margin:4px 0 16px">`;

function revenueEmail(user, k, pb) {
  const isPro = pb.sector.t === 'p';
  const name = isPro ? 'you' : (user.business?.businessName || `your ${pb.sector.noun}`);
  const all = pb.opportunities.concat(pb.moreOpportunities);
  const opp = all[(k - 1) % all.length];
  const a = assess(opp);
  const creative = imageFor(pb, opp);
  return {
    subject: k === 1 && pb.hook ? `${pb.hook.replace(/\.$/, '')}: ${opp.toLowerCase()} for ${name}` : `${opp} ${isPro ? 'for you' : `at ${name}`}?`,
    title: `${opp}`,
    body: (k === 1 ? p(`${isPro ? 'Your skills and spare hours' : `What sits idle at ${esc(name)} today`}: <strong>${esc(pb.idle)}</strong>. Here’s one way to put ${isPro ? 'them' : 'it'} to work.`) : '')
      + (creative ? image(creative.url.replace(/w=\d+$/, 'w=1000'), `${opp}: how it works`) : '')
      + p(`<strong>Opportunity ${k} of 5: ${esc(opp)}.</strong> It needs a partner to run it, a written agreement, customers and billing. We bring all four: the partners (${esc(pb.partners)}), the terms, the bookings and the payments.`)
      + li([`Investment to start: ${a.investment}`, `Time to first revenue: ${a.time}`, `Feasibility: ${a.feasibility}`])
      + p(`${esc(PITCH.deal)} ${muted(esc(PITCH.call))}`),
    cta: 'Show me how this works'
  };
}

function savingEmail(user, k, savings) {
  const lever = savings.levers[(k - 1) % savings.levers.length];
  const last = k === 5;
  return {
    subject: /^(\d|up to)/i.test(lever.saving) ? `Save ${lower(lever.saving)}: ${lower(lever.title)}` : `${lever.title}: ${lower(lever.saving)}`,
    title: `Cut costs: ${lever.title}`,
    body: p(`Earning more is half of it. The other half is spending less. Here’s cost-saving idea ${k} of 5 for ${esc(lower(savings.label))}:`)
      + p(`<strong>${esc(lever.title)}.</strong> Typical saving: ${esc(lever.saving)}.`)
      + li([`Doing it alone: ${lever.alone}`, `With PMB: ${lever.withUs}`])
      + (k === 1 ? p(`<strong>For example:</strong> ${esc(savings.example)} ${muted('Illustrative.')}`) : '')
      + p(`Partnership is collaboration, not competition: we match you with partners on both sides so everyone’s costs come down. Send us your top 5 monthly expenses and we’ll work out your real numbers.`)
      + (last ? p(`That’s the last of these emails. The quickest way to start is one pilot: press the button and we’ll call you to pick it. Or reply, or call ${PHONE}.`) : ''),
    cta: last ? 'Help me launch one' : 'Get my savings plan'
  };
}

function contentFor(user, step, sector) {
  const pb = playbookFor(user._id ? user : { ...user, sectorId: sector.id });
  return step % 2 === 1 ? revenueEmail(user, (step + 1) / 2, pb) : savingEmail(user, step / 2, costSavingFor(user._id ? user : sector.id));
}

async function emailFor(user, step) {
  const sector = sectorById(user.sectorId) || sectorFor(user);
  if (!sector) return null;
  const c = contentFor(user, step, sector);
  const page = user.role === 'associate' ? 'associate.html' : 'business.html';
  const link = (await issueLink(user, 'signin')).replace('activate.html?', `activate.html?next=${encodeURIComponent(page + (step % 2 ? '#learn' : '#savings'))}&`);
  const manager = user.assignedManager ? await User.findById(user.assignedManager) : null;
  const from = manager ? `${esc(manager.name)}, your Partnermybusiness manager` : 'The Partnermybusiness team';
  const unsub = unsubscribeUrl(user);
  const html = layout(c.title,
    p(`Hi ${esc(firstName(user.name))},`) + c.body + button(link, c.cta)
    + p(`${from}<br><span style="font-size:13px;color:#47537C">Reply to this email any time. It comes straight to our team.</span>`)
    + `<p style="margin:18px 0 0;font-size:12px;color:#8A93B2">Email ${step} of ${STEPS} about earning more and saving with Partnermybusiness. <a href="${esc(unsub)}" style="color:#8A93B2">Stop these emails</a></p>`);
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
