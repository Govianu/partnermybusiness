// Sends email through any SMTP provider (Gmail/Google Workspace, Zoho, Brevo, SendGrid, AWS SES...).
// Without SMTP settings, emails are saved to data/outbox/ and printed to the console,
// so the full flow can be tested locally before real email is switched on.
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const OUTBOX = path.join(__dirname, '..', 'data', 'outbox');
let transporter = null;

const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

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
    const info = await getTransporter().sendMail({ from: fromAddress(), to, subject, html, text, replyTo });
    return { sent: true, id: info.messageId };
  } catch (err) {
    // Email problems must never lose an enquiry: log and carry on
    console.error(`[mail] failed to send "${subject}" to ${to}:`, err.message);
    return { sent: false, error: err.message };
  }
}

async function verifyMail() {
  if (!mailConfigured()) return console.log('[mail] SMTP not set: emails go to data/outbox/ (see .env.example)');
  try { await getTransporter().verify(); console.log('[mail] SMTP connection OK'); }
  catch (err) { console.error('[mail] SMTP connection failed:', err.message); }
}

module.exports = { sendMail, mailConfigured, verifyMail };
