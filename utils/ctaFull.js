// The detailed CTA, shown only in the dashboard (My CTA): a Deal Sheet with this partner's numbers, 14 sections
// of partner terms, and an acceptance form with separate tick-boxes. Modelled on how District (Zomato's merchant
// terms for events and dining), Alive (iamalive.app) and Meetup set out their host terms and acceptance, written
// in our own plain words. The short CTA on the website and in emails stays as it is (utils/cta.js).
//
// Tax rates and sections, Aadhaar handling and the arbitration clause should be checked by PMB's CA and lawyer.
const crypto = require('crypto');

const CTA_VERSION = 'CTA v2.0, 20 November 2026';

const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const words = t => String(t).replace(/\b\w+/g, w => (w.length <= 3 && !/[aeiou]/i.test(w) ? w.toUpperCase() : cap(w)));

function dealSheet(user) {
  const isPro = user.role === 'associate';
  return [
    ['Partner', isPro ? user.name : (user.business?.businessName || user.name)],
    ['Type', cap(String(user.category || (isPro ? 'professional' : 'business')).replace(/_/g, ' '))],
    ['Area', words(user.location || 'Bengaluru')],
    ['How the money is shared', 'Standard: 25% each to the space partner, ' + (isPro ? 'you' : 'the business owner') + ', the lead generator and PMB. Where a party is not involved, the split is agreed per booking and shown before you accept it.'],
    ['PMB fees on top', 'None charged to you. Any customer-side fee is shown to the customer before they pay.'],
    ['When you are paid', 'Within 7 working days after each session, to your verified bank account.'],
    ['What comes off first', 'Taxes, refunds, payment charges, TDS (0.1%) and GST TCS (0.5%, only if you are GST registered).'],
    ['If a customer cancels', 'Full refund if more than 24 hours before; none after (unless you choose an easier rule for a booking).'],
    ['If you cancel', 'At least 48 hours before: customers get a full refund. Later, or a no-show: full refund plus a late-cancel charge agreed per booking.'],
    ['Notice to change fees or shares', '45 days'],
    ['Notice to leave', '30 days, after dues are settled']
  ];
}

