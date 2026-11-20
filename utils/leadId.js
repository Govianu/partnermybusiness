// Lead IDs: PMB-<month><year>-<number>, e.g. PMB-NOV26-01 for the first lead in November 2026.
// The same ID goes on the person's account and their CRM lead, and appears in team emails, the CTA and the
// dashboard, so everyone talks about one lead by one ID. Numbers restart each month and grow past 99 if needed.
const User = require('../models/User');
const Lead = require('../models/Lead');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function prefixFor(date = new Date()) {
  // Months follow India time, so a lead at 1 a.m. IST on the 1st counts in the new month
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return `PMB-${MONTHS[ist.getUTCMonth()]}${String(ist.getUTCFullYear()).slice(2)}-`;
}

async function nextLeadId(date = new Date()) {
  const prefix = prefixFor(date);
  const used = [...await User.find({}), ...await Lead.find({})]
    .map(x => String(x.leadId || ''))
    .filter(id => id.startsWith(prefix))
    .map(id => Number(id.slice(prefix.length)) || 0);
  const n = (used.length ? Math.max(...used) : 0) + 1;
  return prefix + String(n).padStart(2, '0');
}

// Give a user a lead ID (once) and create or tag their CRM lead with the same ID
async function assignLeadId(user, leadFields) {
  if (!user.leadId) {
    user.leadId = await nextLeadId();
    await user.save();
  }
  if (leadFields) {
    const existing = await Lead.findOne({ relatedUser: user._id, leadId: user.leadId });
    if (!existing) await Lead.create({ ...leadFields, relatedUser: user._id, leadId: user.leadId });
  }
  return user.leadId;
}

module.exports = { nextLeadId, assignLeadId, prefixFor };
