// The CTA: one document per business or professional that brings everything together:
//   feasibility (what sits idle, verdict), revenue opportunities, cost saving, how money is shared, and the
//   commercial terms they view and agree to online (no separate written agreement to sign).
// Modelled on the team's Feasibility Report and Partnership Agreement drafts (Google Drive).
// Used on the website before agreeing (/cta.html, a preview for the chosen type), in the dashboard and by email.
const { playbookFor } = require('./playbook');
const { costSavingFor } = require('./costSaving');
const { plural, withArticle } = require('./catalog');
const { TERMS_VERSION } = require('./terms');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const lower = s => (/^[A-Z]{2}/.test(s) ? s : String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1));
// "rr nagar" -> "RR Nagar", "hsr layout" -> "HSR Layout": short words without vowels are initials
const titleCase = s => String(s || '').replace(/\b\w+/g, w => (w.length <= 3 && !/[aeiou]/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)));
const fmtDate = d => new Date(d || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Desk assessment of one opportunity, the same way the team's feasibility reports rate them
function assess(opportunity) {
  const o = String(opportunity).toLowerCase();
  if (/cloud.kitchen|second|kiosk|franchise|delivery|charging|solar|equipment|stall|counter|\bapp\b/.test(o)) return { investment: 'Medium', time: '4–8 weeks', feasibility: 'High' };
  if (/packaged|retail|private.label|product|merchandise|\bkits?\b|\bmix\b|powder|masala|bases|\bpacks?\b|hamper/.test(o)) return { investment: 'Medium–High', time: '2–3 months', feasibility: 'Medium' };
  return { investment: 'Low', time: '2–4 weeks', feasibility: 'High' };
}

// Everything the CTA says, as data
function ctaFor({ user = {}, sectorId, name, area } = {}) {
  const who = user._id ? user : { ...user, sectorId: sectorId || user.sectorId, business: { businessName: name || user.business?.businessName }, location: area || user.location };
  const pb = playbookFor(who);
  if (!pb) return null;
  const s = pb.sector;
  const isPro = s.t === 'p';
  const savings = costSavingFor(who);
  const business = isPro ? (who.name || `You, as ${withArticle(s.noun)}`) : (who.business?.businessName || name || `Your ${s.noun}`);
  const opportunities = pb.opportunities.map(o => ({ name: o, ...assess(o) }));
  const easiest = opportunities.filter(o => o.investment === 'Low').slice(0, 2);
  return {
    leadId: user.leadId || null,
    business, isPro, area: titleCase(area || who.location || ''),
    type: pb.type, sectorName: s.n, noun: s.noun, nouns: plural(s.noun),
    idle: pb.idle, hook: pb.hook, partners: pb.partners,
    opportunities, moreOpportunities: pb.moreOpportunities,
    startWith: (easiest.length ? easiest : opportunities.slice(0, 2)).map(o => o.name),
    savings,
    terms: { version: TERMS_VERSION },
    agreed: user.termsAcceptedAt ? { at: user.termsAcceptedAt, version: user.termsVersion || TERMS_VERSION } : null,
    preparedOn: new Date().toISOString(),
    media: { video: pb.videos[0] || null, images: pb.images.slice(0, 5) }
  };
}

// ---------- HTML (inline styles, so the same markup works on the website and in email) ----------
const C = { ink: '#0F1B3D', muted: '#47537C', line: '#D5DCEC', soft: '#F6F8FC', navy: '#142C7A', ok: '#1E7F53', okSoft: '#E0F2E9', gold: '#F7B32B' };
const h2 = t => `<h2 style="margin:26px 0 10px;font-size:18px;line-height:1.3;color:${C.navy};font-family:inherit">${t}</h2>`;
const para = t => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.ink}">${t}</p>`;
const small = t => `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${C.muted}">${t}</p>`;
const table = (head, rows) => `<div style="overflow-x:auto"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:4px 0 14px;font-size:14px">
  ${head ? `<tr>${head.map(x => `<th style="text-align:left;padding:8px 10px;background:${C.soft};border-bottom:1px solid ${C.line};color:${C.muted};font-weight:600">${x}</th>`).join('')}</tr>` : ''}
  ${rows.map(r => `<tr>${r.map((x, i) => `<td style="padding:8px 10px;border-bottom:1px solid ${C.line};vertical-align:top;${i === 0 ? 'font-weight:600;' : ''}color:${C.ink}">${x}</td>`).join('')}</tr>`).join('')}
</table></div>`;
const list = items => `<ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.7;color:${C.ink}">${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
const box = inner => `<div style="margin:6px 0 16px;padding:14px 16px;border-radius:12px;background:${C.okSoft};color:${C.ink};font-size:15px;line-height:1.6">${inner}</div>`;

function termsList(c) {
  const space = c.isPro ? 'your skills and agreed hours' : `the space and hours that sit idle (${esc(lower(c.idle))})`;
  return [
    `<strong>Partner in principle.</strong> You join Partnermybusiness as a partner. This CTA is the agreement: there is nothing else to sign. Each opportunity starts only after you approve it in your dashboard.`,
    `<strong>What you bring.</strong> ${cap(space)}, your quality and hygiene standards, and approval of each activity.`,
    `<strong>What we bring.</strong> The partners and customers, the paperwork, the platform, tracking of every transaction, and a dashboard shared with every party.`,
    `<strong>Group deals.</strong> You let us include ${c.isPro ? 'you' : 'your business'} when we negotiate bulk supplies, brand placements and orders for many partners. Nothing is ordered without your OK.`,
    `<strong>One point of contact and billing.</strong> For collaborations we bring, customers pay through Partnermybusiness and shares are settled with a statement to every party. You won’t deal around us with partners we introduce for 12 months after the introduction.`,
    `<strong>Net, not gross.</strong> Taxes, refunds, payment charges and agreed direct costs come off first. If someone funds equipment, an agreed share (for example 20%) repays it first. The rest is shared as shown in section 4, case by case.`,
    `<strong>Your brand stays yours.</strong> Marketing that uses your name needs your approval. We show the partnership in our marketing only with your OK.`,
    `<strong>Leaving.</strong> Any party can exit with 30 days’ notice after dues are settled. Confidential information stays confidential. Disputes are first discussed in good faith, then under the laws of India with courts in Bengaluru.`
  ];
}

function renderCta(c, { full = true, preview = false } = {}) {
  if (!c) return '';
  const header = `<div style="padding:18px 20px;border-radius:14px;background:${C.navy};color:#fff">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Partnermybusiness · CTA${c.leadId ? ` · ${esc(c.leadId)}` : ''}</div>
    <div style="font-size:22px;font-weight:700;margin:6px 0 4px">${esc(c.business)}</div>
    <div style="font-size:14px;opacity:.9">${esc(c.type)}${c.area ? ` · ${esc(c.area)}` : ''} · ${preview ? 'Preview for your business type' : `Prepared ${fmtDate(c.preparedOn)}`}</div>
  </div>`;

  const summary = h2('1. Feasibility summary') + box(`<strong>Verdict: feasible, recommended to start.</strong> ${esc(c.business)} has ${c.isPro ? 'skills and time' : 'space and time'} that can earn more without disturbing ${c.isPro ? 'your current work' : 'the core business'}: <strong>${esc(c.idle)}</strong>. Start with <strong>${c.startWith.map(esc).join('</strong> and <strong>')}</strong>, which need the least investment. Partners we bring in: ${esc(c.partners)}.`)
    + table(['Key indicator', 'Assessment'], [
      [c.isPro ? 'Skills and hours available' : 'Idle space or time', `Yes: ${esc(c.idle)}`],
      ['Partner availability', `High: ${esc(c.partners)}`],
      ['Investment to start', 'Low to medium. Most opportunities run on the partner’s capital and operations'],
      ['Time to first revenue', '2–8 weeks, depending on the opportunity picked first']
    ]);

  const revenue = h2('2. Revenue opportunities') + table(['Opportunity', 'Investment', 'First revenue', 'Feasibility'],
    c.opportunities.map((o, i) => [`${i + 1}. ${esc(o.name)}`, esc(o.investment), esc(o.time), esc(o.feasibility)]))
    + (full && c.moreOpportunities.length ? small(`More ideas for ${esc(c.nouns)}: ${c.moreOpportunities.map(esc).join(', ')}.`) : '');

  const sv = c.savings;
  const costs = h2('3. Cost saving') + para(`Top costs for ${esc(lower(sv.label))}: ${esc(sv.topCosts.join(', '))}. We match you with partners on both sides to bring them down:`)
    + table(['How', 'What we do', 'Typical saving'], sv.levers.map(l => [esc(l.title), esc(l.how), esc(l.saving)]))
    + small(`<strong>Worked example (illustrative):</strong> ${esc(sv.example)} We confirm real numbers from your top 5 monthly expenses, quantities, rates and current suppliers.`);

  const money = h2('4. How the money is shared') + table(['Party', 'Role', 'Share', 'On ₹1,00,000'], [
    ['Infrastructure partner', 'Funds approved set-up and equipment', '25%', '₹25,000'],
    [c.isPro ? 'You, the professional' : 'Business owner', c.isPro ? 'Brings the skill and time' : 'Gives the space, time or asset', '25%', '₹25,000'],
    ['Lead generator', 'Brings the customers, e.g. an event company', '25%', '₹25,000'],
    ['Partnermybusiness', 'Agreement, platform, tracking and payments', '25%', '₹25,000']
  ]) + small('Shares are on net revenue, after GST and agreed direct costs. Where nobody funds equipment or brings customers, those shares are agreed case by case. Figures are illustrative, not a promise of income.');

  const terms = h2('5. Commercial terms you agree to') + list(termsList(c))
    + (c.agreed ? box(`<strong>Agreed.</strong> Accepted online on ${fmtDate(c.agreed.at)} (terms version ${esc(c.agreed.version)}).`) : '')
    + small(`Full Terms and Privacy Policy: partnermybusiness.ai/terms.html. Terms version ${esc(c.terms.version)}.`);

  const next = h2('6. Next steps') + table(['When', 'What happens'], [
    ['Week 1', 'Your PMB manager confirms what sits idle and your top costs on a call or visit'],
    ['Week 2', 'We line up partners and share the opportunities and savings we can start with'],
    ['Week 3', 'You approve the first opportunity in your dashboard'],
    ['Week 4+', 'Launch, track every rupee on the dashboard, review numbers every week']
  ]);

  return `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${C.ink}">${header}${summary}${revenue}${costs}${full ? money + terms + next : ''}</div>`;
}

