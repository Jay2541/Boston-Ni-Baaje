// Chats + members for the app (chat.html).
//
// Chats (keep in sync with firestore.rules and worker/src/worker.js):
//   announcements — everyone reads; board + directors post. Stored in the
//                   top-level `announcements` collection so the public Updates
//                   page shows the same posts.
//   board         — board + directors
//   team-{teamId} — that team's dancers + liaisons, plus directors
import { db } from '../firebase.js';
import { callWorker } from '../api.js';
import TEAMS from './teams.json';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  query,
  orderBy,
  limit,
  limitToLast,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';

export { TEAMS };

export const ROLE_LABELS = {
  director: 'Director',
  board: 'Board',
  liaison: 'Liaison',
  dancer: 'Dancer',
};

const STAFF = ['director', 'board'];
export const isStaff = (member) => STAFF.includes(member?.role);

export function teamById(id) {
  return TEAMS.find((t) => t.id === id) || null;
}

/** The chats a member belongs to, in display order. */
export function chatsFor(member) {
  const chats = [{ id: 'announcements', name: 'Announcements', icon: '📣' }];
  if (isStaff(member)) chats.push({ id: 'board', name: 'Board', icon: '🔒' });
  const teams = member.role === 'director' ? TEAMS : TEAMS.filter((t) => t.id === member.teamId);
  for (const t of teams) chats.push({ id: `team-${t.id}`, name: t.name, team: t });
  return chats;
}

export function canPost(member, chatId) {
  return chatId === 'announcements' ? isStaff(member) : true;
}

/** Live member doc (role/team can change while the app is open). */
export function watchMember(uid, onData, onError) {
  return onSnapshot(
    doc(db, 'members', uid),
    (snap) => onData(snap.exists() ? { uid, ...snap.data() } : null),
    onError
  );
}

/** Every member — used for the directors' Manage screen. */
export function watchMembers(onData, onError) {
  return onSnapshot(
    collection(db, 'members'),
    (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    onError
  );
}

/** Last-message previews for the chat list. Returns one unsubscribe fn. */
export function watchChatPreviews(chatIds, onData) {
  const previews = {};
  const unsubs = chatIds.map((id) => {
    const src = id === 'announcements'
      ? query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(1))
      : doc(db, 'chats', id);
    return onSnapshot(src, (snap) => {
      if (id === 'announcements') {
        const a = snap.docs[0]?.data();
        previews[id] = a ? { lastMessage: a.title ? `${a.title}: ${a.body}` : a.body, updatedAt: a.createdAt } : null;
      } else {
        previews[id] = snap.exists() ? snap.data() : null;
      }
      onData({ ...previews });
    }, () => {});
  });
  return () => unsubs.forEach((u) => u());
}

/** Live messages for one chat, oldest first, as { id, text, title?, uid, name, createdAt }. */
export function watchMessages(chatId, onData, onError) {
  if (chatId === 'announcements') {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(
      q,
      (snap) => onData(snap.docs.map((d) => {
        const a = d.data();
        return { id: d.id, text: a.body, title: a.title, uid: a.uid, name: a.name || 'Directors', createdAt: a.createdAt };
      }).reverse()),
      onError
    );
  }
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limitToLast(200));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/**
 * Send a message, update the chat-list preview, then push it to the chat's
 * members. The push is best-effort — the message is already saved.
 */
export async function sendMessage(chatId, member, text, title = '') {
  const t = text.trim();
  if (!t) return;
  if (chatId === 'announcements') {
    await addDoc(collection(db, 'announcements'), {
      title: title.trim(),
      body: t,
      uid: member.uid,
      name: member.name,
      createdAt: serverTimestamp(),
    });
  } else {
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: t,
      uid: member.uid,
      name: member.name,
      createdAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, 'chats', chatId),
      { lastMessage: t, lastFrom: member.name, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }
  callWorker('/notify', { chatId, text: t, title: title.trim() }, { withAuth: true }).catch(() => {});
}
