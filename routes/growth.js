// Shared by the business and professional dashboards: skills, lesson progress and the
// always-visible call to action (which creates a CRM lead and emails the PMB team).
const router = require('express').Router();
const Lead = require('../models/Lead');
const { requireAuth } = require('../middleware/auth');
const { industryFor } = require('../utils/industry');
const { sendMail } = require('../utils/mailer');
const { ctaRequest } = require('../utils/emails');
const rateLimit = require('../utils/rateLimit');
const { fail, str } = require('../utils/http');

router.use(requireAuth('business', 'associate'));

const cleanSkills = list => (Array.isArray(list) ? list : String(list || '').split(','))
  .map(x => str(String(x)).slice(0, 60)).filter(Boolean)
  .filter((x, i, all) => all.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i)
  .slice(0, 12);

router.get('/', async (req, res) => {
  res.json({ industry: industryFor(req.user), skills: req.user.skills || req.user.associate?.skills || [], lessonsWatched: req.user.lessonsWatched || [] });
});

router.patch('/skills', async (req, res) => {
  const skills = cleanSkills(req.body?.skills);
  if (!skills.length) throw fail('Pick or type at least one skill');
  const u = req.user;
  u.skills = skills;
  if (u.role === 'associate') { u.associate = u.associate || {}; u.associate.skills = skills; }
  await u.save();
  res.json({ skills });
});

router.post('/lessons/watched', async (req, res) => {
  const key = str(req.body?.key).slice(0, 120);
  if (!key) throw fail('Missing lesson');
  const u = req.user;
  const list = Array.isArray(u.lessonsWatched) ? u.lessonsWatched : [];
  if (!list.includes(key)) list.push(key);
  u.lessonsWatched = list.slice(-60);
  await u.save();
  res.json({ lessonsWatched: u.lessonsWatched });
});

// What each call to action asks the team to do
const ACTIONS = {
  growth_call: 'Book a growth call',
  launch_idea: 'Help me launch an idea',
  find_partner: 'Find me a partner',
  find_work: 'Find me paid work',
  run_workshop: 'Help me run a workshop'
};

router.post('/cta', rateLimit(6, 60 * 60 * 1000), async (req, res) => {
  const action = ACTIONS[req.body?.action] ? req.body.action : 'growth_call';
  const topic = str(req.body?.topic).slice(0, 160);
  const note = str(req.body?.note).slice(0, 1000);
  const preferred = str(req.body?.preferredTime).slice(0, 80);
  const u = req.user;
  const industry = industryFor(u);
  const label = ACTIONS[action];
  const company = u.business?.businessName || '';

  await Lead.create({
    name: u.name, company, email: u.email, phone: u.phone, source: 'dashboard', relatedUser: u._id, stage: 'new',
    notes: [label, topic, industry.display, note].filter(Boolean).join(' | '),
    history: [{ stage: 'new', note: `${label}${topic ? `: ${topic}` : ''} (from the ${industry.label} dashboard)`, at: new Date().toISOString() }]
  });
  const mail = await sendMail(ctaRequest({ user: u, industry, label, topic, note, preferred }));
  res.status(201).json({ ok: true, label, emailed: !!mail.sent });
});

module.exports = router;
