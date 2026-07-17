// Shared helpers for the announcements ("Updates") feed.
// Announcements live in the top-level `announcements` Firestore collection.
// Only the board account can write (enforced by firestore.rules); anyone can read.
import { db, auth, PUSH_WORKER_URL } from '../firebase.js';
import { getIdToken } from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

const COL = 'announcements';

/** Subscribe to the latest announcements. Returns an unsubscribe fn. */
export function watchAnnouncements(onData, onError, max = 50) {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onError && onError(err)
  );
}

/** Post a new announcement (board only — rules reject others). */
export function postAnnouncement({ title, body }) {
  return addDoc(collection(db, COL), {
    title: title.trim(),
    body: body.trim(),
    createdAt: serverTimestamp(),
  });
}

/**
 * Broadcast to all teams: save to the Updates feed AND push to subscribed phones.
 * One place, used by both the Updates page and the Director Console.
 * Returns { posted, pushed } — posted true if the feed write succeeded, pushed
 * true if the push Worker accepted the send.
 */
export async function broadcast({ title, body }) {
  const t = title.trim();
  const b = body.trim();
  await postAnnouncement({ title: t, body: b }); // throws if the feed write fails

  let pushed = false;
  if (PUSH_WORKER_URL) {
    try {
      const idToken = await getIdToken(auth.currentUser);
      const res = await fetch(`${PUSH_WORKER_URL}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, title: t, body: b }),
      });
      pushed = res.ok;
    } catch {
      /* feed post already succeeded; push is best-effort */
    }
  }
  return { posted: true, pushed };
}
