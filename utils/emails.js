// Email templates. Inline styles only, because email apps ignore <style> blocks.
const APP_URL = () => (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, '');
const TEAM_INBOX = () => process.env.TEAM_INBOX || 'info@partnermybusiness.ai';
const PHONE = '+91 81039 90990';
const { industryFor } = require('./industry');
const { listOf } = require('./catalog');

// "Divyaj.govianu05" -> "Divyaj", "MAHESH kumar" -> "Mahesh"; falls back to "there"
function firstName(name) {
  let n = String(name || '').trim().split(/\s+/)[0] || '';
  if (n.includes('@')) n = n.split('@')[0];
  n = n.split(/[._]/)[0].replace(/\d+$/, '');
  if (!/[a-z]/i.test(n)) return 'there';
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Date to be confirmed');

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#F6F8FC;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0F1B3D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #D5DCEC">
<tr><td style="background:#142C7A;padding:20px 28px;color:#FFFFFF;font-size:18px;font-weight:700">Partnermybusiness<span style="color:#F7B32B">.ai</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0F1B3D">${esc(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;background:#F6F8FC;color:#47537C;font-size:13px;line-height:1.5">
Questions? Reply to this email or call ${PHONE}.<br>A Govianu venture, Bengaluru, India
</td></tr></table></td></tr></table></body></html>`;
}

const p = text => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#0F1B3D">${text}</p>`;
const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="background:#1B3A9E;border-radius:10px">
<a href="${esc(href)}" style="display:inline-block;padding:13px 24px;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none">${esc(label)}</a></td></tr></table>
<p style="margin:0 0 14px;font-size:12px;color:#47537C;word-break:break-all">If the button doesn’t work, open this link: ${esc(href)}</p>`;
const table = rows => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:14px">
${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:7px 10px 7px 0;color:#47537C;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:7px 0;color:#0F1B3D;vertical-align:top">${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('')}
</table>`;

function emailOtp({ name, email, code, role, category, sectorId, multipleProfiles = false }) {
  const industry = industryFor({ category, sectorId });
  const audience = role === 'business'
    ? `${industry.display} partner`
    : role === 'associate' ? 'professional' : 'team';
  const body = p(multipleProfiles
    ? `Hi ${esc(firstName(name))}, use this code to verify your email, then choose which dashboard to open.`
    : `Hi ${esc(firstName(name))}, use this code to verify your email and open your ${esc(audience)} dashboard.`)
    + `<div style="margin:20px 0;padding:18px;background:#F6F8FC;border:1px solid #D5DCEC;border-radius:12px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#142C7A">${esc(code)}</div>`
    + p('<span style="font-size:13px;color:#47537C">This code expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.</span>');
  return {
    to: email,
    subject: multipleProfiles ? 'Your Partnermybusiness sign-in code' : `Your ${role === 'business' ? `${industry.display} partner` : audience} dashboard sign-in code`,
    html: layout('Verify your email', body),
    text: `Your Partnermybusiness verification code is ${code}. It expires in 10 minutes.`
  };
}

// 1. To the person who enquired: confirmation in their own business type's words + dashboard code
function enquiryWelcome({ name, email, roleName, code, hasDashboard, existingAccount, category, sectorId, businessName, dashboardRole, dashboardProfileId }) {
  const first = firstName(name);
  const industry = industryFor({ category, sectorId });
  const kw = industry.keywords;
  const biz = String(businessName || '').trim();
  const noun = industry.label;

  // "thank you for telling us about Magic Masala, your restaurant." / "thank you for your enquiry as a chef."
  let opening;
  if (kw && !industry.isProfessional && biz) opening = `thank you for telling us about ${esc(biz)}, your ${esc(noun)}.`;
  else if (kw && !industry.isProfessional) opening = `thank you for your ${esc(noun)} enquiry.`;
  else if (kw) opening = `thank you for your enquiry as ${esc(industry.withArticle)}.`;
  else if (biz) opening = `thank you for your enquiry about ${esc(biz)}.`;
  else opening = `thank you for your enquiry as ${esc(String(roleName || 'a partner').toLowerCase())}.`;

  let body = p(`Hi ${esc(first)}, ${opening} It has reached our team, and we’ve recorded that you agreed to our Terms and Conditions.`);
  if (kw) {
    const like = industry.isProfessional ? `${esc(industry.plural)} like you` : `${esc(industry.plural)} like ${esc(biz || 'yours')}`;
    body += p(`Ideas that work well for ${like}: ${esc(listOf(kw.services))}. You could also team up with ${esc(listOf(kw.partners))} on the platform.`);
  }
  if (hasDashboard) {
    const what = kw
      ? `It has ${esc(noun)} growth ideas, short video lessons based on your skills, and your booking requests.`
      : 'It has growth ideas, short video lessons based on your skills, and your booking requests.';
    body += p(existingAccount
      ? `Use the code below to sign in to your ${esc(noun)} dashboard. ${what}`
      : `Your ${esc(noun)} dashboard is ready. ${what} Verify your email with this code to open it:`);
    body += `<div style="margin:20px 0;padding:18px;background:#F6F8FC;border:1px solid #D5DCEC;border-radius:12px;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#142C7A">${esc(code)}</div>`;
    const loginUrl = `${APP_URL()}/login.html?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`${dashboardRole}.html`)}&profileId=${encodeURIComponent(dashboardProfileId)}&verify=1#login`;
    body += button(loginUrl, `Open my ${noun} dashboard`);
    body += p('<span style="font-size:13px;color:#47537C">This code expires in 10 minutes. You can request another code from the login page.</span>');
  } else {
    body += p('A member of our partnerships team will contact you within two working days to talk about your territory.');
  }
  const subject = hasDashboard
    ? (kw && biz && !industry.isProfessional ? `${biz}: your ${noun} dashboard code` : `Your ${noun} dashboard code`)
    : 'We’ve received your enquiry';
  const title = kw ? (industry.isProfessional ? `Welcome, ${noun}` : `Welcome to Partnermybusiness, ${biz || noun}`) : 'Enquiry received';
  return {
    to: email,
    subject,
    html: layout(title, body),
    text: `Hi ${first}, ${opening.replace(/&amp;/g, '&')} ${hasDashboard ? `Your verification code is ${code}. It expires in 10 minutes. Sign in at ${APP_URL()}/login.html#login` : 'Our team will contact you within two working days.'}`
  };
}

// 2. To the PMB team inbox: full enquiry + proof of terms acceptance
function teamEnquiry(e) {
  const body = p('A new enquiry arrived from the website.') + table([
    ['Enquiry type', e.roleName], ['Name', e.name], ['Business or brand', e.business], ['Email', e.email],
    ['Phone or WhatsApp', e.phone], ['Business or profession', e.businessType], ['Location', e.location],
    ['Offer', e.offer], ['Territory', e.territory], ['Notes', e.message], ['Dashboard plan', e.plan],
    ['Terms accepted', `Yes, version ${e.termsVersion}, ${new Date(e.termsAcceptedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`],
    ['Dashboard', e.handle ? `${e.handle} (verification code sent${e.existingAccount ? ', existing account' : ''})` : 'Not applicable']
  ]) + button(`${APP_URL()}/login.html`, 'Open the admin dashboard');
  return {
    to: TEAM_INBOX(),
    replyTo: e.email || undefined,
    subject: `Partnermybusiness enquiry: ${e.roleName}${e.business ? ', ' + e.business : ''}`,
    html: layout('New website enquiry', body),
    text: `New enquiry from ${e.name} (${e.email || e.phone}).`
  };
}

// 3. Legacy one-time login link for older activation emails
function loginLink({ name, email, link }) {
  const first = firstName(name);
  const body = p(`Hi ${esc(first)}, use this one-time link to verify your email and open your dashboard.`)
    + button(link, 'Open my dashboard')
    + p('<span style="font-size:13px;color:#47537C">This link works once and expires in 72 hours. For a code instead, use the login page. If you didn’t ask for it, you can ignore this email.</span>');
  return { to: email, subject: 'Your Partnermybusiness login link', html: layout('Your login link', body), text: `Open: ${link}` };
}

// 4. To a business: new booking request with an accept CTA
function bookingRequested({ business, booking }) {
  const industry = industryFor(business);
  const body = p(`You have a new ${esc(industry.bookingLabel)} request for ${esc(business.business?.businessName || business.name)}.`) + table([
    ['Booking', booking.eventType], ['From', booking.requesterName + (booking.leadGenName ? `, ${booking.leadGenName}` : '')],
    ['Date', fmtDate(booking.eventDate)], ['Guests', booking.guests], ['Budget', booking.amount ? inr(booking.amount) : ''],
    ['Message', booking.message]
  ]) + p('Review the revenue split and the partner terms, then accept or decline from your dashboard.')
    + button(`${APP_URL()}/login.html?next=business.html%23bookings`, 'Review and accept');
  return { to: business.email, subject: `New ${industry.bookingLabel} request: ${booking.eventType}`, html: layout('New booking request', body), text: `New ${industry.bookingLabel} request: ${booking.eventType}` };
}

// 5. To the person who booked + the business: booking confirmed
function bookingAccepted({ business, booking, share }) {
  const venue = business.business?.businessName || business.name;
  const industry = industryFor(business);
  const rows = [['Booking', booking.eventType], ['Venue', venue], ['Date', fmtDate(booking.eventDate)], ['Guests', booking.guests]];
  const meet = booking.meetLink ? button(booking.meetLink, 'Join the onboarding call') : p('Your PMB manager will send the onboarding call details shortly.');
  return [
    booking.requesterEmail && {
      to: booking.requesterEmail,
      subject: `${industry.display} booking confirmed: ${booking.eventType} at ${venue}`,
      html: layout('Your booking is confirmed', p(`Hi ${esc(firstName(booking.requesterName))}, ${esc(venue)} has accepted your booking request.`) + table(rows) + meet),
      text: `${venue} accepted your booking.`
    },
    business.email && {
      to: business.email,
      subject: `${industry.display} booking accepted: ${booking.eventType}`,
      html: layout('Booking accepted', p('You accepted this booking under the Partnermybusiness partner terms.') + table([...rows, ['Booking value', booking.amount ? inr(booking.amount) : ''], ['Your share', share != null ? inr(share) : '']]) + meet
        + button(`${APP_URL()}/login.html?next=business.html%23bookings`, 'View in your dashboard')),
      text: `You accepted ${booking.eventType}.`
    }
  ].filter(Boolean);
}

module.exports = { firstName, emailOtp, enquiryWelcome, teamEnquiry, loginLink, bookingRequested, bookingAccepted, APP_URL, TEAM_INBOX };

// 6. To the PMB team: a partner pressed a call to action in their dashboard
function ctaRequest({ user, industry, label, topic, note, preferred }) {
  const company = user.business?.businessName || '';
  const body = p(`${esc(user.name)} pressed “${esc(label)}” in their ${esc(industry.label)} dashboard.`) + table([
    ['Request', label], ['About', topic], ['Name', user.name], ['Business', company], ['Type', industry.display],
    ['Email', user.email], ['Phone', user.phone], ['Area', user.location], ['Best time to call', preferred], ['Note', note],
    ['Skills', (user.skills || user.associate?.skills || []).join(', ')], ['Handle', user.handle]
  ]) + button(`${APP_URL()}/login.html`, 'Open the admin dashboard');
  return {
    to: TEAM_INBOX(),
    replyTo: user.email || undefined,
    subject: `${label}: ${company || user.name} (${industry.label})`,
    html: layout(label, body),
    text: `${user.name} (${industry.label}) asked: ${label}${topic ? ` - ${topic}` : ''}.`
  };
}

module.exports.ctaRequest = ctaRequest;
