# Partnermybusiness.ai

The public website (homepage, enquiry form, terms) plus partner dashboards, in one Node.js app.
Data is stored in `data/app-data.json` (created on first start).

## Run it

```bash
cp .env.example .env     # fill in JWT_SECRET, ADMIN_INVITE_CODE, APP_URL and the SMTP settings
npm install
npm run dev              # http://localhost:3000
```

For local testing, set `APP_URL=http://localhost:3000` and remove `NODE_ENV=production`. Without SMTP settings, every email is saved to `data/outbox/` (open the .html files in a browser), and the sign-in flow shows a local test code. Never enable this test-code response in production.

## Passwordless email sign-in

1. A new partner creates a profile and enters their email address.
2. The app emails a six-digit verification code. Codes expire in 10 minutes, can be used once, and allow at most five verification attempts.
3. Entering a valid code verifies the email and signs the user into the correct dashboard. Existing accounts also use this flow; passwords are no longer accepted.
4. The login page uses the same email-code flow. Responses for unknown emails do not disclose whether an account exists.
5. If an email has multiple business or professional profiles, the user chooses the dashboard after verifying. The dashboard sidebar can switch between those profiles.

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
- Users with multiple profiles under one email can switch between dashboards from the sidebar.

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

The root `render.yaml` is a Render Blueprint for this Node app. In Render, choose **New + > Blueprint**, connect this repository, and review the service and persistent-disk prices before creating them. The app needs a paid web service and persistent disk to keep partner accounts, uploads and lesson videos when it restarts or redeploys; Render's free service filesystem is temporary.

Before using the live site, set these environment variables in the Render service settings (or provide them when Render prompts during Blueprint setup):

- `ADMIN_INVITE_CODE`: a private code for creating an admin account.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: working SMTP credentials. Email verification and enquiry notifications depend on SMTP.
- `MAIL_FROM`: the sender name/address approved by your email provider.
- `TEAM_INBOX`: where new enquiries are sent.

The Blueprint generates `JWT_SECRET` and points `DATA_DIR` and `UPLOAD_DIR` to the persistent disk. Email links use Render's generated public URL automatically; if you later attach a custom domain, set `APP_URL` to that HTTPS address. To enable AI presenter videos, add `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID` and `HEYGEN_VOICE_ID`; until then lessons continue to use their slide versions. Keep `HEYGEN_TEST_MODE=true` until you have verified a test video.

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
videos of their own text. Finished videos are stored under `DATA_DIR/lesson-videos/` (HeyGen's own links expire after 7 days),
so keep `DATA_DIR` on a persistent disk.
