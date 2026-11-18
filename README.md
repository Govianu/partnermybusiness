# Partnermybusiness.ai

The public website (homepage, enquiry form, terms) plus partner dashboards, in one Node.js app.
Data is stored in `data/app-data.json` (created on first start).

## Run it

```bash
cp .env.example .env     # fill in JWT_SECRET, ADMIN_INVITE_CODE, APP_URL and email settings
npm install
npm run dev              # http://localhost:3000
```

For local testing, set `APP_URL=http://localhost:3000` and remove `NODE_ENV=production`. Without `BREVO_API_KEY` or SMTP settings, every email is saved to `data/outbox/` (open the .html files in a browser), and the sign-in flow shows a local test code. Never enable this test-code response in production.

## Passwordless email sign-in

1. A new partner creates a profile and enters their email address.
2. The app emails a six-digit verification code. Codes expire in 10 minutes, can be used once, and allow at most five verification attempts.
3. Entering a valid code verifies the email and signs the user into the correct dashboard. Existing accounts also use this flow; passwords are no longer accepted.
4. The login page uses the same email-code flow. Responses for unknown emails do not disclose whether an account exists.

## How an enquiry works

1. A visitor fills the form on the homepage and presses **Continue**. Email is required so we can send the dashboard verification code.
2. A **terms step** appears with the key terms, links to the full Terms and Privacy Policy, and a checkbox. **Agree and continue** stays disabled until the box is ticked. Nothing is sent before that.
3. The server (`POST /api/enquiry`) checks the terms were accepted, then:
   - stores the enquiry with the terms version, time, IP and browser as proof of consent;
   - creates a business dashboard for "A business" or an associate dashboard for "A professional";
   - adds a lead to the admin CRM;
   - emails the team inbox with every detail, and emails the visitor a one-time verification code to open their dashboard.
4. Visitors can enter that code on `/login.html`. Existing activation links remain compatible and now open the dashboard without setting a password.
5. To resend, use **Email another code** after enquiring or **Send a new code** on the login page.

## Dashboard profiles and media

- Business accounts get category-specific growth suggestions, booking emails, onboarding steps and media prompts for restaurants, cafes, hotels, salons, gyms, banquet venues and offices.
- Business owners can upload menu/service PDFs, photos, promo videos and PDF slide decks.
- Associates can maintain a professional bio, skillset and availability, and upload intro videos, portfolio photos, PDF slides and course materials.
- Uploads are actual files stored on disk, privately served to the owner and PMB reviewers, and shown in dashboard galleries. New items enter the PMB review queue.
- Supported uploads: JPG/PNG/WebP/GIF images (10 MB), MP4/WebM videos (100 MB), and PDF menus/slides/course files (25 MB). Each account has a 300 MB quota; the site-wide limit is 800 MB.
- Local files are stored under `data/uploads/` by default. On Render, mount a persistent disk and set both `DATA_DIR` and `UPLOAD_DIR` on that mount, such as `DATA_DIR=/var/data` and `UPLOAD_DIR=/var/data/uploads`; otherwise account data or uploaded files may be lost when the service restarts or redeploys.
- Both dashboards keep quick actions visible for common tasks.

## Booking emails

- New booking request (from `/book.html?h=<handle>`): the business gets an email with a **Review and accept** button that opens the bookings tab after login.
- The business ticks the partner agreement and presses **Accept** on the dashboard. Both the business and the person who booked get a confirmation email (with the Meet link when Google is connected).

## Pages

| Page | What it is |
|---|---|
| `/` | Homepage (the existing site), with the terms step on the enquiry form and a Log in link |
| `/login.html` | Create a profile or sign in with a one-time email code |
| `/activate.html` | Open an older one-time email link without setting a password |
| `/terms.html` | Terms and Conditions + Privacy Policy (draft: have it reviewed by a lawyer) |
| `/business.html`, `/associate.html`, `/admin.html` | Dashboards. Admin has a new **Website enquiries** tab |
| `/book.html?h=<handle>` | Public booking request page for a venue |

When you change the terms, update `TERMS_VERSION` in `utils/terms.js`.

OTP attempt and request limits currently use in-memory rate limiting. Run a single application instance or replace that limiter with shared storage before scaling horizontally.

Run the focused upload and OTP tests with `node --test`.

## Deploying on Render

The root `render.yaml` is configured for a free public test. It has no persistent disk and may sleep when idle; accounts, enquiries, uploads and lesson videos can be lost when it restarts or redeploys. Use it only as a temporary preview.

For production, use a paid web service with a persistent disk mounted at `/var/data`, then set `DATA_DIR=/var/data` and `UPLOAD_DIR=/var/data/uploads`. Review Render's current service and disk charges before upgrading.

Set these values in Render's service settings:

