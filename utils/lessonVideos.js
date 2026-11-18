// Make-on-first-request AI presenter videos, reused by everyone with the same business type + topic.
// A background job finishes videos even if the person closes the page, downloads each finished file
// (HeyGen links expire after 7 days) and keeps monthly usage under HEYGEN_MONTHLY_MINUTES.
const fs = require('fs');
const path = require('path');
const LessonVideo = require('../models/LessonVideo');
const heygen = require('./heygen');
const { DATA_DIR } = require('./jsonModel');

const DIR = path.join(DATA_DIR, 'lesson-videos');
const MAX_PARALLEL = 3;
const monthlyCap = () => Number(process.env.HEYGEN_MONTHLY_MINUTES) || 60;
// About 150 spoken words a minute: used to reserve minutes before HeyGen reports the real length
const estimateMinutes = script => Math.max(0.5, String(script).split(/\s+/).length / 150);

function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); }

async function minutesUsedThisMonth() {
  const rows = await LessonVideo.find({ createdAt: { $gte: startOfMonth() } });
  return rows.filter(v => v.status !== 'failed' && !v.testMode)
    .reduce((sum, v) => sum + (v.durationSec ? v.durationSec / 60 : estimateMinutes(v.script)), 0);
}

function publicView(v) {
  if (!v) return null;
  return {
    id: v._id, key: v.key, topic: v.topic, status: v.status,
    url: v.status === 'ready' ? `/api/lesson-videos/${v._id}/file` : null,
    poster: v.status === 'ready' && v.thumbFile ? `/api/lesson-videos/${v._id}/poster` : null,
    durationSec: v.durationSec || null, testMode: Boolean(v.testMode), error: v.status === 'failed' ? 'This video could not be made.' : null
  };
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// Ask HeyGen how one video is doing; when finished, keep our own copy
async function refresh(video) {
  if (video.status !== 'processing' || !video.heygenVideoId) return video;
  const s = await heygen.videoStatus(video.heygenVideoId);
  video.checkedAt = new Date().toISOString();
  if (s.status === 'completed' && s.video_url) {
    const file = path.join(DIR, `${video._id}.mp4`);
    await download(s.video_url, file);
    if (s.thumbnail_url) { try { await download(s.thumbnail_url, path.join(DIR, `${video._id}.jpg`)); video.thumbFile = `${video._id}.jpg`; } catch { /* poster is optional */ } }
    Object.assign(video, { status: 'ready', file: `${video._id}.mp4`, durationSec: Number(s.duration) || null, readyAt: new Date().toISOString() });
  } else if (s.status === 'failed') {
    Object.assign(video, { status: 'failed', error: String(s.error?.message || s.error?.detail || 'failed').slice(0, 300) });
    console.error(`[lesson-video] HeyGen failed for "${video.key}":`, video.error);
  }
  await video.save();
  return video;
}

// Returns the existing video for this lesson, or starts making one
async function requestVideo({ lesson, user }) {
  const existing = await LessonVideo.findOne({ key: lesson.key });
  if (existing && existing.status !== 'failed') return { video: existing };
  if (!heygen.configured()) return { unavailable: 'not_configured' };

  const processing = await LessonVideo.countDocuments({ status: 'processing' });
  if (processing >= MAX_PARALLEL) return { unavailable: 'busy' };
  if (!heygen.testMode() && (await minutesUsedThisMonth()) + estimateMinutes(lesson.script) > monthlyCap()) {
    console.warn(`[lesson-video] Monthly cap of ${monthlyCap()} minutes reached; "${lesson.key}" shows the slide version.`);
    return { unavailable: 'monthly_limit' };
  }

  const heygenVideoId = await heygen.createVideo({ script: lesson.script, title: lesson.title });
  const fields = { key: lesson.key, sectorId: lesson.sectorId, topic: lesson.topic, kind: lesson.kind, script: lesson.script,
    status: 'processing', heygenVideoId, testMode: heygen.testMode(), requestedBy: user._id, error: null };
  let video;
  if (existing) { Object.assign(existing, fields); video = await existing.save(); }
  else video = await LessonVideo.create(fields);
  console.log(`[lesson-video] Started "${lesson.key}" (${heygenVideoId})`);
  return { video };
}

// Background job: finish videos even when nobody is watching the page
let timer = null;
function startWorker() {
  if (timer || !heygen.configured()) return;
  timer = setInterval(async () => {
    try {
      const pending = await LessonVideo.find({ status: 'processing' });
      for (const v of pending) {
        try { await refresh(v); } catch (err) { console.error(`[lesson-video] check failed for "${v.key}":`, err.message); }
      }
    } catch (err) { console.error('[lesson-video] worker error:', err.message); }
  }, 20000);
  timer.unref?.();
  console.log(`[lesson-video] AI presenter videos on${heygen.testMode() ? ' (TEST MODE: free, watermarked)' : ''}; monthly cap ${monthlyCap()} minutes`);
}

module.exports = { requestVideo, refresh, publicView, minutesUsedThisMonth, monthlyCap, startWorker, DIR };
