# Changes in this update

Compared with the partnermybusiness-site.zip you sent. Your existing uncommitted work (OTP login,
media uploads, tests) is untouched; run `git status` to see everything not yet committed.

## Emails speak the partner's business type
- `utils/catalog.json` + `utils/catalog.js`: the homepage's 100 business types and professions in one shared file.
- `utils/industry.js`: wording now comes from that catalog ("restaurant", "an electrician").
- `utils/emails.js`: "thank you for telling us about Magic Masala, your restaurant", type-specific ideas and partners,
  tidy first names ("Divyaj.govianu05" becomes "Divyaj").
- `routes/enquiry.js`, `public/index.html`: the homepage now sends the exact type picked, and it's saved on the account.
- `utils/ai.js`: "Ways to earn" ideas built from each type's own data instead of three generic ideas.

## Dashboards
- Photo/media sections removed from `public/business.html` and `public/associate.html` (server upload code kept).
- New `public/js/growth.js` + `public/css/growth.css`: type-specific slides, skills picker, six lessons built from the
  partner's skills, earnings planner, next-steps checklist, and a call to action on every page.
- `routes/growth.js`: saves skills and lesson progress; the call to action creates a CRM lead and emails the team.
- `public/js/business.js`, `public/js/associate.js`, `public/js/api.js`, `routes/*`: wiring for the above.

## AI presenter videos (HeyGen), made on first view and reused
- `utils/heygen.js`, `utils/lessonVideos.js`, `utils/lessonScript.js`, `models/LessonVideo.js`, `routes/lessonVideos.js`.
- `scripts/heygen-list.js` (`npm run heygen:list -- india`) to choose an avatar and voice.
- Settings in `.env.example` (HEYGEN_*). Off until you add a HeyGen API key.

## Dashboard layout (latest round)
- Supply savings removed from the business dashboard (page, menu item and calculator).
- "Video lessons" and "Ways to earn" merged into one **Learn & earn** section: lessons player on top, growth ideas below.
  Business menu is now Overview, Learn & earn, Booking requests, Profile. Professionals' lessons section is also "Learn & earn".
- Main button is worded for each business type, from its lead service: "Launch dining memberships" (restaurant),
  "Launch preventive care membership" (dental clinic), "Launch subscription laundry" (laundry). "Book a growth call"
  stays beside it; professionals keep "Find me <profession> work".
- Every growth idea card has its own "Help me launch this" button.
- "Copy booking page link" moved to the Booking requests page.
- Old links to #opportunities open Learn & earn; links to removed sections (#savings, #media) open the overview.
- `utils/lessonScript.js` also returns the script in sections (`segments`), ready for subtitles.

## Marketplace: Partnermybusiness as the third party between buyers and sellers
- **Who sells:** businesses list spaces and free slots (My spaces); professionals list services with a price (My offers).
- **Who buys:** anyone. New **buyer accounts** (event managers, companies, individuals: "I want to book" on the sign-up page),
  and businesses and professionals can also book each other from **Find & book** in their dashboards. Guests can request
  without an account.
- **Public page** `/find.html` ("Find a space or professional", linked from the homepage header): search spaces and
  professionals by keyword, area and number of people, see who offers what and at what price.
- **We're in the middle:** every listing and every request goes to the PMB team first (admin > Marketplace). The team
  approves listings, and forwards or declines requests. Sellers only see requests we've forwarded, and buyers and sellers only
  ever see each other's first name and type ("Anita, event manager"). After the seller accepts, the PMB manager connects them.
- **"Find it for me":** buyers who can't find something tell us what they need; it becomes a lead and an email to the team.
- **Status everywhere:** buyers follow each request (Sent, Checked by PMB, Seller replied, Confirmed) in My requests,
  and get an email at every step. Sellers get emails when listings go live and when a request is forwarded.
- The old per-business booking link (`/book.html`) now also goes to the PMB team first.
- New: `models/Listing.js`, `routes/market.js`, `public/find.html`, `public/buyer.html`, `public/js/market.js`, `public/js/buyer.js`,
  `public/css/market.css`. Updated: bookings (new statuses `pending_review`, `cancelled`), users (role `buyer`), admin, emails.

## Hosting on Render's free plan (testing)
- `utils/mailer.js` can send through the **Brevo email API** (`BREVO_API_KEY`), because Render's free plan blocks email
  ports (25, 465, 587) since September 2025. SMTP (Zoho) still works on paid hosting.
- `render.yaml`: one-click free test setup. `render-paid.yaml.example`: the paid setup with a disk for the real launch.
