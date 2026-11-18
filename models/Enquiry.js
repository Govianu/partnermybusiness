const { createModel } = require('../utils/jsonModel');

module.exports = createModel('Enquiry', {
  required: ['role', 'name', 'termsAccepted', 'termsVersion', 'termsAcceptedAt'],
  enums: { role: ['host', 'pro', 'partner', 'country'] },
  refs: { user: ['User', false] }
});
