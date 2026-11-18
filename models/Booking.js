const { createModel } = require('../utils/jsonModel');

module.exports = createModel('Booking', {
  required: ['business', 'requesterName', 'eventType'],
  enums: {
    splitModel: ['four_way', 'infra_first'],
    // pending_review: with the PMB team (we're the third party); requested: forwarded to the seller
    status: ['pending_review', 'requested', 'accepted', 'declined', 'completed', 'cancelled'],
    'payment.status': ['none', 'created', 'paid']
  },
  defaults: {
    amount: 0,
    splitModel: 'four_way',
    partnerShare: 50,
    status: 'requested',
    agreementAccepted: false,
    payment: { status: 'none' }
  },
  // business = the seller (a business or a professional); buyer = logged-in buyer, if any
  refs: { business: ['User', false], buyer: ['User', false], listing: ['Listing', false] }
});
