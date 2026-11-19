// One-time links: the "Open my dashboard" button in sign-up and sign-in emails (purpose 'signin'), and older
// activation links. Each link opens one exact dashboard, works once, and expires.
// Only a SHA-256 hash of the token is stored, so a leaked data file can't be used to log in.
const crypto = require('crypto');
const { APP_URL } = require('./emails');

const TTL_MS = 72 * 60 * 60 * 1000;
const SIGNIN_TTL_MS = 24 * 60 * 60 * 1000;   // the button in a code email
const hash = token => crypto.createHash('sha256').update(String(token)).digest('hex');

async function issueLink(user, purpose = 'activate', ttlMs = purpose === 'signin' ? SIGNIN_TTL_MS : TTL_MS) {
  const token = crypto.randomBytes(32).toString('hex');
  user.linkTokenHash = hash(token);
  user.linkTokenExpires = new Date(Date.now() + ttlMs).toISOString();
  user.linkTokenPurpose = purpose;
  await user.save();
  return `${APP_URL()}/activate.html?token=${token}`;
}

async function findByToken(User, token) {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return null;
  const user = await User.findOne({ linkTokenHash: hash(token) });
  if (!user || !user.linkTokenExpires || new Date(user.linkTokenExpires) < new Date()) return null;
  return user;
}

module.exports = { issueLink, findByToken };
