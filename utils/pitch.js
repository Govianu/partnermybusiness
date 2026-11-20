// How we talk about opportunities and savings to leads: show WHAT they can earn or save, and the part that is
// hard to do alone, which is the part Partnermybusiness does. We never hand over do-it-yourself steps; the
// details (which partner, the exact split, the supplier rates) are for the PMB manager call.

const PITCH = {
  hook: 'The idea is the easy part. The hard part is finding a partner you can trust, agreeing a fair split, bringing in customers for the new slot and getting everyone paid on time. That is the part we do.',
  deal: 'Your part: say yes to the slot. Our part: everything else.',
  call: 'On a short call your PMB manager shows you which partner, the exact split and your first-month numbers.'
};

// The hard part of a cost-saving lever, and what PMB does about it
const SAVING_RULES = [
  [/rent out|shelf|wall space|sponsored/i, 'Finding brands or tenants who pay on time, and a contract that protects you.', 'We bring the brands and tenants, write the contract and collect the payments.'],
  [/direct|sourcing|distributor|manufacturer|farmer|producer/i, 'Suppliers rarely sell direct to one business at a rate worth switching for.', 'We bring vetted suppliers from our network and lock in the rate for you.'],
  [/group|bulk|pooled|clustered|one marketing/i, 'One business alone cannot buy at volume prices.', 'We pool your order with other PMB partners, so you pay the volume rate.'],
  [/shar/i, 'Finding a nearby partner you trust, and an agreement that is fair to both.', 'We match you with a vetted partner nearby and set up the agreement and billing.'],
  [/solar|energy|power|metering|lighting|cooling|water|recycl|reuse/i, 'Picking a reliable installer, a fair quote and the financing.', 'Our vetted installers survey and quote, we arrange the financing, you approve.'],
  [/waste|forecast/i, 'Turning your sales data into a daily plan that actually cuts waste.', 'We read your sales data and build the plan with you.'],
  [/booking|commission/i, 'Getting customers to book you directly instead of through commission sites.', 'We send partner and corporate bookings straight to you.']
];

function savingPitch(lever) {
  const rule = SAVING_RULES.find(([re]) => re.test(lever.title)) || [null, 'Finding the right partners and agreeing the terms.', 'Your PMB manager sets it up with partners from our network.'];
  return { title: lever.title, saving: lever.saving, alone: rule[1], withUs: rule[2] };
}

// What each opportunity needs. Said once above the list; each item names the partner we bring for it.
const NEEDS = 'Each one needs a partner to run it, a written agreement, customers and billing. We bring all four.';
function partnerFor(partners, i) {
  const list = String(partners || '').split(/,\s*|\s+and\s+/).map(x => x.trim()).filter(Boolean);
  if (!list.length) return 'a vetted partner from our network';
  const x = list[i % list.length];
  return /^[A-Z]{2}/.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1);
}

module.exports = { PITCH, NEEDS, savingPitch, partnerFor };
