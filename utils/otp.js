const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function createOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashOtp(email, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`${String(email).trim().toLowerCase()}:${code}`)
    .digest('hex');
}

function otpMatches(user, code) {
  if (!/^\d{6}$/.test(String(code || '')) || !/^[a-f0-9]{64}$/.test(String(user.emailOtpHash || ''))) return false;
  const expected = Buffer.from(user.emailOtpHash, 'hex');
  const actual = Buffer.from(hashOtp(user.email, code), 'hex');
  return crypto.timingSafeEqual(expected, actual);
}

async function issueOtpForUsers(users) {
  if (!Array.isArray(users) || !users.length) throw new Error('Cannot issue an email code without a profile');
  const code = createOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  await Promise.all(users.map(async user => {
    user.emailOtpHash = hashOtp(user.email, code);
    user.emailOtpExpiresAt = expiresAt;
    user.emailOtpAttempts = 0;
    await user.save();
  }));
  return code;
}

async function issueOtp(user) {
  return issueOtpForUsers([user]);
}

function clearOtp(user) {
  user.emailOtpHash = null;
  user.emailOtpExpiresAt = null;
  user.emailOtpAttempts = 0;
}

function recordOtpFailure(user) {
  user.emailOtpAttempts = (Number(user.emailOtpAttempts) || 0) + 1;
  if (user.emailOtpAttempts >= MAX_OTP_ATTEMPTS) clearOtp(user);
}

function otpIsActive(user, now = Date.now()) {
  const expiresAt = Date.parse(user.emailOtpExpiresAt || '');
  return Boolean(user.emailOtpHash) && Number.isFinite(expiresAt) && expiresAt > now;
}

module.exports = { MAX_OTP_ATTEMPTS, clearOtp, issueOtp, issueOtpForUsers, otpIsActive, otpMatches, recordOtpFailure };