// [D] District / Zomato merchant terms, [A] Alive, [M] Meetup, [IN] Indian law, [PMB] how PMB works
const SECTIONS = [
  { title: '1. Who we are and what we do', points: [
    'Partnermybusiness (PMB) is a platform. We bring you customers and partners, agree the deal with you, take payment, and pay you after the booking.',
    'You run the session, class, event, pop-up or booking, and you are responsible for how it is delivered.',
    'These terms and your Deal Sheet are one agreement. If they differ, the Deal Sheet wins on numbers.',
    'You are an independent business or professional, not our employee or agent.'] },
  { title: '2. No direct contact', points: [
    'PMB is your only point of contact. We never share your phone, email or address with customers, partners or other businesses, and never share theirs with you.',
    'All messages, orders, bookings and payments go through PMB.',
    'Bookings that come through PMB must not be moved off PMB to avoid the shared fee.'] },
  { title: '3. Joining and KYC', points: [
    'Give true details (name, phone, email, address) and keep them up to date.',
    'Before any booking we need your Aadhaar (we keep only the last 4 digits), PAN, and a bank account in your own or your business name, with their documents. GSTIN if you are registered.',
    'Food and drink partners need a valid FSSAI licence; alcohol needs a liquor licence.',
    'We may pause your account if a document is missing, wrong or expired.'] },
  { title: '4. Your listing and content', points: [
    'Describe each session honestly: what, when, where, price, what is included and any age limits.',
    'No copied, fake, hateful, adult, misleading or illegal content, and no fake reviews.',
    'Use real photos you own or have the right to use.',
    'Tell us before you change a session (date, venue or content) after people have booked.',
    'We may edit for format, or pause or remove a listing that breaks these rules.'] },
  { title: '5. Price, shares and fees', points: [
    'The price customers pay is agreed with you. Do not charge customers extra or take cash at the door unless we agree in writing.',
    'The money is shared as shown in your Deal Sheet. Any figures we show you are examples, not a promise of income.',
    'If someone funds equipment for a partnership, an agreed share (for example 20%) repays it first.',
    'We give 45 days’ notice before changing shares or adding a fee. You can leave if you do not agree.'] },
  { title: '6. Payments and payouts', points: [
    'PMB collects all customer payments for PMB bookings.',
    'We pay you within 7 working days after each session, to your verified bank account. Holidays move it to the next working day.',
    'From each payout we take off: taxes, refunds, payment charges, TDS (0.1%) and GST TCS (0.5%, if you are GST registered).',
    'You get a statement and our tax invoice on your dashboard every month.',
    'We may hold a payout if there is a complaint, chargeback or suspected fraud, and we will tell you why.'] },
  { title: '7. Taxes', points: [
    'You are responsible for tax on your own income and services.',
    'Tell us your GST status and keep it up to date.',
    'TDS and TCS we deduct show up in your Form 26AS and the GST portal.',
    'A penalty caused by wrong tax details from you is your cost.'] },
  { title: '8. Cancellations, refunds and no-shows', points: [
    'If you cancel at least 48 hours before, customers get a full refund, taken from your next payout. Repeated cancellations can lead to removal.',
    'If you cancel later or do not show up, customers get a full refund plus a late-cancel charge agreed per booking.',
    'If a customer cancels, the rule shown before they paid applies (by default, full refund if more than 24 hours before, none after).',
    'If a customer does not show up, you keep your share.',
    'Complaints after a session must reach us within 72 hours. We hear both sides and decide refunds fairly.',
    'For bad weather, government orders or other events outside anyone’s control, we try to reschedule first; if we cannot, customers are refunded and nobody pays a penalty.'] },
  { title: '9. Running the session: venue, capacity, safety', points: [
    'Admit every valid PMB booking. Do not turn anyone away because of religion, caste, gender, disability or similar reasons.',
    'Stay within the safe and legal capacity of your space.',
    'Keep a named host present for the whole session, and share house rules (start time, age, alcohol, photos) in the listing and at the start.',
    'Keep licences, fire safety, first aid, hygiene and electrical safety in place.',
    'You may ask an unsafe or abusive guest to leave; tell us the same day.',
    'For children’s sessions, a parent or guardian must agree, and no child is left alone with one adult.'] },
  { title: '10. Conduct', points: [
    'Be polite and professional with customers, partners and PMB staff.',
    'No harassment, discrimination, drugs, illegal betting or unsafe activity.',
    'No gifts or payments to PMB staff for better deals, and do not act as PMB staff or promise things for us.',
    'Breaking these rules can mean removal and held payouts.'] },
  { title: '11. Photos, content and your brand', points: [
    'You let PMB use your name, logo, photos and listing text to show and promote your sessions, free of charge, while you are a partner.',
    'Your brand stays yours: marketing that uses your name needs your approval.',
    'You keep ownership of your content; we keep ownership of ours. Use PMB’s name and logo only as we allow.'] },
  { title: '12. Customer data and privacy', points: [
    'Use customer details only to run the booking. Do not sell them, copy them to your lists or message customers for other promotions.',
    'Keep the data safe and delete it when it is no longer needed.',
    'Tell us within 24 hours if customer data is leaked or misused.',
    'We handle your details as our Privacy Policy explains, keep them private and never sell them.'] },
  { title: '13. Insurance and responsibility', points: [
    'You are responsible for injury, loss or damage caused by your session, venue, food, staff or equipment.',
    'Keep suitable insurance where the booking needs it (for example public liability for large events).',
    'You cover PMB’s costs if a claim comes from your breach, your session, your content or your tax or licence failures.',
    'PMB is not liable for indirect losses. Our total liability to you is limited to PMB’s share from the booking in question.'] },
  { title: '14. Pausing, ending, changes and disputes', points: [
    'Either side can end with 30 days’ notice by email or in the dashboard, after dues are settled. Sessions already booked in that time must still run, or be refunded.',
    'PMB can pause or end at once for serious breach, fraud, safety risk or illegal activity; for smaller breaches we give 14 days to fix it.',
    'We may update these terms with notice. Fee and share changes need 45 days. You can leave instead of accepting.',
    'Complaints go to the PMB grievance officer at info@partnermybusiness.ai. We reply within 48 hours and aim to resolve within 15 days.',
    'Disputes are first discussed in good faith for 15 days, then go to a sole arbitrator in Bengaluru, in English, under Indian law.'] }
];

// What they agree to, one line each. The form shows these as a list with one "I agree" box at the end;
// each line is still recorded separately.
const CONSENTS = [
  { id: 'terms', required: true, label: 'I have read and agree to the PMB Partner Terms and my Deal Sheet.' },
  { id: 'authorised', required: true, label: 'I am allowed to accept these terms for myself or this business.' },
  { id: 'details', required: true, label: 'My details and documents (Aadhaar, PAN, bank, GST, licences) are true and current, and I will keep them updated.' },
  { id: 'payments', required: true, label: 'PMB collects customer payments and pays me after each session, after taxes, refunds and agreed shares.' },
  { id: 'no_bypass', required: true, label: 'I will not take payment for PMB bookings outside PMB, or contact PMB customers or partners directly.' },
  { id: 'cancellations', required: true, label: 'I agree to the cancellation, refund and no-show rules, including refunds coming from my payouts.' },
  { id: 'hosting', required: true, label: 'I will admit every valid booking, stay within safe capacity and keep a host present at every session.' },
  { id: 'safety', required: true, label: 'I hold the licences, safety measures and insurance my sessions need.' },
  { id: 'content', required: true, label: 'PMB may use my name, logo, photos and listing to show and promote my sessions.' },
  { id: 'data', required: true, label: 'I will use customer details only to run bookings and keep them safe.' },
  { id: 'privacy', required: true, label: 'I have read the Privacy Policy and agree PMB may use my details to run this partnership, pay me and meet tax and legal duties.' },
  { id: 'disputes', required: true, label: 'Disputes go first to talks, then to arbitration in Bengaluru under Indian law.' },
  { id: 'marketing', required: false, label: 'Optional: send me tips, offers and partner news on WhatsApp, SMS or email.' },
  { id: 'filming', required: false, label: 'Optional: PMB may photograph or film my sessions for marketing (I will tell guests).' }
];