// The CTA email sent at sign-up: summary, revenue and cost saving, the key terms in short, and a one-tap
// button to the full CTA in the dashboard
function ctaEmail({ user, link }) {
  const { layout, button, firstName, TEAM_INBOX } = require('./emails');
  const c = ctaFor({ user });
  if (!c || !user.email) return null;
  const terms = termsList(c).slice(0, 6).map(t => t.replace(/<\/strong>.*$/, '</strong>'));
  const body = para(`Hi ${esc(firstName(user.name))}, here is your CTA${c.leadId ? `, lead ID <strong>${esc(c.leadId)}</strong>` : ''}. It sets out what we found is feasible for ${esc(c.business)}, how you can earn more and save, and the terms you agreed to.`)
    + renderCta(c, { full: false })
    + h2('Terms you agreed to') + list(terms)
    + (link ? button(link, 'Read your full CTA') : '')
    + small('Reply to this email with any questions. Your PMB manager will call you to confirm the details.');
  return {
    to: user.email, replyTo: TEAM_INBOX(),
    subject: `Your CTA: ${c.business}${c.leadId ? ` · ${c.leadId}` : ''}`,
    html: layout('Your CTA', body),
    text: `Your CTA for ${c.business}${c.leadId ? ` (${c.leadId})` : ''}: feasibility, ${c.opportunities.length} revenue opportunities, ${c.savings.levers.length} ways to save, and your terms.${link ? ` Read it: ${link}` : ''}`
  };
}

// Email someone their CTA, with a one-tap button that opens it in their dashboard. Never throws: a failed email
// must not stop a sign-up.
async function sendCtaEmail(user) {
  try {
    if (!['business', 'associate'].includes(user.role)) return null;
    const { issueLink } = require('./links');
    const { sendMail } = require('./mailer');
    const page = user.role === 'associate' ? 'associate.html#cta' : 'business.html#cta';
    const link = (await issueLink(user, 'signin')).replace('activate.html?', `activate.html?next=${encodeURIComponent(page)}&`);
    const mail = ctaEmail({ user, link });
    return mail ? await sendMail(mail) : null;
  } catch (err) {
    console.error('[cta] email failed:', err.message);
    return null;
  }
}

module.exports = { ctaFor, renderCta, ctaEmail, sendCtaEmail, assess };
