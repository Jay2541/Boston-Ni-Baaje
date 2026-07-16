# Boston-Ni-Baaje

Website for Boston Ni Baaje 1.0, Boston's collegiate Raas competition.

## Stack

Vite + vanilla JS, static multi-page site. No framework, no backend — content lives in
`src/data/schedule.json` and plain HTML/CSS/JS.

## Local development

```
npm install
npm run dev
```

## Pages

- `index.html` — homepage
- `schedule.html` — event schedule, venue location, and contact
- `sponsors.html` — sponsor logos, ad space, sponsorship contact

## Updating the schedule

Edit `src/data/schedule.json` — an array of `{ time, event, location }`. No code changes needed.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and deploys it
to GitHub Pages via GitHub Actions.

**One-time setup:** in the repo's GitHub Settings → Pages, set "Source" to **GitHub Actions**
(instead of "Deploy from a branch"). After that, every push to `main` auto-deploys.

Live at: `https://<github-username>.github.io/Boston-Ni-Baaje/`

## TODO before launch

- Swap `public/logo-placeholder.svg` for the real BNB logo
- Replace sponsor logo placeholders in `sponsors.html`
- Fill in real schedule/venue data in `src/data/schedule.json`
- Update contact emails in `src/layout.js`, `schedule.html`, and `sponsors.html`

## Later (v2)

- Per-team portal with individual schedules and login, once teams are confirmed
