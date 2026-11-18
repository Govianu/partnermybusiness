// Email templates. Inline styles only, because email apps ignore <style> blocks.
const APP_URL = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const TEAM_INBOX = () => process.env.TEAM_INBOX || 'info@partnermybusiness.ai';
const PHONE = '+91 81039 90990';

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

// 1. To the person who enquired: confirmation + dashboard activation link
function enquiryWelcome({ name, email, roleName, link, hasDashboard, existingAccount }) {
  const first = String(name || '').split(' ')[0] || 'there';
  let body = p(`Hi ${esc(first)}, thank you for your enquiry as ${esc(roleName.toLowerCase())}. It has reached our team, and we’ve recorded that you agreed to our Terms and Conditions.`);
  if (hasDashboard && existingAccount) {
    body += p('You already have a Partnermybusiness dashboard with this email. Log in to see your enquiry, opportunities and booking requests.');
    body += button(link, 'Log in to your dashboard');
  } else if (hasDashboard) {
    body += p('Your dashboard is ready. Set a password to open it. From there you can see your opportunities, accept booking requests and track every payout.');
    body += button(link, 'Open my dashboard');
    body += p('<span style="font-size:13px;color:#47537C">This link works once and expires in 72 hours. You can request a new one from the login page.</span>');
  } else {
    body += p('A member of our partnerships team will contact you within two working days to talk about your territory.');
  }
  return {
    to: email,
    subject: hasDashboard ? 'Your Partnermybusiness dashboard is ready' : 'We’ve received your enquiry',
    html: layout('Enquiry received', body),
    text: `Hi ${first}, thank you for your enquiry. ${hasDashboard ? `Open your dashboard: ${link}` : 'Our team will contact you within two working days.'}`
  };
}

// 2. To the PMB team inbox: full enquiry + proof of terms acceptance
function teamEnquiry(e) {
  const body = p('A new enquiry arrived from the website.') + table([
    ['Enquiry type', e.roleName], ['Name', e.name], ['Business or brand', e.business], ['Email', e.email],
    ['Phone or WhatsApp', e.phone], ['Business or profession', e.businessType], ['Location', e.location],
    ['Offer', e.offer], ['Territory', e.territory], ['Notes', e.message], ['Dashboard plan', e.plan],
    ['Terms accepted', `Yes, version ${e.termsVersion}, ${new Date(e.termsAcceptedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`],
    ['Dashboard', e.handle ? `${e.handle} (${e.existingAccount ? 'existing account' : 'activation link sent'})` : 'Not applicable']
  ]) + button(`${APP_URL()}/login.html`, 'Open the admin dashboard');
  return {
    to: TEAM_INBOX(),
    replyTo: e.email || undefined,
    subject: `Partnermybusiness enquiry: ${e.roleName}${e.business ? ', ' + e.business : ''}`,
    html: layout('New website enquiry', body),
    text: `New enquiry from ${e.name} (${e.email || e.phone}).`
  };
}

// 3. Password / login link (resend or forgot password)
function loginLink({ name, email, link, purpose }) {
  const first = String(name || '').split(' ')[0] || 'there';
  const body = p(`Hi ${esc(first)}, here is your link to ${purpose === 'reset' ? 'set a new password' : 'open your dashboard'}.`)
    + button(link, purpose === 'reset' ? 'Set a new password' : 'Open my dashboard')
    + p('<span style="font-size:13px;color:#47537C">This link works once and expires in 72 hours. If you didn’t ask for it, you can ignore this email.</span>');
  return { to: email, subject: 'Your Partnermybusiness login link', html: layout('Your login link', body), text: `Open: ${link}` };
}

// 4. To a business: new booking request with an accept CTA
function bookingRequested({ business, booking }) {
  const body = p(`You have a new booking request for ${esc(business.business?.businessName || business.name)}.`) + table([
    ['Booking', booking.eventType], ['From', booking.requesterName + (booking.leadGenName ? `, ${booking.leadGenName}` : '')],
    ['Date', fmtDate(booking.eventDate)], ['Guests', booking.guests], ['Budget', booking.amount ? inr(booking.amount) : ''],
    ['Message', booking.message]
  ]) + p('Review the revenue split and the partner terms, then accept or decline from your dashboard.')
    + button(`${APP_URL()}/login.html?next=business.html%23bookings`, 'Review and accept');
  return { to: business.email, subject: `New booking request: ${booking.eventType}`, html: layout('New booking request', body), text: `New booking request: ${booking.eventType}` };
}

// 5. To the person who booked + the business: booking confirmed
function bookingAccepted({ business, booking, share }) {
  const venue = business.business?.businessName || business.name;
  const rows = [['Booking', booking.eventType], ['Venue', venue], ['Date', fmtDate(booking.eventDate)], ['Guests', booking.guests]];
  const meet = booking.meetLink ? button(booking.meetLink, 'Join the onboarding call') : p('Your PMB manager will send the onboarding call details shortly.');
  return [
    booking.requesterEmail && {
      to: booking.requesterEmail,
      subject: `Booking confirmed: ${booking.eventType} at ${venue}`,
      html: layout('Your booking is confirmed', p(`Hi ${esc(String(booking.requesterName).split(' ')[0])}, ${esc(venue)} has accepted your booking request.`) + table(rows) + meet),
      text: `${venue} accepted your booking.`
    },
    business.email && {
      to: business.email,
      subject: `You accepted: ${booking.eventType}`,
      html: layout('Booking accepted', p('You accepted this booking under the Partnermybusiness partner terms.') + table([...rows, ['Booking value', booking.amount ? inr(booking.amount) : ''], ['Your share', share != null ? inr(share) : '']]) + meet
        + button(`${APP_URL()}/login.html?next=business.html%23bookings`, 'View in your dashboard')),
      text: `You accepted ${booking.eventType}.`
    }
  ].filter(Boolean);
}

module.exports = { enquiryWelcome, teamEnquiry, loginLink, bookingRequested, bookingAccepted, APP_URL, TEAM_INBOX };
