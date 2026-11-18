// Website enquiry: terms must be accepted, then the enquiry is stored, a dashboard account is
// created (or found), and two emails go out: one to the person, one to the team inbox.
const router = require('express').Router();
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const { uniqueHandle, slugify } = require('../utils/handle');
const { generateOpportunities, sopsFor } = require('../utils/ai');
const { sendMail, mailConfigured } = require('../utils/mailer');
const { enquiryWelcome, teamEnquiry } = require('../utils/emails');
const { issueOtp } = require('../utils/otp');
const { TERMS_VERSION } = require('../utils/terms');
const rateLimit = require('../utils/rateLimit');
const { fail, str } = require('../utils/http');
const { sectorById, sectorFor } = require('../utils/catalog');

const ROLE_NAMES = { host: 'A business', pro: 'A professional', country: 'A future country partner' };
// Which dashboard each enquiry type gets. Country partners are handled by the team directly.
const ACCOUNT_ROLE = { host: 'business', pro: 'associate', country: null };

function areaFrom(location) {
  const loc = str(location);
  if (!loc || /^https?:\/\//i.test(loc)) return 'bengaluru';
  return loc.split(',')[0].trim() || 'bengaluru';
}

function profileName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

router.post('/', rateLimit(5, 10 * 60 * 1000), async (req, res) => {
  const b = req.body || {};
  if (str(b['bot-field'])) return res.json({ ok: true }); // honeypot: quietly ignore bots

  const role = str(b.role);
  const name = str(b.name).slice(0, 120);
  const email = str(b.email).toLowerCase().slice(0, 200);
  const phone = str(b.phone).slice(0, 40);

  if (!ROLE_NAMES[role]) throw fail('Choose what kind of enquiry this is');
  if (!name) throw fail('Add your name so we know who to reply to.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail('Add a valid email address. We send your dashboard verification code there.');
  if (b.termsAccepted !== true) throw fail('Please read and agree to the Terms and Conditions to continue.');

  const fields = {
    business: str(b.business).slice(0, 160), businessType: str(b.business_type).slice(0, 120),
    location: str(b.location).slice(0, 500), message: str(b.message).slice(0, 4000),
    plan: str(b.plan).slice(0, 6000), offer: str(b.offer).slice(0, 120), territory: str(b.territory).slice(0, 200)
  };
  if (role === 'host' && !fields.business) throw fail('Add your business name.');
  if ((role === 'host' || role === 'pro') && !fields.location) throw fail('Add your area and city or a Google Maps link.');
  // Keep the exact homepage selection for emails and the dashboard.
  const selectedSector = sectorById(b.business_type_id) || sectorFor({ category: fields.businessType });
  const sector = (role === 'host' || role === 'pro') ? selectedSector : null;
  if (sector && sector.t !== (role === 'host' ? 'b' : 'p')) {
    throw fail(role === 'host' ? 'Choose a business type.' : 'Choose a profession.');
  }
  if ((role === 'host' || role === 'pro') && !sector) {
    throw fail(role === 'host' ? 'Choose a business type.' : 'Choose a profession.');
  }
  const termsAcceptedAt = new Date().toISOString();

  // Find or create the dashboard account
  const accountRole = ACCOUNT_ROLE[role];
  let user = null;
  let existingAccount = false;
  let emailCode = null;
  if (accountRole) {
    const emailProfiles = await User.find({ email });
    user = emailProfiles.find(profile => {
      if (profile.role !== accountRole) return false;
      const profileSector = sectorById(profile.sectorId) || sectorFor(profile);
      if (profileSector?.id !== sector.id) return false;
      return role !== 'host' || profileName(profile.business?.businessName) === profileName(fields.business);
    }) || null;
    if (user) {
      existingAccount = true;
      if (sector && !user.sectorId) { user.sectorId = sector.id; await user.save(); }
    } else {
      const isBusiness = accountRole === 'business';
      const category = role === 'partner' ? 'brand'
        : sector ? slugify(sector.noun, true) : (slugify(fields.businessType, true) || (isBusiness ? 'business' : 'professional'));
      const area = areaFrom(fields.location);
      const displayName = isBusiness ? (fields.business || name) : name;
      user = await User.create({
        role: accountRole, name, email, phone,
        category, sectorId: sector?.id || null, location: area.toLowerCase(), slug: displayName,
        handle: await uniqueHandle(category, area, isBusiness ? displayName : name.split(' ')[0]),
        status: 'pending',
        termsAcceptedAt, termsVersion: TERMS_VERSION,
        source: 'website_enquiry',
        ...(isBusiness
          ? { business: { businessName: displayName, address: /^https?:/i.test(fields.location) ? '' : fields.location,
              mapsUrl: /^https?:/i.test(fields.location) ? fields.location : '', sops: sopsFor(category) } }
          : { associate: { skill: category, bio: fields.message.slice(0, 500) } })
      });
      if (isBusiness) {
        generateOpportunities({ name: displayName, category, location: user.location, sectorId: sector?.id })
          .then(ops => Opportunity.insertMany(ops.map(o => ({ ...o, business: user._id }))))
          .catch(err => console.error('Opportunity seeding failed:', err.message));
      }
    }
    emailCode = await issueOtp(user);
  }

  const enquiry = await Enquiry.create({
    role, roleName: ROLE_NAMES[role], name, email, phone, ...fields,
    termsAccepted: true, termsVersion: TERMS_VERSION, termsAcceptedAt,
    ip: req.ip, userAgent: str(req.get('user-agent')).slice(0, 300),
    user: user?._id || null
  });

  await Lead.create({
    name, company: fields.business, email, phone, source: 'enquiry', relatedUser: user?._id || null,
    notes: [ROLE_NAMES[role], fields.businessType, fields.location].filter(Boolean).join(', '),
    stage: 'new',
    history: [{ stage: 'new', note: `Website enquiry, terms ${TERMS_VERSION} accepted`, at: termsAcceptedAt }]
  });

  const [toPerson, toTeam] = await Promise.all([
    sendMail(enquiryWelcome({
      name, email, roleName: ROLE_NAMES[role], code: emailCode,
      hasDashboard: !!accountRole, existingAccount, category: user?.category,
      sectorId: user?.sectorId || sector?.id, businessName: role === 'host' ? (user?.business?.businessName || fields.business) : ''
    })),
    sendMail(teamEnquiry({ ...enquiry, roleName: ROLE_NAMES[role], handle: user?.handle, existingAccount }))
  ]);
  enquiry.emailStatus = { person: toPerson.sent ? 'sent' : (toPerson.error ? 'failed' : 'outbox'), team: toTeam.sent ? 'sent' : (toTeam.error ? 'failed' : 'outbox') };
  await enquiry.save();

  res.status(201).json({
    ok: true,
    email,
    hasDashboard: !!accountRole,
    existingAccount,
    emailSent: toPerson.sent,
    // Only while SMTP isn't configured in development, so verification can be tested locally.
    devOtp: !mailConfigured() && process.env.NODE_ENV !== 'production' && accountRole ? emailCode : undefined
  });
});

module.exports = router;
