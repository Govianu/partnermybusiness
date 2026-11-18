# Partnermybusiness.ai

The public website (homepage, enquiry form, terms) plus partner dashboards, in one Node.js app.
Data is stored in `data/app-data.json` (created on first start).

## Run it

```bash
cp .env.example .env     # fill in JWT_SECRET, ADMIN_INVITE_CODE, APP_URL and the SMTP settings
npm install
npm run dev              # http://localhost:3000
```

For local testing, set `APP_URL=http://localhost:3000` and remove `NODE_ENV=production`. Without SMTP settings, every email is saved to `data/outbox/` (open the .html files in a browser), and the site shows a "Test mode" link in place of the emailed one.

## How an enquiry works now

1. A visitor fills the form on the homepage and presses **Continue**. Email is required, because that's where the dashboard link goes.
2. A **terms step** appears with the key terms, links to the full Terms and Privacy Policy, and a checkbox. **Agree and continue** stays disabled until the box is ticked. Nothing is sent before that.
3. The server (`POST /api/enquiry`) checks the terms were accepted, then:
   - stores the enquiry with the terms version, time, IP and browser as proof of consent;
   - creates a dashboard account (business for "A business" and "A brand or supplier", associate for "A professional"; country-partner enquiries go to the team only);
   - adds a lead to the admin CRM;
   - emails the team inbox with every detail, and emails the visitor a one-time link (72 hours) to set a password and open their dashboard.
4. The link opens `/activate.html`, where they set a password and land on their dashboard.
5. Lost the email or forgot the password? "Email me a login link" on the login page, or "Resend the email" after enquiring.

## Booking emails

- New booking request (from `/book.html?h=<handle>`): the business gets an email with a **Review and accept** button that opens the bookings tab after login.
- The business ticks the partner agreement and presses **Accept** on the dashboard. Both the business and the person who booked get a confirmation email (with the Meet link when Google is connected).

## Pages

| Page | What it is |
|---|---|
| `/` | Homepage (the existing site), with the terms step on the enquiry form and a Log in link |
| `/login.html` | Log in, sign up (with terms checkbox), email-me-a-login-link |
| `/activate.html` | Set a password from the email link |
| `/terms.html` | Terms and Conditions + Privacy Policy (draft: have it reviewed by a lawyer) |
| `/business.html`, `/associate.html`, `/admin.html` | Dashboards. Admin has a new **Website enquiries** tab |
| `/book.html?h=<handle>` | Public booking request page for a venue |

When you change the terms, update `TERMS_VERSION` in `utils/terms.js`.

## Deploying

Any Node host works (Render, Railway, a VPS). Set the `.env` values in the host's settings, and choose a plan with a persistent disk so `data/app-data.json` survives restarts and redeploys. Point partnermybusiness.ai's DNS at the host. Netlify only hosts static pages, so it can't run this server.
