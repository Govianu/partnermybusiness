const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Opportunity = require('../models/Opportunity');
const { issueToken, requireAuth, COOKIE } = require('../middleware/auth');
const { uniqueHandle } = require('../utils/handle');
const { generateOpportunities, sopsFor } = require('../utils/ai');
const { fail, str } = require('../utils/http');
const { TERMS_VERSION } = require('../utils/terms');
const { issueLink, findByToken } = require('../utils/links');
const { sendMail, mailConfigured } = require('../utils/mailer');
const { loginLink } = require('../utils/emails');
const rateLimit = require('../utils/rateLimit');

const BUSINESS_CATEGORIES = ['restaurant', 'cafe', 'hotel', 'salon', 'gym', 'banquet_hall', 'office', 'other'];
const ASSOCIATE_SKILLS = ['chef', 'steward', 'cleaning_staff', 'bartender', 'baker', 'beautician', 'trainer', 'other'];

router.get('/options', (req, res) => res.json({ businessCategories: BUSINESS_CATEGORIES, associateSkills: ASSOCIATE_SKILLS }));

router.post('/signup', async (req, res) => {
  const b = req.body || {};
  const role = str(b.role);
  const name = str(b.name);
  const email = str(b.email).toLowerCase();
  const password = typeof b.password === 'string' ? b.password : '';
  const location = str(b.location);

  if (!['business', 'associate', 'admin'].includes(role)) throw fail('Choose whether you are a business or an associate');
  if (!name) throw fail('Enter your name');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail('Enter a valid email address');
  if (password.length < 8) throw fail('Use a password with at least 8 characters');
  if (b.termsAccepted !== true && b.termsAccepted !== 'true' && b.termsAccepted !== 'on') throw fail('Please agree to the Terms and Conditions to create your profile');
  if (role === 'admin' && (!process.env.ADMIN_INVITE_CODE || b.inviteCode !== process.env.ADMIN_INVITE_CODE)) {
    throw fail('That team invite code is not valid', 403);
  }
  if (role !== 'admin' && !location) throw fail('Enter your area, for example Sadashivnagar');
  if (await User.exists({ email })) throw fail('An account with this email already exists. Log in instead.', 409);

  const doc = {
    role, name, email,
    phone: str(b.phone),
    passwordHash: await bcrypt.hash(password, 10),
    location: location.toLowerCase(),
    status: role === 'admin' ? 'approved' : 'pending',
    termsAcceptedAt: new Date().toISOString(),
    termsVersion: TERMS_VERSION
  };

  if (role === 'business') {
    const businessName = str(b.businessName);
    const category = BUSINESS_CATEGORIES.includes(b.category) ? b.category : 'other';
    if (!businessName) throw fail('Enter your business name');
    Object.assign(doc, {
      category,
      slug: businessName,
      handle: await uniqueHandle(category, location, businessName),
      business: {
        businessName,
        address: str(b.address),
        mapsUrl: str(b.mapsUrl),
        idleSlots: str(b.idleSlots),
        sops: sopsFor(category)
      }
    });
  } else if (role === 'associate') {
    const skill = ASSOCIATE_SKILLS.includes(b.skill) ? b.skill : 'other';
    Object.assign(doc, {
      category: skill,
      slug: name,
      handle: await uniqueHandle(skill, location, name.split(' ')[0]),
      associate: {
        skill,
        experienceYears: Number(b.experienceYears) || 0,
        availability: str(b.availability),
        bio: str(b.bio)
      }
    });
  }

  const user = await User.create(doc);

  // Seed the opportunity feed in the background so signup stays fast
  if (role === 'business') {
    generateOpportunities({ name: user.business.businessName, category: user.category, location: user.location })
      .then(ops => Opportunity.insertMany(ops.map(o => ({ ...o, business: user._id }))))
      .catch(err => console.error('Opportunity seeding failed:', err.message));
  }

  issueToken(res, user);
  res.status(201).json({ user, redirect: `/${role}.html` });
});

router.post('/login', async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = await User.findOne({ email }).select('+passwordHash');
  if (user && !user.passwordHash) {
    throw fail('Your dashboard isn’t activated yet. Use “Email me a login link” below and we’ll send it again.', 401);
  }
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw fail('Email or password is incorrect', 401);
  }
  issueToken(res, user);
  res.json({ user, redirect: `/${user.role}.html` });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get('/me', requireAuth(), async (req, res) => {
  await req.user.populate('assignedManager', 'name email phone');
  res.json({ user: req.user });
});

// ---------- One-time links: activate a dashboard from the enquiry email, or reset a password ----------
router.get('/link/:token', async (req, res) => {
  const user = await findByToken(User, req.params.token);
  if (!user) throw fail('This link has expired or was already used. Request a new one below.', 410);
  res.json({ name: user.name, email: user.email, purpose: user.linkTokenPurpose || 'activate', role: user.role });
});

router.post('/activate', async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 8) throw fail('Use a password with at least 8 characters');
  const user = await findByToken(User, req.body?.token);
  if (!user) throw fail('This link has expired or was already used. Request a new one below.', 410);
  user.passwordHash = await bcrypt.hash(password, 10);
  user.emailVerifiedAt = user.emailVerifiedAt || new Date().toISOString();
  user.linkTokenHash = null;
  user.linkTokenExpires = null;
  user.linkTokenPurpose = null;
  await user.save();
  issueToken(res, user);
  res.json({ user, redirect: `/${user.role}.html` });
});

// Always answers the same way, so it can't be used to find out who has an account
router.post('/request-link', rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const user = email ? await User.findOne({ email }) : null;
  let devLink;
  if (user) {
    const purpose = user.passwordHash ? 'reset' : 'activate';
    const link = await issueLink(user, purpose);
    await sendMail(loginLink({ name: user.name, email: user.email, link, purpose }));
    if (!mailConfigured() && process.env.NODE_ENV !== 'production') devLink = link;
  }
  res.json({ ok: true, devLink });
});

module.exports = router;
