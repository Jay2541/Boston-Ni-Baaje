# Firebase setup: BNB app (chats, phone login, notifications)

The code is fully wired. These are the **console steps** to make it live. The
`firebaseConfig` (public keys) is already in `src/firebase.js`.

Project: **boston-ni-baaje**. Do **not** enable Firebase Hosting (GitHub Pages hosts the site).
Everything stays on the **free Spark plan**: there's no SMS, so no Blaze plan is needed.

---

## How login works (no SMS, free)

- Each team has **one join link**: `bostonnibaaje.com/app.html#join=uconn-7KQ2XM`.
  A captain posts it once in the team's group chat, or shows the QR code at practice.
- People open the link and enter their name, phone number and a 4–6 digit PIN. After that,
  they sign in to the app with **phone number + PIN**.
- The Cloudflare Worker (`worker/`) checks the code/PIN and returns a Firebase **custom
  token**. The app signs in with it, so Firestore rules see `request.auth.uid` = their
  phone number (e.g. `+16175551234`).
- Phone numbers aren't verified by SMS. Anyone with a team's link can join that team.
  Directors can remove people, reset PINs and swap a team's link (the old one stops
  working) from the app's **Manage** tab.

> **Firebase Dynamic Links shutdown:** it doesn't affect us. We don't use email-link
> sign-in or Cordova; join links are plain URLs on our own domain. If **Email link
> (passwordless sign-in)** is turned on under Authentication → Sign-in method, you can
> turn it off.

---

## 1. Turn on Authentication
Build → **Authentication** → Get started. Custom-token sign-in needs no provider
switched on. You can **disable Email/Password** now; the old shared team accounts
(`*@bnb.team`, `board@bostonnibaaje.com`) are no longer used and can be deleted.

## 2. Publish security rules
Build → **Firestore Database** → **Rules** tab → paste the contents of
`firestore.rules` → **Publish**.

## 3. Push notifications: VAPID key
Project settings (gear) → **Cloud Messaging** → **Web Push certificates**. The public key
is already in `VAPID_PUBLIC_KEY` in `src/firebase.js`. Only redo this if you generate a new pair.

## 4. Deploy the Worker
Follow **[`worker/README.md`](./worker/README.md)**. Set the `DIRECTOR_PHONES` secret
(`npx wrangler secret put DIRECTOR_PHONES`) to the directors' numbers **before**
anyone signs up with the board link.

## 5. Create the board link, then sign up as the first director
1. Firestore Database → **Start collection** `joinCodes` → document ID `board` →
   field `code` (string) = `board-` followed by something hard to guess, e.g. `board-K7Q2MX9T`.
2. Open `https://bostonnibaaje.com/app.html#join=board-K7Q2MX9T` and sign up with a phone
   number listed in `DIRECTOR_PHONES`. You become a **director**. Anyone else who uses the
   board link becomes a regular **board** member.
3. In the app, open **Manage**. Tap **Create link** for each team, then send each link
   to that team's captain.

From then on everything happens in the app's **Manage** tab:
- **Change someone's role** (dancer / liaison / board / director) or team. Liaisons sign up
  with their team's link, then a director switches them to **Liaison**.
- **Reset PIN:** the person opens their team's join link again and picks a new PIN. They
  keep their role and chats.
- **Remove:** they lose access to every chat immediately.
- **New link:** the old join link for that team stops working. People who already
  joined stay in.

---

## Data (Firestore)

| Path | What | Who can read |
|---|---|---|
| `members/{phone}` | `{ name, role, teamId, createdAt }` | any member (Worker writes) |
| `chats/{chatId}` + `/messages` | team + board chats | that chat's members |
| `announcements/{id}` | Announcements chat **and** the public Updates page | everyone |
| `secrets/{phone}` | PIN hash, failed attempts | nobody (Worker only) |
| `joinCodes/{teamId or board}` | current join code | nobody (Worker only) |
| `rateLimits/{key}` | sign-up throttle | nobody (Worker only) |

Chat ids: `announcements`, `board`, `team-<id>` where `<id>` comes from `src/data/teams.json`.
The old `threads/` collection is no longer used. You can delete it.

## Free-tier limits
Firebase Spark allows 50k document reads a day, and Cloudflare Workers allow 100k requests
a day. That's plenty for one event weekend.

> Reminder: on iPhone, push only reaches people who **installed the app to their home
> screen** and tapped **Turn on** → **Allow**. The app shows a banner for this until
> they do.
