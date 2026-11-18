const router = require('express').Router();
const Gig = require('../models/Gig');
const Media = require('../models/Media');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { computeSplit } = require('../utils/split');
const { fail, str } = require('../utils/http');

router.use(requireAuth('associate'));

router.get('/dashboard', async (req, res) => {
  const me = req.user;
  await me.populate('assignedManager', 'name email phone');
  const [media, openGigs, myGigs] = await Promise.all([
    Media.find({ owner: me._id }).sort({ createdAt: -1 }),
    Gig.find({ status: 'open', $or: [{ location: me.location }, { location: { $exists: false } }, { location: '' }] })
      .populate('venue', 'business.businessName handle location')
      .sort({ date: 1 }).limit(50),
    Gig.find({ $or: [{ host: me._id }, { applicants: me._id }] })
      .populate('venue', 'business.businessName handle location')
      .sort({ createdAt: -1 })
  ]);

  const approvedVideo = media.some(m => m.kind === 'intro_video' && m.status === 'approved');
  const steps = [
    { key: 'profile', label: 'Profile created', done: true },
    { key: 'video', label: 'Intro video uploaded', done: media.some(m => m.kind === 'intro_video') },
    { key: 'validated', label: 'Video validated by PMB team', done: approvedVideo },
    { key: 'live', label: 'Profile live for bookings', done: me.status === 'approved' }
  ];

  res.json({
    user: me,
    steps,
    media,
    openGigs: openGigs.filter(g => !g.applicants.some(a => String(a) === String(me._id))),
    myGigs
  });
});

router.post('/media', async (req, res) => {
  const b = req.body || {};
  if (!['intro_video', 'training_video', 'course_pdf'].includes(b.kind)) throw fail('Choose what you are uploading');
  if (!str(b.title)) throw fail('Give your upload a title');
  if (!/^https?:\/\//i.test(str(b.url))) throw fail('Paste a link that starts with https:// (Google Drive, YouTube...)');
  const media = await Media.create({
    owner: req.user._id, kind: b.kind, title: str(b.title), description: str(b.description), url: str(b.url)
  });
  res.status(201).json({ media });
});

router.post('/gigs/workshop', async (req, res) => {
  const b = req.body || {};
  const pricePerSeat = Number(b.pricePerSeat);
  const seats = Number(b.seats);
  if (!str(b.title)) throw fail('Give your workshop a title');
  if (!(pricePerSeat > 0) || !(seats > 0)) throw fail('Enter a seat price and number of seats');

  let venue;
  if (str(b.venueHandle)) {
    venue = await User.findOne({ handle: str(b.venueHandle).toLowerCase(), role: 'business' });
    if (!venue) throw fail('No partner venue with that handle');
  }
  const gig = await Gig.create({
    type: 'workshop',
    title: str(b.title),
    description: str(b.description),
    location: req.user.location,
    category: req.user.category,
    host: req.user._id,
    venue: venue?._id,
    date: b.date ? new Date(b.date) : undefined,
    durationHours: Number(b.durationHours) || undefined,
    pricePerSeat, seats,
    status: 'proposed',
    createdBy: req.user._id
  });
  res.status(201).json({ gig, split: computeSplit(pricePerSeat * seats, 'four_way') });
});

router.post('/gigs/:id/apply', async (req, res) => {
  const gig = await Gig.findOne({ _id: req.params.id, type: 'shift', status: 'open' });
  if (!gig) throw fail('This shift is no longer open', 404);
  if (gig.applicants.some(a => String(a) === String(req.user._id))) throw fail('You have already applied');
  gig.applicants.push(req.user._id);
  await gig.save();
  res.json({ gig });
});

router.patch('/profile', async (req, res) => {
  const b = req.body || {};
  const u = req.user;
  for (const key of ['availability', 'bio']) if (typeof b[key] === 'string') u.associate[key] = b[key].trim();
  if (b.experienceYears !== undefined) u.associate.experienceYears = Number(b.experienceYears) || 0;
  if (typeof b.phone === 'string') u.phone = b.phone.trim();
  await u.save();
  res.json({ user: u });
});

module.exports = router;
