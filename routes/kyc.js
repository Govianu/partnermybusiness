// KYC in the Profile: Aadhaar, PAN and bank account details plus their documents (utils/kyc.js)
const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { fail } = require('../utils/http');
const rateLimit = require('../utils/rateLimit');
const { uploadMiddleware } = require('../utils/mediaUpload');
const kyc = require('../utils/kyc');

router.use(requireAuth('business', 'associate', 'buyer', 'admin'));

router.get('/', (req, res) => res.json({ kyc: kyc.kycSummary(req.user) }));

router.post('/details', rateLimit(20, 60 * 60 * 1000), async (req, res) => {
  const u = req.user;
  const changes = kyc.cleanDetails(req.body || {});
  if (!Object.keys(changes).length) throw fail('Fill in at least one detail');
  u.kyc = { ...(u.kyc || {}), ...changes };
  delete u.kyc.verifiedAt;
  await u.save();
  res.json({ kyc: kyc.kycSummary(u) });
});

router.post('/docs/:kind', rateLimit(20, 60 * 60 * 1000), uploadMiddleware, async (req, res) => {
  await kyc.storeDoc(req.user, req.params.kind, req.file);
  res.json({ kyc: kyc.kycSummary(req.user) });
});

// The document itself: its owner, or the PMB team (?user=<id>)
router.get('/docs/:kind', async (req, res) => {
  const who = req.user.role === 'admin' && req.query.user ? await User.findById(String(req.query.user)) : req.user;
  const doc = kyc.docPath(who, req.params.kind);
  if (!doc) throw fail('Document not found', 404);
  res.set({ 'Content-Type': doc.mime, 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store', 'Cross-Origin-Resource-Policy': 'same-origin' });
  if (doc.mime === 'application/pdf') res.set('Content-Security-Policy', 'sandbox');
  res.sendFile(doc.file);
});

// PMB team: see a partner's KYC (masked) and mark it checked
router.get('/user/:id', requireAuth('admin'), async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw fail('Not found', 404);
  res.json({ kyc: kyc.kycSummary(u) });
});
router.post('/user/:id/verify', requireAuth('admin'), async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw fail('Not found', 404);
  if (!kyc.kycComplete(u)) throw fail('This KYC is not complete yet');
  u.kyc.verifiedAt = new Date().toISOString();
  u.kyc.verifiedBy = String(req.user._id);
  await u.save();
  res.json({ kyc: kyc.kycSummary(u) });
});

module.exports = router;
