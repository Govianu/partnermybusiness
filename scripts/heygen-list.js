// Lists the HeyGen avatars and voices on your account, to pick HEYGEN_AVATAR_ID and HEYGEN_VOICE_ID.
// Run: npm run heygen:list            (all)      npm run heygen:list -- india   (filter by text)
require('dotenv').config();
const { listAvatarsAndVoices } = require('../utils/heygen');
(async () => {
  if (!process.env.HEYGEN_API_KEY) { console.error('Set HEYGEN_API_KEY in .env first.'); process.exit(1); }
  const filter = (process.argv[2] || '').toLowerCase();
  const { avatars, voices } = await listAvatarsAndVoices();
  const hit = o => !filter || JSON.stringify(o).toLowerCase().includes(filter);
  console.log('\nAVATARS (HEYGEN_AVATAR_ID)');
  avatars.filter(hit).slice(0, 60).forEach(a => console.log(`  ${a.avatar_id}   ${a.avatar_name || ''} ${a.gender ? '(' + a.gender + ')' : ''}  ${a.preview_image_url || ''}`));
  console.log('\nVOICES (HEYGEN_VOICE_ID)');
  voices.filter(hit).slice(0, 60).forEach(v => console.log(`  ${v.voice_id}   ${v.name || ''}  ${v.language || ''} ${v.gender ? '(' + v.gender + ')' : ''}  ${v.preview_audio || ''}`));
})().catch(err => { console.error(err.message); process.exit(1); });
