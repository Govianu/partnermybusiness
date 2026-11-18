const router = require('express').Router();
const Booking = require('../models/Booking');
const Opportunity = require('../models/Opportunity');
const Lead = require('../models/Lead');
const { requireAuth } = require('../middleware/auth');
const { computeSplit } = require('../utils/split');
const { createMeeting, meetConfigured } = require('../utils/meet');
const { generateOpportunities } = require('../utils/ai');
const { fail } = require('../utils/http');
const { sendMail } = require('../utils/mailer');
const { bookingAccepted } = require('../utils/emails');

router.use(requireAuth('business'));

router.get('/dashboard', async (req, res) => {
  const [opportunities, bookings] = await Promise.all([
    Opportunity.find({ business: req.user._id, status: { $ne: 'dismissed' } }).sort({ createdAt: -1 }),
    Booking.find({ business: req.user._id }).sort({ createdAt: -1 }).limit(100)
  ]);
  const withSplit = bookings.map(b => ({
    ...b.toJSON(),
    split: computeSplit(b.amount, b.splitModel, b.partnerShare)
  }));
  const yourShare = withSplit
    .filter(b => b.status === 'accepted' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.split.lines.find(l => l.party === 'business')?.amountInr || 0), 0);

  res.json({
    opportunities,
    bookings: withSplit,
    stats: {
      pending: bookings.filter(b => b.status === 'requested').length,
      accepted: bookings.filter(b => b.status === 'accepted').length,
      yourShare,
      potentialMonthly: opportunities.reduce((s, o) => s + (o.estMonthly || 0), 0)
    },
    meetConfigured: meetConfigured()
  });
});

router.post('/opportunities/refresh', async (req, res) => {
  const u = req.user;
  const ops = await generateOpportunities({ name: u.business?.businessName || u.name, category: u.category, location: u.location });
  await Opportunity.deleteMany({ business: u._id, status: 'suggested' });
  const created = await Opportunity.insertMany(ops.map(o => ({ ...o, business: u._id })));
  res.json({ opportunities: created });
});

router.patch('/opportunities/:id', async (req, res) => {
  const status = req.body?.status;
  if (!['interested', 'dismissed', 'suggested'].includes(status)) throw fail('Unknown status');
  const op = await Opportunity.findOneAndUpdate({ _id: req.params.id, business: req.user._id }, { status }, { new: true });
  if (!op) throw fail('Opportunity not found', 404);
  if (status === 'interested') {
    await Lead.create({
      name: req.user.business?.businessName || req.user.name,
      phone: req.user.phone, email: req.user.email,
      source: 'manual', relatedUser: req.user._id,
      notes: `Interested in: ${op.title}`,
      history: [{ stage: 'new', note: `Business tapped "I'm interested" on ${op.title}` }]
    });
  }
  res.json({ opportunity: op });
});

router.post('/bookings/:id/accept', async (req, res) => {
  if (req.body?.agreementAccepted !== true) throw fail('Tick the partner agreement to accept this booking');
  const booking = await Booking.findOne({ _id: req.params.id, business: req.user._id });
  if (!booking) throw fail('Booking not found', 404);
  if (booking.status !== 'requested') throw fail(`This booking is already ${booking.status}`);

  booking.status = 'accepted';
  booking.agreementAccepted = true;
  booking.agreementAcceptedAt = new Date();

  try {
    const meet = await createMeeting({
      summary: `PMB onboarding: ${booking.eventType} at ${req.user.business?.businessName || req.user.name}`,
      description: `Booking ${booking._id}\nRequested by ${booking.requesterName}\nGuests: ${booking.guests || '-'}\nAmount: ₹${booking.amount}`,
      attendees: [req.user.email, booking.requesterEmail]
    });
    booking.meetLink = meet.link;
    booking.meetEventId = meet.eventId;
  } catch (err) {
    console.error('Meet creation failed:', err.message);
  }

  await booking.save();
  await Lead.updateOne(
    { relatedBooking: booking._id },
    { $set: { stage: 'signed' }, $push: { history: { stage: 'signed', note: 'Business accepted with digital agreement', proofUrl: `booking:${booking._id}`, by: req.user._id } } }
  );
  const split = computeSplit(booking.amount, booking.splitModel, booking.partnerShare);
  const share = split.lines.find(l => l.party === 'business')?.amountInr;
  for (const mail of bookingAccepted({ business: req.user, booking, share })) await sendMail(mail);
  res.json({ booking: { ...booking.toJSON(), split } });
});

router.post('/bookings/:id/decline', async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, business: req.user._id, status: 'requested' },
    { status: 'declined' },
    { new: true }
  );
  if (!booking) throw fail('Booking not found or already handled', 404);
  res.json({ booking });
});

router.patch('/profile', async (req, res) => {
  const b = req.body || {};
  const u = req.user;
  for (const key of ['address', 'idleSlots', 'razorpayAccountId']) {
    if (typeof b[key] === 'string') u.business[key] = b[key].trim();
  }
  if (typeof b.phone === 'string') u.phone = b.phone.trim();
  await u.save();
  res.json({ user: u });
});

module.exports = router;
