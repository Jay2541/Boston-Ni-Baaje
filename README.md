# Boston-Ni-Baaje

Website for Boston Ni Baaje 1.0, Boston's collegiate Raas competition.

## Stack

Vite + vanilla JS, static multi-page site. No framework, no backend, no dependencies beyond Vite.
Content lives in `src/data/` and plain HTML/CSS/JS. Design system (colors, fonts, animations) is in
`src/style.css`.

Features: sticky glass nav with mobile menu, animated hero with floating particles, scroll-reveal
animations, animated stat counters, and a day-grouped schedule timeline. Respects
`prefers-reduced-motion`.

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
- `teams.html` — competing-teams roster + a link to the app for team chat
- `updates.html` — live announcements feed (posted from the app's Announcements chat; everyone reads) + opt-in push notifications
- `discover.html` — things to do around Boston (food, nightlife, sights, transit)
- `sponsors.html` — sponsor logos, ad space, sponsorship contact
- `app.html` — "Get the App": where team join links land (`app.html#join=<code>`) — sign up with phone + PIN, then install steps for the visitor's phone
- `chat.html` — the app itself (opens from the home-screen icon): chats, info, and the directors' Manage screen

## Updating content

- **Event details** (venue, contact emails, social links): edit `src/data/event.js`. The footer, venue
  cards, and contact links all read from here.
- **Schedule**: edit `src/data/schedule.json` — an array of
  `{ day, time, event, location, note }`. Items are grouped by `day` into the timeline
  automatically. No code changes needed.
- **Sponsor logos**: replace the placeholder `.sponsor-card` blocks in `sponsors.html` with
  `<img src="..." alt="Sponsor name" />`.
- **Competing teams**: edit `src/data/teams.json` — an array of
  `{ id, name, school, initials, color }`. `id` is lowercase letters/numbers only and is used in
  join codes and chat ids (`team-<id>`), so don't change it once people have joined.
- **Discover Boston spots**: edit `src/data/discover.json` — grouped `{ category, eyebrow, blurb, places[] }`.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and deploys it
to GitHub Pages via GitHub Actions.

**One-time setup:** in the repo's GitHub Settings → Pages, set "Source" to **GitHub Actions**
(instead of "Deploy from a branch"). After that, every push to `main` auto-deploys.

Live at: `https://bostonnibaaje.com/`

### Custom domain DNS

GitHub Pages hosts the site while the domain remains registered with Squarespace. In Squarespace,
remove the default Squarespace website records and set these DNS records instead:

- `A` record for `@` → `185.199.108.153`
- `A` record for `@` → `185.199.109.153`
- `A` record for `@` → `185.199.110.153`
- `A` record for `@` → `185.199.111.153`
- `CNAME` record for `www` → `jay2541.github.io`

Keep the email-security records if they are needed for email. GitHub Pages will issue HTTPS after DNS
propagates; enable **Enforce HTTPS** in the repository's Pages settings once it becomes available.

## TODO before launch

- Wire up push notifications — see [App & notifications](#app--notifications) (the Firebase step)
- Replace sponsor logo placeholders in `sponsors.html`
- Confirm event details in `src/data/event.js` before launch
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

## The app: team chats with phone-number login

The installed app (`chat.html`) is the main way everyone communicates during the event:

- **Chats:** Announcements (everyone reads; board + directors post), a private Board chat, and one
  chat per team (that team's dancers + liaison(s) + the directors).
- **Login is phone number + PIN, and it's free.** No SMS is sent (that needs Firebase's paid Blaze
  plan). Instead each team has **one join link** that a captain posts in their group chat; anyone
  with it can sign up for that team. Directors can remove people, reset PINs, and swap a team's
  link from the app's **Manage** tab.
- The Cloudflare Worker in `worker/` checks join codes and PINs and issues Firebase custom tokens,
  so Firestore security rules (`firestore.rules`) still decide who can read what.
- Code: `src/chat.js` (app), `src/app.js` (join + install page), `src/api.js` (Worker calls),
  `src/data/chat.js` (chats + members), `src/push.js` (notifications).

**Setup steps are in [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md)** (Firestore rules, Worker deploy,
first director).

**Tests:** `cd tests && npm install && npm test` runs the worker, security-rules and end-to-end
tests locally against the Firebase emulators. See [`tests/README.md`](./tests/README.md).
