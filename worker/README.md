# BNB Push Worker (Cloudflare — free, no credit card)

This tiny Worker lets the board **broadcast a push notification to every subscribed
phone straight from the site** (no laptop, no Firebase Blaze plan). It does two things:

- `POST /subscribe` — subscribes a device to the FCM `all` topic
- `POST /send` — verifies the caller is the board account, then pushes to the topic

The site talks to it automatically once you set `PUSH_WORKER_URL` in `src/firebase.js`.

---

## One-time deploy (~10 min, all free)

You need a free **Cloudflare account** (no card) and Node on a computer.

### 1. Install the CLI and log in
```
cd worker
npm install
npx wrangler login        # opens the browser to authorize Cloudflare
```

### 2. Give it the Firebase service-account key (as a secret)
Firebase console → Project settings → **Service accounts** → **Generate new private key**
→ a `.json` downloads. Then paste its **entire contents** when prompted:
```
npx wrangler secret put SERVICE_ACCOUNT
```
> This key is a SECRET. It lives only in Cloudflare's encrypted secret store —
> never commit it or paste it into the repo.

### 3. Deploy
```
npm run deploy
```
Wrangler prints a URL like `https://bnb-push.<your-subdomain>.workers.dev`.

### 4. Point the site at it
Put that URL in `src/firebase.js`:
```js
export const PUSH_WORKER_URL = 'https://bnb-push.<your-subdomain>.workers.dev';
```
Rebuild/redeploy the site (push to `main`). Done — the "Turn on notifications"
button and the board's "post → push" now work.

---

## Config (`wrangler.toml`)

Non-secret values live in `[vars]`:
- `FIREBASE_API_KEY` — public web API key (verifies the board's login token)
- `BOARD_EMAIL` — only this account may broadcast
- `PROJECT_ID` — `boston-ni-baaje`
- `ALLOW_ORIGIN` — the site origin allowed to call the Worker (CORS)

The only secret is `SERVICE_ACCOUNT`, set via `wrangler secret put` (step 2).

## Cost
Cloudflare Workers free tier = 100,000 requests/day, no card. FCM is free. $0.
