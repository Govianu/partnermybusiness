// Public endpoints: anyone with a business's handle can view it and request a booking.
const router = require('express').Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Lead = require('../models/Lead');
const { fail, str } = require('../utils/http');
const { sendMail } = require('../utils/mailer');
const { bookingRequested } = require('../utils/emails');

router.get('/profile/:handle', async (req, res) => {
  const user = await User.findOne({ handle: req.params.handle.toLowerCase(), role: { $in: ['business', 'associate'] } });
  if (!user) throw fail('No profile with that handle', 404);
  res.json({
    profile: {
      handle: user.handle,
      role: user.role,
      name: user.role === 'business' ? user.business?.businessName : user.name,
      category: user.category,
      location: user.location,
      idleSlots: user.business?.idleSlots,
      skill: user.associate?.skill,
      bio: user.associate?.bio
    }
  });
});

router.post('/bookings/:handle', async (req, res) => {
  const b = req.body || {};
  const business = await User.findOne({ handle: req.params.handle.toLowerCase(), role: 'business' });
  if (!business) throw fail('No business with that handle', 404);
  if (!str(b.requesterName)) throw fail('Enter your name');
  if (!str(b.requesterEmail) && !str(b.requesterPhone)) throw fail('Enter an email or phone number so the venue can reach you');
  if (!str(b.eventType)) throw fail('Tell the venue what the booking is for');

  const booking = await Booking.create({
    business: business._id,
    requesterName: str(b.requesterName),
    requesterEmail: str(b.requesterEmail),
    requesterPhone: str(b.requesterPhone),
    eventType: str(b.eventType),
    eventDate: b.eventDate ? new Date(b.eventDate) : undefined,
    guests: Number(b.guests) || undefined,
    amount: Math.max(0, Number(b.amount) || 0),
    message: str(b.message),
    leadGenName: str(b.leadGenName)
  });
  await Lead.create({
    name: booking.requesterName, company: booking.leadGenName, email: booking.requesterEmail, phone: booking.requesterPhone,
    source: 'booking', relatedUser: business._id, relatedBooking: booking._id,
    history: [{ stage: 'new', note: `Booking request: ${booking.eventType} at ${business.handle}` }]
  });
  if (business.email) await sendMail(bookingRequested({ business, booking }));
  res.status(201).json({ ok: true, bookingId: booking._id });
});

module.exports = router;
