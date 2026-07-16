# Boston-Ni-Baaje

Website for Boston Ni Baaje 1.0, Boston's collegiate Raas competition.

## Stack

Vite + vanilla JS, static multi-page site. No framework, no backend, no dependencies beyond Vite.
Content lives in `src/data/` and plain HTML/CSS/JS. Design system (colors, fonts, animations) is in
`src/style.css`.

Features: sticky glass nav with mobile menu, animated hero with floating particles, a live countdown
timer to the event, scroll-reveal animations, animated stat counters, and a day-grouped schedule
timeline. Respects `prefers-reduced-motion`.

The site is also an installable **PWA** (Progressive Web App) — visitors can "Add to Home Screen"
and it opens full-screen like a real app, works offline, and uses the BNB icon. See
[App & notifications](#app--notifications) for what's done and what's left.

## Local development

```
npm install
npm run dev
```

## Pages

- `index.html` — homepage
- `schedule.html` — event schedule, venue location, and contact
- `teams.html` — competing-teams roster + team sign-in (portal preview, no backend yet)
- `discover.html` — things to do around Boston (food, nightlife, sights, transit)
- `sponsors.html` — sponsor logos, ad space, sponsorship contact
- `app.html` — "Get the App" install instructions (iPhone + Android)

## Updating content

- **Event details** (date, countdown target, venue, contact emails, social links): edit
  `src/data/event.js`. The countdown, footer, venue cards, and contact links all read from here.
- **Schedule**: edit `src/data/schedule.json` — an array of
  `{ day, time, event, location, note }`. Items are grouped by `day` into the timeline
  automatically. No code changes needed.
- **Sponsor logos**: replace the placeholder `.sponsor-card` blocks in `sponsors.html` with
  `<img src="..." alt="Sponsor name" />`.
- **Competing teams**: edit `src/data/teams.json` — an array of
  `{ name, school, initials, color }`. These are placeholders until the lineup is confirmed.
- **Discover Boston spots**: edit `src/data/discover.json` — grouped `{ category, eyebrow, blurb, places[] }`.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and deploys it
to GitHub Pages via GitHub Actions.

**One-time setup:** in the repo's GitHub Settings → Pages, set "Source" to **GitHub Actions**
(instead of "Deploy from a branch"). After that, every push to `main` auto-deploys.

Live at: `https://<github-username>.github.io/Boston-Ni-Baaje/`

## TODO before launch

- Wire up push notifications — see [App & notifications](#app--notifications) (the Firebase step)
- Replace sponsor logo placeholders in `sponsors.html`
- Confirm event details in `src/data/event.js` (Feb 19–20, 2027 at the Huntington Theatre; `startISO` drives the countdown — update the year if the date shifts)
- Fill in real schedule data in `src/data/schedule.json`
- Update the homepage stat numbers in `index.html` (`data-target` values)

## App & notifications

The site is installable as a PWA. Here's the state of the "app" experience:

**✅ Done (free, no accounts needed):**

- Installable on iPhone (Safari → Share → Add to Home Screen) and Android (Chrome → Install app).
- Opens full-screen with the BNB icon; works offline via a service worker (`public/sw.js`).
- Web app manifest (`public/site.webmanifest`) + iOS meta tags on every page.
- App icons generated from the logo: `public/apple-touch-icon.png`, `pwa-192.png`, `pwa-512.png`.
- A "Get the App" page (`app.html`) with step-by-step install instructions, linked in the nav and
  the homepage hero.

**⛔ NOT done yet — push notifications (the only thing left):**

Sending notifications ("live updates from the directors") is **not wired up**. A static site on
GitHub Pages can't *send* push messages by itself — it needs a sender. The plan is
**Firebase Cloud Messaging (FCM)**, which is **free** (FCM has no cost; the rest of Firebase has a
free tier that's far more than this event needs, and it never charges without you manually adding a
card).

What's left to make notifications work:

1. **[needs you]** Create a free Firebase project (~5 min, Google account, no card on the free plan)
   and copy its web config snippet.
2. **[code]** Add the Firebase SDK + push-subscription code to the installed app.
3. **[code]** Add a simple "send an update" flow for the directors + an in-app Updates feed as a
   reliable fallback (shown when the app opens, so it works even without push).

> Note: on iPhone, web push only works **after** the user installs the site to their home screen and
> opens it from that icon — not from a normal Safari tab. That's an Apple restriction, hence the
> "Get the App" instructions. If push reach/reliability ever proves insufficient, the fallback is a
> native App Store build (Capacitor wraps this same site) — that path costs $99/yr for an Apple
> Developer account and requires a Mac.

## Later (v2)

- **Team portal with real auth** — the `teams.html` sign-in form is currently a front-end preview
  (it shows a "coming soon" message on submit). To make it real you'll need a backend/auth layer
  (e.g. a serverless function + a database, or a hosted auth provider). Once a team logs in, they'd
  see their own check-in time and stage slot, and be able to submit roster, music, and tech needs.
  Per-team data would move out of the static JSON into that backend.
