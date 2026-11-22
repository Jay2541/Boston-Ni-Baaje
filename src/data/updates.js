// Shared helpers for the announcements ("Updates") feed.
// Announcements live in the top-level `announcements` Firestore collection.
// Board + directors post them from the app's Announcements chat (see
// src/data/chat.js); anyone can read (enforced by firestore.rules).
import { db } from '../firebase.js';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

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
