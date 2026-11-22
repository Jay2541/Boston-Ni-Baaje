// Worker logic tests — no emulator needed. Runs worker/src/worker.js against an
// in-memory fake of Firestore REST, Firebase Auth lookup, OAuth and FCM.
//   node worker-unit.mjs
import { generateKeyPairSync } from 'node:crypto';
import assert from 'node:assert/strict';

const worker = (await import(new URL('../worker/src/worker.js', import.meta.url))).default;

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x.iam', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
  FIREBASE_API_KEY: 'k', PROJECT_ID: 'p', ALLOW_ORIGIN: 'https://bostonnibaaje.com', DIRECTOR_PHONES: '6175550001',
};

const db = new Map(); // path -> fields
const pushes = [], subs = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url); const method = init.method || 'GET';
  const ok = (body, status = 200) => new Response(JSON.stringify(body), { status });
  if (u.host === 'oauth2.googleapis.com') return ok({ access_token: 'a', expires_in: 3600 });
  if (u.host === 'identitytoolkit.googleapis.com') {
    const { idToken } = JSON.parse(init.body);
    return idToken.startsWith('tok:') ? ok({ users: [{ localId: idToken.slice(4) }] }) : ok({}, 400);
  }
  if (u.host === 'fcm.googleapis.com') { pushes.push(JSON.parse(init.body).message); return ok({}); }
  if (u.host === 'iid.googleapis.com') { subs.push(u.pathname.split('/').pop()); return ok({}); }
  const path = u.pathname.split('/documents/')[1].split('/').map(decodeURIComponent).join('/');
  if (method === 'GET') {
    if (path.split('/').length % 2 === 1) {
      const docs = [...db].filter(([k]) => k.startsWith(path + '/')).map(([k, f]) => ({ name: 'x/' + k, fields: f }));
      return ok({ documents: docs });
    }
    return db.has(path) ? ok({ fields: db.get(path) }) : ok({}, 404);
  }
  if (method === 'PATCH') {
    if (u.searchParams.get('currentDocument.exists') === 'false' && db.has(path)) return ok({ error: { status: 'ALREADY_EXISTS' } }, 409);
    db.set(path, JSON.parse(init.body).fields); return ok({});
  }
  if (method === 'DELETE') { db.delete(path); return ok({}); }
};

const call = async (path, body) => {
  const res = await worker.fetch(new Request('https://w' + path, { method: 'POST', body: JSON.stringify(body), headers: { 'CF-Connecting-IP': '1.2.3.4' } }), env);
  return { status: res.status, ...(await res.json()) };
};
const get = (p) => db.get(p);

db.set('joinCodes/board', { code: { stringValue: 'board-SECRET' } });
db.set('joinCodes/uconn', { code: { stringValue: 'uconn-ABC234' } });

// Director signs up with board link
let r = await call('/signup', { code: 'board-SECRET', name: 'Dee Rector', phone: '(617) 555-0001', pin: '1234' });
assert.equal(r.status, 200); assert.ok(r.customToken.split('.').length === 3);
assert.equal(JSON.parse(Buffer.from(r.customToken.split('.')[1], 'base64url')).uid, '+16175550001');
assert.equal(get('members/+16175550001').role.stringValue, 'director');

// Other board link user -> board
r = await call('/signup', { code: 'board-SECRET', name: 'Bo Ard', phone: '6175550002', pin: '1234' });
assert.equal(get('members/+16175550002').role.stringValue, 'board');

// Dancer via uconn link
r = await call('/signup', { code: 'uconn-ABC234', name: 'Dan Sir', phone: '+1 617-555-0003', pin: '4321' });
assert.equal(r.status, 200);
assert.equal(get('members/+16175550003').teamId.stringValue, 'uconn');
assert.equal(get('members/+16175550003').role.stringValue, 'dancer');

// Duplicate number rejected; wrong code rejected; bad pin rejected
assert.equal((await call('/signup', { code: 'uconn-ABC234', name: 'X', phone: '6175550003', pin: '1111' })).status, 409);
assert.equal((await call('/signup', { code: 'uconn-WRONG', name: 'X', phone: '6175550009', pin: '1111' })).status, 400);
assert.equal((await call('/signup', { code: 'gatech-ABC234', name: 'X', phone: '6175550009', pin: '1111' })).status, 400);
assert.equal((await call('/signup', { code: 'uconn-ABC234', name: 'X', phone: '6175550009', pin: '12' })).status, 400);