const termsText = () => SECTIONS.map(s => s.title + '\n' + s.points.join('\n')).join('\n\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

function ctaFull(user) {
  return {
    version: CTA_VERSION, dealSheet: dealSheet(user), sections: SECTIONS,
    consents: CONSENTS.map(({ id, required, label }) => ({ id, required, label })),
    accepted: user.ctaAcceptance && user.ctaAcceptance.version === CTA_VERSION ? {
      at: user.ctaAcceptance.at, name: user.ctaAcceptance.name, designation: user.ctaAcceptance.designation,
      optional: user.ctaAcceptance.consents.filter(c => !c.required).map(c => ({ id: c.id, value: c.value }))
    } : null
  };
}

// Record the acceptance: who, when (UTC and IST), from where, which version (and a hash of the exact text), each box
function acceptCta(user, body, req) {
  const { fail } = require('./http');
  if (body.version !== CTA_VERSION) throw fail('These terms were updated. Reload the page and read them again.', 409);
  // One box at the end ("I agree to all of the above") ticks every required point; optional ones start off
  const ticked = body.agreeAll === true
    ? Object.fromEntries(CONSENTS.map(c => [c.id, c.required || body.consents?.[c.id] === true]))
    : (body.consents || {});
  const missing = CONSENTS.filter(c => c.required && ticked[c.id] !== true);
  if (missing.length) throw fail(body.agreeAll !== undefined ? 'Tick "I agree" to accept.' : `Tick all the required boxes to accept (${missing.length} left).`);
  const name = String(body.name || '').trim().slice(0, 120);
  if (name.length < 3) throw fail('Type your full name to sign');
  const at = new Date();
  const sheet = dealSheet(user);
  user.ctaAcceptance = {
    version: CTA_VERSION, termsHash: hash(termsText()), dealSheetHash: hash(JSON.stringify(sheet)), dealSheet: sheet,
    name, designation: String(body.designation || '').trim().slice(0, 80),
    at: at.toISOString(), atIST: at.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
    ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim(), userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    email: user.email,
    consents: CONSENTS.map(c => ({ id: c.id, label: c.label, required: c.required, value: ticked[c.id] === true }))
  };
  user.ctaAcceptanceLog = (user.ctaAcceptanceLog || []).concat([{ version: CTA_VERSION, at: user.ctaAcceptance.at }]).slice(-20);
  return user.ctaAcceptance;
}

// Change an optional consent later (marketing, filming), with the time it changed
function setOptional(user, id, value) {
  const { fail } = require('./http');
  const c = user.ctaAcceptance?.consents?.find(x => x.id === id && !x.required);
  if (!c) throw fail('Not found', 404);
  c.value = value === true;
  c.changedAt = new Date().toISOString();
}

// The copy emailed after accepting
function acceptedHtml(user) {
  const a = user.ctaAcceptance;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const row = ([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #D5DCEC;color:#47537C;font-size:13px;vertical-align:top">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #D5DCEC;font-size:14px">${esc(v)}</td></tr>`;
  return `<h2 style="font-size:18px;color:#142C7A;margin:18px 0 8px">Your Deal Sheet</h2><table style="border-collapse:collapse;width:100%">${a.dealSheet.map(row).join('')}</table>`
    + SECTIONS.map(s => `<h3 style="font-size:15px;color:#142C7A;margin:16px 0 6px">${esc(s.title)}</h3><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6">${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`).join('')
    + `<h3 style="font-size:15px;color:#142C7A;margin:16px 0 6px">What you ticked</h3><ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.6">${a.consents.map(c => `<li>${c.value ? '☑' : '☐'} ${esc(c.label)}</li>`).join('')}</ul>`
    + `<p style="font-size:13px;color:#47537C;margin-top:14px">Signed by ${esc(a.name)}${a.designation ? `, ${esc(a.designation)}` : ''}, on ${esc(a.atIST)}. ${esc(a.version)}. Record ${esc(a.termsHash.slice(0, 16))}.</p>`;
}

module.exports = { ctaFull, acceptCta, setOptional, acceptedHtml, CTA_VERSION, CONSENTS, SECTIONS };
