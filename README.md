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
- Local files are stored under `data/uploads/` by default. On the VPS, set `DATA_DIR` and `UPLOAD_DIR` to a folder outside the code, such as `DATA_DIR=/var/lib/partnermybusiness` and `UPLOAD_DIR=/var/lib/partnermybusiness/uploads`, and back it up.
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

## Deploying on a VPS

The app is one Node.js process (Node 20 or newer). There is no build step: `npm ci --omit=dev` then start it. that keeps its data in `DATA_DIR`. Run it with PM2 behind Nginx.

1. On the server (Ubuntu shown), install Node 20, Nginx, PM2 and Certbot:
   ```sh
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs nginx certbot python3-certbot-nginx git
   sudo npm install -g pm2
   ```
2. Get the code and install it:
   ```sh
   sudo mkdir -p /var/www /var/lib/partnermybusiness && sudo chown $USER /var/www /var/lib/partnermybusiness
   git clone https://github.com/Govianu/partnermybusiness.git /var/www/partnermybusiness
   cd /var/www/partnermybusiness && npm ci --omit=dev
   ```
3. Create `/var/www/partnermybusiness/.env` from `.env.example`. Set at least `NODE_ENV=production`, a long random
   `JWT_SECRET`, `ADMIN_INVITE_CODE`, `APP_URL=https://partnermybusiness.ai`,
   `DATA_DIR=/var/lib/partnermybusiness`, `UPLOAD_DIR=/var/lib/partnermybusiness/uploads`, the email settings
   (`BREVO_API_KEY` or `SMTP_*`, `MAIL_FROM`, `TEAM_INBOX`) and, for AI lesson videos, `HIGGSFIELD_API_KEY_ID` and
   `HIGGSFIELD_API_KEY_SECRET`. The `.env` file stays on the server; never commit it.
4. Start it and keep it running after reboots:
   ```sh
   pm2 start ecosystem.config.js && pm2 save && pm2 startup
   ```
5. Nginx: copy `deploy/nginx.conf.example` to `/etc/nginx/sites-available/partnermybusiness`, set your domain,
   enable it, then add HTTPS:
   ```sh
   sudo ln -s /etc/nginx/sites-available/partnermybusiness /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d partnermybusiness.ai -d www.partnermybusiness.ai
   ```
6. To deploy an update: `cd /var/www/partnermybusiness && git pull && npm ci --omit=dev && pm2 reload partnermybusiness`.

Check `pm2 logs partnermybusiness` for the email provider's connection status and `[lesson-video]` lines.
Back up `DATA_DIR` regularly: it holds accounts, bookings, uploads and lesson videos. Many VPS providers block outbound
port 25; use port 465/587 SMTP or `BREVO_API_KEY`. Rate limits are kept in memory, so run a single instance (as the PM2
config does). Netlify and GitHub Pages only host static files and cannot run this app.

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

### AI presenter videos (Higgsfield)

Lessons can be real videos of an AI presenter speaking the lesson. Videos are made **only when someone opens a
lesson**, then saved on your server and reused for everyone with the same business type and topic, so each one is
paid for once. Until a video is ready, the person sees "Your AI presenter is recording this lesson" with the slide
version available; it swaps in automatically.

Each video is made with [Higgsfield](https://docs.higgsfield.ai) in two steps:
1. **Image:** a photo of the presenter in a setting that fits the business type (Soul V2, text to image). It is also
   the video's poster, and it shows behind the "recording" message while the video is made.
2. **Video:** that photo brought to life, speaking the lesson in up to 6 shots of up to 15 seconds each
   (Kling 3.0 Pro, image to video with native sound).

Setup:
1. Sign up at console.higgsfield.ai, create an API key (you get a key ID and a secret) and add credit.
2. Add `HIGGSFIELD_API_KEY_ID` and `HIGGSFIELD_API_KEY_SECRET` to `.env`, then run `npm run higgsfield:check`
   to check them. It makes one small image and prints its link.
3. `HIGGSFIELD_MONTHLY_MINUTES` caps new video minutes per month (default 20). Above it, lessons show the slides instead.
   Higgsfield has no free test mode, so watch a first video before raising it.
4. Optional: `HIGGSFIELD_PRESENTER` describes the presenter, and `HIGGSFIELD_SEED` keeps them looking alike across lessons.
   `HIGGSFIELD_IMAGE_MODEL` and `HIGGSFIELD_VIDEO_MODEL` switch to other Higgsfield models with the same inputs.

Speech comes from the video model's own audio, guided by the script in each shot's prompt, so check that a first
video says the lines clearly before relying on it. Scripts are written on the server (`utils/lessonScript.js`), never
sent from the browser, so nobody can create videos of their own text. Finished videos and posters are stored in
`data/lesson-videos/` (Higgsfield deletes its own copies about 7 days after they are made), so keep `data/` on a
persistent disk. Videos made earlier with HeyGen keep playing.

## Marketplace (buyers and sellers, with PMB in the middle)

| Who | Where | What they do |
|---|---|---|
| Business | My spaces, Booking requests, Find & book | Publish spaces and free slots; accept or decline requests; book professionals or other spaces |
| Professional | My offers, Find & book | Publish services with a price; accept or decline requests; book spaces for workshops |
| Buyer (event manager, company, individual) | `/buyer.html` | Search, request, follow each request; "Find it for me" |
| Anyone | `/find.html` | Search and request without an account |
| PMB team (Govianu employees only) | `/admin.html` > Marketplace | Approve matches, collect PMB's share, take listings down |

Flow (`utils/deal.js`):
1. **Seller publishes** an opportunity: it is live for buyers straight away, and the team inbox (`TEAM_INBOX`,
   info@partnermybusiness.ai) gets an email. The team can take a listing down with a note.
2. **Buyer requests** it: the request goes straight to the seller (the team inbox gets a copy).
3. **Seller accepts**: buyer and seller match. The team inbox gets "Approve match" and the deal waits in the PMB dashboard.
4. **PMB approves**, setting the agreed amount, the split and who pays PMB's share. PMB's share is the platform line of
   the split (25% on the 4-way split). With Razorpay keys set, a Razorpay payment link is created and emailed.
5. **Share received**: press "Share received" (with Razorpay the link's status is checked; otherwise enter the UTR or
   reference). It's a match: buyer and seller get each other's email and phone, and the team gets a copy.

Until step 5, buyers and sellers never see each other's email or phone.

### PMB team access
Only accounts with a Govianu email (`STAFF_EMAIL_DOMAINS`, default `govianu.com`) can open the PMB team dashboard.
The team sign-up only appears on the login page once a Govianu email is typed, and still needs `ADMIN_INVITE_CODE`.
Older team accounts with other emails are refused. Govianu employees can keep business, professional or buyer
dashboards on the same email and switch between them.

