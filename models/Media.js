const { createModel } = require('../utils/jsonModel');

module.exports = createModel('Media', {
  required: ['owner', 'kind', 'title', 'url'],
  enums: {
    kind: ['intro_video', 'training_video', 'course_pdf'],
    status: ['pending', 'approved', 'rejected']
  },
  defaults: { status: 'pending' },
  refs: {
    owner: ['User', false],
    reviewedBy: ['User', false]
  }
});
