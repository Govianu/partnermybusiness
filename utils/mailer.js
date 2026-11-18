// Sends email in one of two ways:
//  1. Brevo email API over HTTPS (BREVO_API_KEY). Works on hosts that block email ports, such as Render's free plan.
//  2. Any SMTP provider (SMTP_HOST/SMTP_USER/SMTP_PASS): Zoho, Google Workspace, Brevo SMTP, SendGrid...
// With neither set, emails are saved to data/outbox/ and printed to the console, so the flow can be tested locally.
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const OUTBOX = path.join(__dirname, '..', 'data', 'outbox');
const BREVO_BASE = () => String(process.env.BREVO_API_BASE || 'https://api.brevo.com/v3').replace(/\/+$/, ''); // override only for testing
let transporter = null;

const brevoConfigured = () => Boolean(process.env.BREVO_API_KEY);
const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const mailConfigured = () => brevoConfigured() || smtpConfigured();

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
}

const fromAddress = () => process.env.MAIL_FROM || `Partnermybusiness.ai <${process.env.SMTP_USER || 'info@partnermybusiness.ai'}>`;

// "Partnermybusiness.ai <info@partnermybusiness.ai>" -> { name, email }
function parseAddress(value) {
  const m = String(value || '').match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: String(value || '').trim() };
}

async function sendViaBrevo({ to, subject, html, text, replyTo }) {
  const body = {
    sender: parseAddress(fromAddress()),
    to: String(to).split(',').map(x => ({ email: x.trim() })).filter(x => x.email),
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
    ...(replyTo ? { replyTo: parseAddress(replyTo) } : {})
  };
  const res = await fetch(`${BREVO_BASE()}/smtp/email`, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.code || `Brevo request failed (${res.status})`);
  return data.messageId;
}

async function sendMail({ to, subject, html, text, replyTo }) {
  if (!to) return { sent: false, reason: 'no recipient' };
  if (!mailConfigured()) {
    fs.mkdirSync(OUTBOX, { recursive: true });
    const file = path.join(OUTBOX, `${Date.now()}-${String(to).replace(/[^a-z0-9@._-]/gi, '_')}.html`);
    fs.writeFileSync(file, `<!-- To: ${to}\n     Subject: ${subject} -->\n${html}`);
    console.log(`[mail:outbox] "${subject}" -> ${to} (saved to ${path.relative(process.cwd(), file)})`);
    return { sent: false, outbox: file };
  }
  try {
    if (brevoConfigured()) return { sent: true, id: await sendViaBrevo({ to, subject, html, text, replyTo }) };
    const info = await getTransporter().sendMail({ from: fromAddress(), to, subject, html, text, replyTo });
    return { sent: true, id: info.messageId };
  } catch (err) {
    // Email problems must never lose an enquiry: log and carry on
    console.error(`[mail] failed to send "${subject}" to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function verifyMail() {
  if (brevoConfigured()) {
    try {
      const res = await fetch(`${BREVO_BASE()}/account`, { headers: { 'api-key': process.env.BREVO_API_KEY, accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status} ${data.message || ''}`.trim());
      console.log(`[mail] Brevo email API OK (account: ${data.email || 'connected'}); sending as ${fromAddress()}`);
    } catch (err) { console.error('[mail] Brevo API key check failed:', err.message); }
    return;
  }
  if (!smtpConfigured()) return console.log('[mail] Email not set: emails go to data/outbox/ (see .env.example)');
  try { await getTransporter().verify(); console.log('[mail] SMTP connection OK'); }
  catch (err) { console.error('[mail] SMTP connection failed:', err.message, '(on Render\'s free plan email ports are blocked: use BREVO_API_KEY instead)'); }
}

module.exports = { sendMail, mailConfigured, verifyMail };
