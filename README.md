# Danz Run Lab

Danz Run Lab is a lightweight running pace planner, practical running publication, and the public home of the Danz pacer development story. Danz is a STAINAZ company.

[Open Danz Run Lab](https://danzrunlab.com/)

![Danz Run Lab progress dashboard](progress.png)

## Features

- Preset 5K, 10K, and half-marathon distances
- Custom distances from 0.4 km to 100 km
- Live pace, speed, finish-time, and split calculations
- Editable and reusable saved sessions
- Actual results compared with target times
- Pace history and personal-best tracking
- Supabase cloud submission and synchronization
- Magic-link admin authentication
- Admin-only Sessions and Insights
- Shareable pace-plan links
- CSV export and JSON backup/restore
- Installable offline web app
- Responsive desktop and mobile design
- Run Weekly editorial homepage, topic filters, automatic archive, and article pages
- Building Danz product vision, milestone timeline, and media-ready development log
- Data-driven Shop and Run Spots routes
- Full-screen, keyboard- and touch-friendly merchandise galleries
- Secure MailerLite newsletter endpoint, ready for server-side credentials

## Public routes

- `/` — pace planner
- `/run-spots` and `/run-spots/[slug]`
- `/shop` and `/shop/[slug]`
- `/run-weekly` and `/run-weekly/[slug]`
- `/building-danz`
- `/admin` — authenticated Sessions and Insights only

Vercel rewrites in `vercel.json` allow these routes to be opened directly as well as reached through the client-side navigation.

## Content

Public content is kept separate from the rendering code in structured JSON files under `content/`. This keeps the current static site simple while providing models that can later be connected to the admin interface or a CMS.

### Publish the next Run Weekly article

Add an object to the `articles` array in [`content/run-weekly.json`](content/run-weekly.json). Copy the existing article's fields, use a unique `id` and `slug`, set the correct ISO `publishedDate`, `weekNumber`, uppercase `month`, numeric `year`, and one of the configured topics. The body is an array of sections with a heading and paragraphs. Set `status` to `draft` while preparing it and `published` when it should become public. Set `featured` to `true` only for the issue that should lead the page.

Published articles are sorted by `publishedDate`. The year and month archive is generated automatically; no archive page needs to be edited. A published article with a future `publishedDate` remains hidden until that date, providing simple scheduling. `heroImage` can be `null` for the Danz typographic treatment or a public image path such as `/images/run-weekly/example.webp`.

### Add a Building Danz update

Add an object to the `updates` array in [`content/building-danz.json`](content/building-danz.json) with:

```json
{
  "date": "2026-10-02",
  "weekNumber": 40,
  "year": 2026,
  "title": "A real update title",
  "summary": "What actually happened and what was learned.",
  "images": [{ "src": "/images/building-danz/example.webp", "alt": "Accurate description" }],
  "video": null,
  "status": "In progress",
  "articleUrl": null
}
```

Only document work that happened. Updates are sorted newest-first automatically. Images, video, status, and an optional longer article link are already supported. Change a stage in the `stages` array only when its real status changes; accepted labels are `Not started`, `In progress`, and `Completed`.

### Shop merchandise images

Product records belong in [`content/products.json`](content/products.json). Product components read their image paths from that data rather than hardcoding them.

The approved catalogue sheets are preserved byte-for-byte under `public/images/products/sources/`. The 12 shirt crops used by the Shop are under `public/images/products/catalogue/`. They are direct, unscaled crops from the approved sources; no logos, typography, colours, slogans, or garment artwork were redesigned.

The approved shorts sheet is preserved at `public/images/products/sources/shorts.png`. Six direct, unscaled product/detail crops are under `public/images/products/shorts/` and mapped by the `Danz 2-in-1 Running Shorts` record in `content/products.json`. Its gallery includes the main front/back view, separate front and back views, compression liner, phone pocket, rear zip pocket, and original specification sheet.

All 13 products are mapped. Product images open in a reusable full-screen viewer with previous/next controls, thumbnails, keyboard navigation, mobile swipe, and zoom controls. The same gallery renderer is ready for future Run Spot `images` data. Prices, variants, inventory, cart, and checkout remain intentionally unconfigured; the catalogue says `Coming soon` rather than inventing commerce data.

### Run Spots

Verified locations can be added to the `spots` array in [`content/run-spots.json`](content/run-spots.json). The list is intentionally empty until real route details are available.

### Newsletter subscription

The Run Weekly forms post to the Vercel serverless function at `api/subscribe.js`; provider credentials are never sent to the browser. MailerLite is the prepared provider because it only requires one API call and supports double opt-in for API subscribers.

To activate subscriptions:

1. Create a MailerLite account and a **Run Weekly** subscriber group.
2. In MailerLite, enable **Double opt-in for API** under subscriber settings.
3. Create an API token.
4. Add `MAILERLITE_API_KEY` and `MAILERLITE_GROUP_ID` to the Vercel project for Production, Preview, and Development as appropriate.
5. Change `newsletter.status` in `content/site.json` from `awaiting-credentials` to `configured` and redeploy.

Until those credentials are present, the endpoint returns a clear `503 newsletter_not_configured` response and the interface honestly says subscriptions are not live. No email is captured or sent in that state.

## Run locally

Serve the folder with any static file server so the structured content files can load:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## Install

Open the live site in a supported browser and choose **Install app**. Once installed, the core app works offline.

## Privacy

Submitting a pace plan sends the runner name, session date, distance, and target time to the Danz Run Lab Supabase project. Row-Level Security prevents public reads; only the configured administrator can access Sessions and Insights. Offline submissions remain on the device until they can synchronize.

## Supabase setup

1. Run [`supabase/schema.sql`](supabase/schema.sql) in the project's Supabase SQL Editor.
2. In **Authentication → URL Configuration**, set the Site URL and redirect URL to `https://danzrunlab.com/`.
3. Use `asimango@gmail.com` in the app's **Admin login** dialog.

The Supabase URL and publishable browser key are in `supabase-config.js`; no private Supabase service key is used by the frontend. Newsletter activation requires these server-side Vercel environment variables:

- `MAILERLITE_API_KEY`
- `MAILERLITE_GROUP_ID`

## Technology

The frontend uses HTML, CSS, vanilla JavaScript, structured JSON content, and Supabase.
