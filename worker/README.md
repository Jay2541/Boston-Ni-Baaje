# BNB app Worker (Cloudflare: free, no credit card)

This small Worker is the app's backend. It handles:

- **Phone + PIN accounts:** `POST /signup` (with a team join code) and `POST /login`. It hands back
  a Firebase custom token, which costs nothing and sends no SMS.
- **Push notifications:** `POST /subscribe` adds a device to its chats' FCM topics. `POST /notify`
  pushes a new chat message to everyone in that chat. Announcements go to everyone.
- **Director tools:** `/admin/codes`, `/admin/rotate-code`, `/admin/set-role`, `/admin/reset-pin`
  and `/admin/remove`. These are used by the app's Manage tab.

It reads and writes Firestore with the service account. That means it can write the
collections the rules lock away from clients (`members`, `secrets`, `joinCodes`, `rateLimits`).

The site calls it at `PUSH_WORKER_URL` in `src/firebase.js`.

---

## One-time deploy (~10 min, all free)

You need a free **Cloudflare account** (no card) and Node installed on your computer.

### 1. Install the CLI and log in
```
cd worker
npm install
npx wrangler login        # opens the browser to authorize Cloudflare
```

### 2. Give it the Firebase service-account key (as a secret)
1. Firebase console → Project settings → **Service accounts** → **Generate new private key**.
   A `.json` file downloads.
2. Run this and paste the file's **entire contents** when prompted:
   ```
   npx wrangler secret put SERVICE_ACCOUNT
   ```
> This key is a SECRET. It lives only in Cloudflare's encrypted secret store.
> Never commit it or paste it into the repo.

The service account needs access to both Firestore and Cloud Messaging. The default
`firebase-adminsdk` account Firebase creates already has both.

### 3. Set the directors' numbers (as a secret)
The repo is public, so phone numbers don't go in `wrangler.toml`. Run this and enter the
directors' numbers, comma-separated (e.g. `6175551234,8575550000`):
```
npx wrangler secret put DIRECTOR_PHONES
```
Anyone on that list who signs up with the **board** join link becomes a director.

### 4. Deploy
```
npm run deploy
```
Wrangler prints a URL like `https://bnb-push.<your-subdomain>.workers.dev`. If it doesn't
match `PUSH_WORKER_URL` in `src/firebase.js`, update that and redeploy the site.

---

## Config (`wrangler.toml`)

These go in `[vars]` (none of them are secret):
- `FIREBASE_API_KEY`: the public web API key, used to verify login tokens
- `PROJECT_ID`: `boston-ni-baaje`
- `ALLOW_ORIGIN`: the site origin allowed to call the Worker (CORS)
Secrets, set with `wrangler secret put` (never in git):
- `SERVICE_ACCOUNT`: the Firebase service-account JSON (step 2)
- `DIRECTOR_PHONES`: numbers that become directors when they sign up with the board link (step 3)

## Security notes
- PINs are salted and hashed (PBKDF2). After 5 wrong PINs, the number is locked for 15 minutes.
- Sign-ups are limited to 60 per hour per IP address. That's generous because a whole team
  may sign up on the same practice Wi-Fi.
- Phone numbers aren't verified by SMS. Anyone with a team's join link can join that team.
  Directors can remove people and swap links from the app.

## Cost
Cloudflare Workers' free tier allows 100,000 requests a day with no card. FCM and Firebase
custom tokens are free. Total: $0.
