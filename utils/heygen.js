// HeyGen API client for AI presenter lesson videos.
// Docs: https://docs.heygen.com/docs/create-video
//   POST /v2/video/generate         -> { data: { video_id } }
//   GET  /v1/video_status.get?video_id=  -> { data: { status, video_url, thumbnail_url, duration, error } }
// The video_url HeyGen returns expires after 7 days, so finished videos are downloaded and kept on our disk.
const BASE = String(process.env.HEYGEN_API_BASE || 'https://api.heygen.com').replace(/\/+$/, ''); // override only for testing

const configured = () => Boolean(process.env.HEYGEN_API_KEY && process.env.HEYGEN_AVATAR_ID && process.env.HEYGEN_VOICE_ID);
const testMode = () => /^(1|true|yes)$/i.test(process.env.HEYGEN_TEST_MODE || '');

async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { 'X-Api-Key': process.env.HEYGEN_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body.error?.message || body.message || `HeyGen request failed (${res.status})`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return body.data;
}

async function createVideo({ script, title }) {
  const data = await call('/v2/video/generate', {
    method: 'POST',
    body: JSON.stringify({
      title: String(title || 'Partnermybusiness lesson').slice(0, 100),
      test: testMode(),
      video_inputs: [{
        character: { type: 'avatar', avatar_id: process.env.HEYGEN_AVATAR_ID, avatar_style: process.env.HEYGEN_AVATAR_STYLE || 'normal' },
        voice: { type: 'text', input_text: script, voice_id: process.env.HEYGEN_VOICE_ID, speed: Number(process.env.HEYGEN_VOICE_SPEED) || 1 },
        background: { type: 'color', value: process.env.HEYGEN_BACKGROUND || '#F6F8FC' }
      }],
      dimension: { width: 1280, height: 720 }
    })
  });
  if (!data?.video_id) throw new Error('HeyGen did not return a video ID');
  return data.video_id;
}

async function videoStatus(videoId) {
  return call(`/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, { method: 'GET' });
}

// For choosing an avatar and voice: npm run heygen:list
async function listAvatarsAndVoices() {
  const [avatars, voices] = await Promise.all([call('/v2/avatars', { method: 'GET' }), call('/v2/voices', { method: 'GET' })]);
  return { avatars: avatars?.avatars || [], voices: voices?.voices || [] };
}

module.exports = { configured, testMode, createVideo, videoStatus, listAvatarsAndVoices };
