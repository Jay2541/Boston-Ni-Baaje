# Tests

Everything runs locally against the Firebase emulators. Nothing touches the
real Firebase project or the live site.

## One-time setup
- **Java** (the Firestore emulator needs it): `brew install openjdk`, then add it
  to your PATH: `export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"`
- **Google Chrome**, installed normally. On another OS, set `CHROME_PATH`.
- `npm install` in this folder. The root project also needs `npm install`, since the
  test builds the site.

## Run
```
cd tests
npm test            # everything (~2–3 min)
npm run test:worker # just the worker logic, no emulator needed (~1 sec)
```

`npm test` runs:
1. **Worker unit tests** (`worker-unit.mjs`): sign-up, login, PIN lockout, director
   tools and push targeting, against fake Google APIs.
2. **Security rules** (`rules.mjs`): who can read and write each chat, members,
   secrets and announcements.
3. **End-to-end** (`e2e.mjs`): builds the site pointed at the emulators, runs the
   real worker locally (`worker-server.mjs`), then a director and a dancer use it
   in phone-sized Chrome: join links, chats, announcements, login, Manage.
   Screenshots go to `tests/shots/`.

## Notes
- In emulator mode the site forces Firestore's long-polling connection (see
  `src/firebase.js`). The emulator's streaming connection can stall writes when
  several test browsers are connected. Production isn't affected.
- Each test "phone" is its own Chrome process, like separate devices.
