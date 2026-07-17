# Firebase setup — team portal & notifications

The code is fully wired. These are the **console steps** to make it live. The
`firebaseConfig` (public keys) is already in `src/firebase.js`.

Project: **boston-ni-baaje** · Do **not** enable Firebase Hosting (GitHub Pages hosts the site).

---

## ✅ Phase 2 — Team chat (built, awaiting accounts)

The two-way chat and board inbox are done. To turn it on:

### 1. Enable Email/Password sign-in
Build → **Authentication** → Get started → **Sign-in method** → enable **Email/Password** → Save.

### 2. Create accounts (deferred until teams are confirmed)
Authentication → **Users** → **Add user**, one per row. Emails are just login IDs
(they don't need to be real inboxes). Hand each team its email + password.

| Account | Email | Password |
|---|---|---|
| Board (directors) | `board@bostonnibaaje.com` | _you choose_ |
| Northeastern Nakhraas | `northeastern@bnb.team` | _you choose_ |
| UConn ThundeRaas | `uconn@bnb.team` | _you choose_ |
| GT Ramblin' Raas | `gatech@bnb.team` | _you choose_ |
| CMU Raasta | `cmu@bnb.team` | _you choose_ |
| UTD TaRaas | `utd@bnb.team` | _you choose_ |
| Texas Raas | `texas@bnb.team` | _you choose_ |
| UF GatoRaas | `uf@bnb.team` | _you choose_ |
| UCF KnightRaas | `ucf@bnb.team` | _you choose_ |

> When the real competing teams are known, update **both** `src/data/members.js`
> (TEAM_ACCOUNTS) **and** `firestore.rules` (teamMap) so the emails/ids match,
> then create the matching users here.

### 3. Publish security rules
Build → **Firestore Database** → **Rules** tab → paste the contents of
`firestore.rules` → **Publish**. (Until you do this, the DB is in open "test
mode" — fine for local testing, **not** for launch.)

That's it — the board account signs in on the Teams page and sees every team's
thread; each team signs in and sees only its own.

---

## ✅ Phase 1 — Updates feed + push notifications (built)

There's an **Updates** page (`updates.html`) with two parts:

- **Updates feed** — announcements stored in Firestore. Everyone sees them in-app
  (works even without push). The **board account** gets a composer to post them.
  This needs **no extra setup** beyond publishing the rules — it works as soon as
  the board account exists.
- **Push notifications** — a "Turn on notifications" button subscribes the device.
  This part needs two more things:

### A. VAPID key (for the subscribe button to work)
Project settings (gear) → **Cloud Messaging** → **Web Push certificates** →
**Generate key pair** → copy the public key → paste it into `VAPID_PUBLIC_KEY`
in `src/firebase.js`. Until this is set, the notifications button stays hidden and
the Updates feed still works.

### B. Deploy the push Worker (so the board can send from a phone)
Broadcasting is handled by a free **Cloudflare Worker** (no credit card, no Blaze
plan). Follow **[`worker/README.md`](./worker/README.md)** to deploy it (~10 min):
you'll log into Cloudflare, give it the Firebase service-account key as an encrypted
secret, deploy, and paste the resulting Worker URL into `PUSH_WORKER_URL` in
`src/firebase.js`.

Once that's set, the board just **posts an announcement on the Updates page from any
phone** → it saves to the feed **and** pushes to every subscribed device. No laptop,
no script.

> Reminder: on iPhone, push only reaches people who **installed the app to their
> home screen** and tapped **Allow**. The Updates feed reaches everyone regardless.
