// Shared helpers for the announcements ("Updates") feed.
// Announcements live in the top-level `announcements` Firestore collection.
// Only the board account can write (enforced by firestore.rules); anyone can read.
import { db } from '../firebase.js';
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
