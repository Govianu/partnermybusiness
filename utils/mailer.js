// Uses Brevo's HTTPS API when configured, otherwise sends through SMTP.
// Without a provider, emails are saved to data/outbox/ for local testing.
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const OUTBOX = path.join(__dirname, '..', 'data', 'outbox');
const BREVO_API = 'https://api.brevo.com/v3';
let transporter = null;

const brevoConfigured = () => Boolean(process.env.BREVO_API_KEY);
const mailConfigured = () => brevoConfigured() || Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

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

function brevoSender() {
  const raw = fromAddress().trim();
  const match = raw.match(/^(.*?)\s*<([^<>]+)>$/);
  if (!match) return { email: raw };
  const name = match[1].trim().replace(/^["']|["']$/g, '');
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
}

async function brevoRequest(endpoint, { method = 'GET', body } = {}) {
  const response = await fetch(`${BREVO_API}${endpoint}`, {
    method,
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof result?.message === 'string' ? result.message : `Brevo API request failed (${response.status})`);
  }
  return result;
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
    if (brevoConfigured()) {
      const body = {
        sender: brevoSender(),
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(text ? { textContent: text } : {}),
        ...(replyTo ? { replyTo: { email: replyTo } } : {})
      };
      const result = await brevoRequest('/smtp/email', { method: 'POST', body });
      return { sent: true, id: result?.messageId };
    }
    const info = await getTransporter().sendMail({ from: fromAddress(), to, subject, html, text, replyTo });
    return { sent: true, id: info.messageId };
  } catch (err) {
    // Email problems must never lose an enquiry: log and carry on
    console.error(`[mail] failed to send "${subject}" to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function verifyMail() {
  if (!mailConfigured()) return console.log('[mail] No email provider set: emails go to data/outbox/ (see .env.example)');
  if (brevoConfigured()) {
    try { await brevoRequest('/account'); console.log('[mail] Brevo API connection OK'); }
    catch (err) { console.error('[mail] Brevo API connection failed:', err.message); }
    return;
  }
  try { await getTransporter().verify(); console.log('[mail] SMTP connection OK'); }
  catch (err) { console.error('[mail] SMTP connection failed:', err.message); }
}

module.exports = { sendMail, mailConfigured, verifyMail };
