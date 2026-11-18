const { createModel } = require('../utils/jsonModel');

module.exports = createModel('Booking', {
  required: ['business', 'requesterName', 'eventType'],
  enums: {
    splitModel: ['four_way', 'infra_first'],
    status: ['requested', 'accepted', 'declined', 'completed'],
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
  refs: { business: ['User', false] }
});
