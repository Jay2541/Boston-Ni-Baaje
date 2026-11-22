// Security-rules tests for firestore.rules against the Firestore emulator.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp, setLogLevel } from 'firebase/firestore';

setLogLevel('silent'); // denied writes are expected; don't print each one

const env = await initializeTestEnvironment({
  projectId: 'boston-ni-baaje',
  firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});
await env.clearFirestore();

const people = {
  '+10000000001': { name: 'Dir', role: 'director', teamId: '' },
  '+10000000002': { name: 'Board', role: 'board', teamId: '' },
  '+10000000003': { name: 'Liaison', role: 'liaison', teamId: 'uconn' },
  '+10000000004': { name: 'Dancer', role: 'dancer', teamId: 'uconn' },
  '+10000000005': { name: 'GT', role: 'dancer', teamId: 'gatech' },
};
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [uid, m] of Object.entries(people)) await setDoc(doc(db, 'members', uid), m);
  await setDoc(doc(db, 'secrets', '+10000000004'), { pinHash: 'x' });
  await setDoc(doc(db, 'joinCodes', 'uconn'), { code: 'uconn-X' });
  for (const c of ['board', 'team-uconn', 'team-gatech']) {
    await setDoc(doc(db, 'chats', c), { lastMessage: 'seed', lastFrom: 'x', updatedAt: new Date() });
    await setDoc(doc(db, 'chats', c, 'messages', 'm1'), { text: 'seed', uid: '+10000000001', name: 'Dir', createdAt: new Date() });
  }
  await setDoc(doc(db, 'announcements', 'a1'), { title: 't', body: 'b', createdAt: new Date() });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = env.unauthenticatedContext().firestore();
const stranger = as('+19999999999'); // signed in but not a member (removed)
const [dir, board, liaison, dancer, gt] = Object.keys(people).map(as);
const msg = (uid, text = 'hi') => ({ text, uid, name: 'n', createdAt: serverTimestamp() });

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '—', e.message.split('\n')[0]); }
}

console.log('members / secrets / codes');
await t('member can read member directory', () => assertSucceeds(getDocs(collection(dancer, 'members'))));
await t('anon cannot read members', () => assertFails(getDoc(doc(anon, 'members', '+10000000004'))));
await t('non-member cannot read members', () => assertFails(getDoc(doc(stranger, 'members', '+10000000004'))));
await t('dancer cannot promote self', () => assertFails(updateDoc(doc(dancer, 'members', '+10000000004'), { role: 'director' })));
await t('director cannot write members directly', () => assertFails(setDoc(doc(dir, 'members', '+1555'), { role: 'director' })));
await t('nobody reads secrets (even director)', () => assertFails(getDoc(doc(dir, 'secrets', '+10000000004'))));
await t('own secret not readable', () => assertFails(getDoc(doc(dancer, 'secrets', '+10000000004'))));
await t('nobody reads joinCodes', () => assertFails(getDoc(doc(dir, 'joinCodes', 'uconn'))));

console.log('team chats');
await t('dancer reads own team chat', () => assertSucceeds(getDocs(collection(dancer, 'chats', 'team-uconn', 'messages'))));
await t('liaison reads own team chat', () => assertSucceeds(getDocs(collection(liaison, 'chats', 'team-uconn', 'messages'))));
await t('dancer posts in own team chat', () => assertSucceeds(addDoc(collection(dancer, 'chats', 'team-uconn', 'messages'), msg('+10000000004'))));
await t('dancer updates own chat preview', () => assertSucceeds(setDoc(doc(dancer, 'chats', 'team-uconn'), { lastMessage: 'hi', lastFrom: 'Dancer', updatedAt: serverTimestamp() }, { merge: true })));
await t('dancer cannot read other team chat', () => assertFails(getDocs(collection(dancer, 'chats', 'team-gatech', 'messages'))));
await t('dancer cannot read other team preview', () => assertFails(getDoc(doc(dancer, 'chats', 'team-gatech'))));
await t('dancer cannot post in other team chat', () => assertFails(addDoc(collection(gt, 'chats', 'team-uconn', 'messages'), msg('+10000000005'))));
await t('cannot spoof sender uid', () => assertFails(addDoc(collection(dancer, 'chats', 'team-uconn', 'messages'), msg('+10000000001'))));
await t('cannot add extra fields', () => assertFails(addDoc(collection(dancer, 'chats', 'team-uconn', 'messages'), { ...msg('+10000000004'), role: 'director' })));
await t('empty message rejected', () => assertFails(addDoc(collection(dancer, 'chats', 'team-uconn', 'messages'), msg('+10000000004', ''))));
await t('1001-char message rejected', () => assertFails(addDoc(collection(dancer, 'chats', 'team-uconn', 'messages'), msg('+10000000004', 'x'.repeat(1001)))));
await t('messages cannot be edited', () => assertFails(updateDoc(doc(dir, 'chats', 'team-uconn', 'messages', 'm1'), { text: 'edit' })));
await t('messages cannot be deleted', () => assertFails(deleteDoc(doc(dir, 'chats', 'team-uconn', 'messages', 'm1'))));
await t('director reads any team chat', () => assertSucceeds(getDocs(collection(dir, 'chats', 'team-gatech', 'messages'))));
await t('director posts in any team chat', () => assertSucceeds(addDoc(collection(dir, 'chats', 'team-gatech', 'messages'), msg('+10000000001'))));
await t('non-director board cannot read team chats', () => assertFails(getDocs(collection(board, 'chats', 'team-uconn', 'messages'))));
await t('removed member loses access', () => assertFails(getDocs(collection(stranger, 'chats', 'team-uconn', 'messages'))));
await t('unknown chat id denied', () => assertFails(getDocs(collection(dir, 'chats', 'random', 'messages'))));

console.log('board chat');
await t('board reads board chat', () => assertSucceeds(getDocs(collection(board, 'chats', 'board', 'messages'))));
await t('director posts board chat', () => assertSucceeds(addDoc(collection(dir, 'chats', 'board', 'messages'), msg('+10000000001'))));
await t('liaison cannot read board chat', () => assertFails(getDocs(collection(liaison, 'chats', 'board', 'messages'))));
await t('dancer cannot read board chat', () => assertFails(getDocs(collection(dancer, 'chats', 'board', 'messages'))));

console.log('announcements');
await t('anyone (even anon) reads announcements', () => assertSucceeds(getDocs(collection(anon, 'announcements'))));
await t('board posts announcement', () => assertSucceeds(addDoc(collection(board, 'announcements'), { title: '', body: 'b', uid: '+10000000002', name: 'B', createdAt: serverTimestamp() })));
await t('dancer cannot post announcement', () => assertFails(addDoc(collection(dancer, 'announcements'), { body: 'b' })));
await t('liaison cannot post announcement', () => assertFails(addDoc(collection(liaison, 'announcements'), { body: 'b' })));
await t('board cannot delete announcement', () => assertFails(deleteDoc(doc(board, 'announcements', 'a1'))));
await t('director can delete announcement', () => assertSucceeds(deleteDoc(doc(dir, 'announcements', 'a1'))));

console.log('retired');
await t('old threads/ denied', () => assertFails(getDocs(collection(dir, 'threads', 'uconn', 'messages'))));

await env.cleanup();
console.log(`\nRules: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
