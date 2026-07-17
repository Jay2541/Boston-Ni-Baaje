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
- `teams.html` — competing-teams roster + team portal (real Firebase login + two-way chat with the directors; board account sees all threads)
- `updates.html` — live announcements feed (board posts; everyone reads) + opt-in push notifications
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

**✅ Notifications & Updates feed (built — Firebase):**

- **Updates feed** (`updates.html`): the board posts announcements; everyone reads them in-app.
  Reliable delivery even without push. Free, no card.
- **Push notifications**: opt-in "Turn on notifications" button. The board **posts an announcement
  from any phone** → it saves to the feed *and* buzzes every subscribed device. Sending is handled by
  a free Cloudflare Worker (`worker/`) — no laptop, no credit card.

**To turn it on, follow [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md):** publish `firestore.rules`, add
the VAPID key to `src/firebase.js` (done), and deploy the Worker per [`worker/README.md`](./worker/README.md)
then set `PUSH_WORKER_URL`.

> Note: on iPhone, web push only works **after** the user installs the site to their home screen and
> opens it from that icon — not from a normal Safari tab. That's an Apple restriction, hence the
> "Get the App" instructions. The Updates feed reaches everyone regardless. If push reach ever proves
> insufficient, the fallback is a native App Store build (Capacitor wraps this same site) — that path
> costs $99/yr for an Apple Developer account and requires a Mac.

## Firebase (team portal + notifications)

The Teams page has a **real team portal** backed by Firebase (project `boston-ni-baaje`):

- **Team login** (Firebase Auth, one shared account per team) + a **board/director account**.
- **Two-way real-time chat** (Firestore): each team has a private thread; the board account sees
  every thread and can reply. History is immutable.
- Code lives in `src/firebase.js`, `src/portal.js`, `src/data/members.js`; rules in `firestore.rules`.

**⚠️ Not live until you finish the console steps in [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md):**
enable Email/Password auth, create the accounts (deferred until the competing teams are confirmed),
and publish `firestore.rules`. **Push notifications (Phase 1) are not built yet** — see that doc.

When the real teams are known, update `src/data/members.js` **and** `firestore.rules` together so the
emails/team ids match, then create the matching users in the console.