- `ADMIN_INVITE_CODE`: a private code for creating an admin account.
- `BREVO_API_KEY`: a Brevo API key; verify the sender address in Brevo first. The free Render blueprint uses its HTTPS API because Render Free blocks outbound SMTP.
- `MAIL_FROM`: the verified sender name/address, such as `Partnermybusiness.ai <info@partnermybusiness.ai>`.
- `TEAM_INBOX`: where new enquiries are sent.

The Blueprint generates `JWT_SECRET`; email links use Render's public URL automatically. For a custom domain, set `APP_URL` to that HTTPS address. On paid hosting, SMTP is also an option if the host allows outbound email ports. To enable AI presenter videos, add `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID` and `HEYGEN_VOICE_ID`; keep `HEYGEN_TEST_MODE=true` until a test video is verified.

Do not publish secrets in GitHub or commit `.env`. Netlify and GitHub Pages only host static assets and cannot run this app's APIs, authentication, email, dashboards or uploads.

## Dashboards: business-type specific, with skills and video lessons

Everything a partner sees is built from their exact business type, one of the 100 on the homepage (`utils/catalog.json`):
emails ("Magic Masala, your restaurant"), slides, skill suggestions, lessons, earnings planner and "Ways to earn" ideas.

- On first visit the dashboard asks for skills. Six lessons are built from them: who pays, what you already have,
  a step-by-step workflow, an illustrative earnings figure and a "Help me launch this" button.
- The call to action stays on screen on every page (bottom bar on phones). Pressing it adds a lead to the
  admin CRM and emails the team inbox (`routes/growth.js`).
- The photo/media sections and Supply savings were removed; the upload code stays on the server.
- Business menu: Overview, Learn & earn (lessons + growth ideas), Booking requests, Profile.
- The main button is worded for each business type ("Launch dining memberships"), and every idea card has its own launch button.

### AI presenter videos (HeyGen)

Lessons can be real videos of an AI presenter speaking the lesson. Videos are made **only when someone opens a
lesson**, then saved on your server and reused for everyone with the same business type and topic, so each one is
paid for once. Until a video is ready, the person sees "Your AI presenter is recording this lesson" with the slide
version available; it swaps in automatically.

1. Sign up at heygen.com, create an API key and add pay-as-you-go API credit.
2. Add `HEYGEN_API_KEY` to `.env`, then run `npm run heygen:list -- india` and copy an avatar ID and a voice ID
   into `HEYGEN_AVATAR_ID` and `HEYGEN_VOICE_ID`.
3. Keep `HEYGEN_TEST_MODE=true` for a first try (free, watermarked), then set it to `false`.
4. `HEYGEN_MONTHLY_MINUTES` caps new video minutes per month. Above it, lessons show the slides instead.

Scripts are written on the server (`utils/lessonScript.js`), never sent from the browser, so nobody can create
videos of their own text. Finished videos are stored in `data/lesson-videos/` (HeyGen's own links expire after 7 days),
so keep `data/` on a persistent disk.

## Marketplace (buyers and sellers, with PMB in the middle)

| Who | Where | What they do |
|---|---|---|
| Business | My spaces, Booking requests, Find & book | List spaces and free slots; accept forwarded requests; book professionals or other spaces |
| Professional | My offers, Find & book | List services with a price; accept forwarded requests; book spaces for workshops |
| Buyer (event manager, company, individual) | `/buyer.html` | Search, request, follow each request; "Find it for me" |
| Anyone | `/find.html` | Search and request without an account |
| PMB team | Admin > Marketplace | Approve listings; forward or decline every request; connect both sides |

Flow: listing added > PMB approves > buyer requests > PMB checks and forwards > seller accepts > PMB manager connects both
and arranges payment. Buyers and sellers never see each other's email or phone.

## Go live on Render (Blueprint)

`render.yaml` is the FREE test setup (email via the Brevo API, no disk: data resets on restart).
`render-paid.yaml.example` is the real-launch setup (Starter + 1 GB disk); rename it to `render.yaml` when you upgrade.

1. Put this folder in a private GitHub repository (without `.env` and `data/`).
2. In Render, choose **New > Blueprint** and connect the repository; Render reads `render.yaml`.
3. For the free preview, provide `ADMIN_INVITE_CODE`, `APP_URL`, and a Brevo API key. Data on this plan is temporary.
4. For production, use `render-paid.yaml.example` as `render.yaml`, attach the configured persistent disk, and set a verified Brevo key or the Zoho `SMTP_PASS`.
5. After deploy, check the logs for the email provider's connection status, sign up your team with the invite code, and test an enquiry.
6. To use a custom domain, add it in Render, follow the displayed DNS instructions (do not change MX records), then set `APP_URL` to the HTTPS domain.
