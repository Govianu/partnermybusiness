// Builds a Razorpay order with Route transfers from the split engine.
// Platform share is not transferred — it stays in the PMB account.
const { computeSplit } = require('./split');

function buildOrderPayload(booking, businessAccountId) {
  const split = computeSplit(booking.amount, booking.splitModel, booking.partnerShare);
  const accounts = {
    infrastructure: process.env.RAZORPAY_INFRA_ACCOUNT,
    business: businessAccountId,
    leadgen: booking.leadGenAccountId || process.env.RAZORPAY_LEADGEN_ACCOUNT
  };

  const transfers = [];
  const missing = [];
  for (const line of split.lines) {
    if (line.party === 'platform' || line.paise === 0) continue;
    const account = accounts[line.party];
    if (!account) { missing.push(line.label); continue; }
    transfers.push({
      account,
      amount: line.paise,
      currency: 'INR',
      notes: { booking: String(booking._id), party: line.party },
      on_hold: 0
    });
  }

  return {
    split,
    missing,
    payload: {
      amount: Math.round(booking.amount * 100),
      currency: 'INR',
      receipt: `pmb_${booking._id}`.slice(0, 40),
      notes: { booking: String(booking._id), model: booking.splitModel },
      transfers
    }
  };
}

async function createOrder(payload) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error?.description || 'Razorpay error'), { status: 502, expose: true });
  return data;
}

const razorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

module.exports = { buildOrderPayload, createOrder, razorpayConfigured };
