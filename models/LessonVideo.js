const { createModel } = require('../utils/jsonModel');

// One AI presenter video per business type + lesson topic, made on first request and reused by everyone.
module.exports = createModel('LessonVideo', {
  required: ['key', 'topic', 'status'],
  enums: { status: ['processing', 'ready', 'failed'] },
  refs: { requestedBy: ['User', false] }
});