// Login good / bad / lockout
assert.equal((await call('/login', { phone: '617-555-0003', pin: '4321' })).status, 200);
r = await call('/login', { phone: '6175550003', pin: '0000' }); assert.equal(r.status, 401); assert.match(r.error, /4 tries left/);
for (let i = 0; i < 3; i++) await call('/login', { phone: '6175550003', pin: '0000' });
r = await call('/login', { phone: '6175550003', pin: '0000' }); assert.equal(r.status, 401); assert.match(r.error, /Locked/);
r = await call('/login', { phone: '6175550003', pin: '4321' }); assert.equal(r.status, 429);
assert.equal((await call('/login', { phone: '6175559999', pin: '4321' })).status, 404);

// Admin: non-director rejected; director can list/rotate
assert.equal((await call('/admin/codes', { idToken: 'tok:+16175550003' })).status, 403);
r = await call('/admin/codes', { idToken: 'tok:+16175550001' });
assert.deepEqual(r.codes, { board: 'board-SECRET', uconn: 'uconn-ABC234' });
r = await call('/admin/rotate-code', { idToken: 'tok:+16175550001', target: 'uconn' });
assert.match(r.code, /^uconn-[A-Z2-9]{6}$/);
const newCode = r.code;
assert.equal((await call('/signup', { code: 'uconn-ABC234', name: 'Late', phone: '6175550010', pin: '1111' })).status, 400);
assert.equal((await call('/signup', { code: newCode, name: 'Late', phone: '6175550010', pin: '1111' })).status, 200);

// Reset PIN: clears lockout; re-signup must use own team link; keeps role
await call('/admin/set-role', { idToken: 'tok:+16175550001', phone: '6175550003', role: 'liaison', teamId: 'uconn' });
assert.equal(get('members/+16175550003').role.stringValue, 'liaison');
assert.equal((await call('/admin/reset-pin', { idToken: 'tok:+16175550001', phone: '6175550003' })).status, 200);
assert.equal((await call('/signup', { code: 'board-SECRET', name: 'Dan', phone: '6175550003', pin: '9999' })).status, 400);
assert.equal((await call('/signup', { code: newCode, name: 'Dan', phone: '6175550003', pin: '9999' })).status, 200);
assert.equal(get('members/+16175550003').role.stringValue, 'liaison');
assert.equal((await call('/login', { phone: '6175550003', pin: '9999' })).status, 200);

// Notify: dancer can't post announcements; can post own team; can't post other team
const dancer = 'tok:+16175550010';
assert.equal((await call('/notify', { idToken: dancer, chatId: 'announcements', text: 'hi' })).status, 403);
assert.equal((await call('/notify', { idToken: dancer, chatId: 'team-gatech', text: 'hi' })).status, 403);
assert.equal((await call('/notify', { idToken: dancer, chatId: 'team-uconn', text: 'hi' })).status, 200);
assert.equal(pushes.at(-1).topic, 'chat-team-uconn');
assert.equal(pushes.at(-1).data.link, 'https://bostonnibaaje.com/chat.html#chat=team-uconn');
assert.equal((await call('/notify', { idToken: 'tok:+16175550002', chatId: 'announcements', text: 'Doors open', title: 'Heads up' })).status, 200);
assert.equal(pushes.at(-1).topic, 'all');

// Subscribe topics
await call('/subscribe', { token: 't1', idToken: 'tok:+16175550001' });
assert.deepEqual(subs.splice(0), ['all', 'chat-board', 'chat-team-uconn']);
await call('/subscribe', { token: 't2', idToken: dancer });
assert.deepEqual(subs.splice(0), ['all', 'chat-team-uconn']);
await call('/subscribe', { token: 't3' });
assert.deepEqual(subs.splice(0), ['all']);

// Remove
assert.equal((await call('/admin/remove', { idToken: 'tok:+16175550001', phone: '6175550001' })).status, 400);
await call('/admin/remove', { idToken: 'tok:+16175550001', phone: '6175550010' });
assert.equal(get('members/+16175550010'), undefined);
assert.equal((await call('/notify', { idToken: dancer, chatId: 'team-uconn', text: 'hi' })).status, 403);

console.log('Worker unit tests: all passed');
