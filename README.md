# Boston-Ni-Baaje

Website for Boston Ni Baaje 1.0, Boston's collegiate Raas competition.

## Stack

Vite + vanilla JS, static multi-page site. No framework, no backend, no dependencies beyond Vite.
Content lives in `src/data/` and plain HTML/CSS/JS. Design system (colors, fonts, animations) is in
`src/style.css`.

Features: sticky glass nav with mobile menu, animated hero with floating particles, a live countdown
timer to the event, scroll-reveal animations, animated stat counters, and a day-grouped schedule
timeline. Respects `prefers-reduced-motion`.

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

- Swap `public/logo.svg` (crossed-dandiya placeholder) for the real BNB logo
- Replace sponsor logo placeholders in `sponsors.html`
- Confirm event details in `src/data/event.js` (Feb 19–20, 2027 at the Huntington Theatre; `startISO` drives the countdown — update the year if the date shifts)
- Fill in real schedule data in `src/data/schedule.json`
- Update the homepage stat numbers in `index.html` (`data-target` values)

## Later (v2)

- **Team portal with real auth** — the `teams.html` sign-in form is currently a front-end preview
  (it shows a "coming soon" message on submit). To make it real you'll need a backend/auth layer
  (e.g. a serverless function + a database, or a hosted auth provider). Once a team logs in, they'd
  see their own check-in time and stage slot, and be able to submit roster, music, and tech needs.
  Per-team data would move out of the static JSON into that backend.
