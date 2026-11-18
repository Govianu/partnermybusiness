const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const previousDataDir = process.env.DATA_DIR;
const testDataDir = path.join(os.tmpdir(), 'pmb-lesson-video-data');
process.env.DATA_DIR = testDataDir;
const { DIR } = require('../utils/lessonVideos');
if (previousDataDir === undefined) delete process.env.DATA_DIR;
else process.env.DATA_DIR = previousDataDir;

test('lesson videos are stored under the configured data directory', () => {
  assert.equal(DIR, path.join(testDataDir, 'lesson-videos'));
});
