/*
 * Boston Ni Baaje app backend — Cloudflare Worker (free tier, no card).
 *
 * Login is phone number + PIN. No SMS is sent (that costs money): instead each
 * team shares ONE join link (`app.html#join=<code>`), and anyone with the link
 * can sign up for that team. The Worker checks the code/PIN and hands back a
 * Firebase custom token, so Firebase Auth + Firestore rules keep working.
 * (Custom tokens are free on the Spark plan and don't use Dynamic Links.)
 *
 * Endpoints:
 *   POST /signup    { code, name, phone, pin }  → { customToken }
 *   POST /login     { phone, pin }              → { customToken }
 *   POST /subscribe { token, idToken? }         → subscribe a device to push topics
 *   POST /notify    { idToken, chatId, text, title? } → push a chat message
 *   POST /admin/codes       { idToken }                    → { codes: {target: code} }
 *   POST /admin/rotate-code { idToken, target }            → { code }
 *   POST /admin/set-role    { idToken, phone, role, teamId? }
 *   POST /admin/reset-pin   { idToken, phone }
 *   POST /admin/remove      { idToken, phone }
 *
 * Firestore (written with the service account, so rules don't apply here):
 *   members/{phone}   { name, role, teamId, createdAt }   — readable by members
 *   secrets/{phone}   { pinHash, pinSalt, failedAttempts, lockedUntil } — worker only
 *   joinCodes/{teamId|'board'} { code }                   — worker only
 *   rateLimits/{key}  { count, windowStart }               — worker only
 *
 * Secrets/vars (set via `wrangler secret put` / wrangler.toml — never in git):
 *   SERVICE_ACCOUNT  (secret) — the Firebase service-account JSON, as a string
 *   FIREBASE_API_KEY (var)    — public web API key, for verifying login tokens
 *   PROJECT_ID       (var)    — Firebase project id
 *   ALLOW_ORIGIN     (var)    — the site origin allowed to call this (CORS)
 *   DIRECTOR_PHONES  (secret) — comma-separated numbers that become directors
 *                               when they sign up with the board link
 */

const ALL_TOPIC = 'all';
const ROLES = ['director', 'board', 'liaison', 'dancer'];
const STAFF = ['director', 'board'];
const MAX_PIN_TRIES = 5;
const LOCK_MINUTES = 15;
const SIGNUPS_PER_HOUR_PER_IP = 60; // a whole team may sign up on one practice Wi-Fi
// The free plan caps CPU at ~10ms/request, so keep PBKDF2 light. A 4–6 digit PIN
// is protected by the lockout + secrets being unreadable, not by hash cost.
const PBKDF2_ITERATIONS = 5000;

const SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase.messaging',
].join(' ');

const ROUTES = {
  '/signup': handleSignup,
  '/login': handleLogin,
  '/subscribe': handleSubscribe,
  '/notify': handleNotify,
  '/admin/codes': handleListCodes,
  '/admin/rotate-code': handleRotateCode,
  '/admin/set-role': handleSetRole,
  '/admin/reset-pin': handleResetPin,
  '/admin/remove': handleRemove,
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const handler = ROUTES[url.pathname];
    if (request.method !== 'POST' || !handler) return json({ error: 'not found' }, 404, cors);
    try {
      const body = await request.json();
      return json(await handler(body, env, request), 200, cors);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 400;
      return json({ error: String(err?.message || err) }, status, cors);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ============================================================
   AUTH — sign up with a join code, log in with phone + PIN
   ============================================================ */
async function handleSignup({ code, name, phone, pin }, env, request) {
  const uid = normalizePhone(phone);
  const cleanName = String(name || '').trim().slice(0, 60);
  if (!cleanName) throw new HttpError(400, 'Please enter your name.');
  checkPinFormat(pin);

  await rateLimit(env, `signup-${await sha256Hex(clientIp(request))}`, SIGNUPS_PER_HOUR_PER_IP);

  const target = await targetForCode(env, code);
  if (!target) throw new HttpError(400, 'That join link is invalid or expired. Ask your captain for the current one.');

  // After a director resets someone's PIN their member doc still exists: they
  // keep their role/team, but must use their own group's link to set a new PIN.
  const existing = await fsGet(env, `members/${uid}`);
  if (existing) {
    const group = STAFF.includes(existing.role) ? 'board' : existing.teamId;
    if (group !== target) throw new HttpError(400, 'Use your own team’s join link to reset your PIN.');
  }

  // A number can only be claimed once. Creating the secret with an
  // "must not exist" precondition makes this atomic.
  const salt = randomHex(16);
  const created = await fsCreate(env, `secrets/${uid}`, {
    pinHash: await hashPin(pin, salt),
    pinSalt: salt,
    failedAttempts: 0,
    lockedUntil: 0,
  });
  if (!created) {
    throw new HttpError(409, 'That number already has an account. Sign in with your PIN, or ask a director to reset it.');
  }

  if (!existing) {
    const directors = String(env.DIRECTOR_PHONES || '')
      .split(',').map((p) => p.trim()).filter(Boolean).map(normalizePhone);
    const role = target === 'board' ? (directors.includes(uid) ? 'director' : 'board') : 'dancer';
    try {
      await fsSet(env, `members/${uid}`, {
        name: cleanName,
        role,
        teamId: target === 'board' ? '' : target,
        createdAt: new Date(),
      });
    } catch (err) {
      await fsDelete(env, `secrets/${uid}`); // don't leave the number stuck half-claimed
      throw err;
    }
  }

  return { customToken: await mintCustomToken(env, uid) };
}

async function handleLogin({ phone, pin }, env) {
  const uid = normalizePhone(phone);
  checkPinFormat(pin);

  const secret = await fsGet(env, `secrets/${uid}`);
  const member = secret && (await fsGet(env, `members/${uid}`));
  if (!secret || !member) {
    throw new HttpError(404, 'No account for that number yet. Use your team’s join link to sign up.');
  }

  const now = Date.now();
  if (secret.lockedUntil > now) {
    const mins = Math.ceil((secret.lockedUntil - now) / 60000);
    throw new HttpError(429, `Too many wrong PINs. Try again in ${mins} min, or ask a director to reset it.`);
  }

  if ((await hashPin(pin, secret.pinSalt)) !== secret.pinHash) {
    const tries = (secret.failedAttempts || 0) + 1;
    const locked = tries >= MAX_PIN_TRIES;
    await fsSet(env, `secrets/${uid}`, {
      ...secret,
      failedAttempts: locked ? 0 : tries,
      lockedUntil: locked ? now + LOCK_MINUTES * 60000 : 0,
    });
    throw new HttpError(401, locked
      ? `Too many wrong PINs. Locked for ${LOCK_MINUTES} min.`
      : `Wrong PIN. ${MAX_PIN_TRIES - tries} tries left.`);
  }

  if (secret.failedAttempts) await fsSet(env, `secrets/${uid}`, { ...secret, failedAttempts: 0, lockedUntil: 0 });
  return { customToken: await mintCustomToken(env, uid) };
}

/* ============================================================
   PUSH — per-chat FCM topics
   ============================================================ */
async function handleSubscribe({ token, idToken }, env) {
  if (!token) throw new Error('missing token');

  // Everyone (even signed-out visitors on the Updates page) gets announcements.
  const topics = [ALL_TOPIC];
  if (idToken) {
    const { member } = await callerFromIdToken(env, idToken);
    for (const chatId of await chatsFor(env, member)) {
      if (chatId !== 'announcements') topics.push(topicFor(chatId));
    }
  }

  const access = await getAccessToken(env);
  for (const topic of topics) {
    const res = await fetch(`https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topic}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, access_token_auth: 'true' },
    });
    if (!res.ok) throw new Error(`subscribe failed: ${res.status} ${await res.text()}`);
  }
  return { ok: true, topics };
}

async function handleNotify({ idToken, chatId, text, title }, env) {
  if (!chatId || !text) throw new Error('missing chatId/text');
  const { member } = await callerFromIdToken(env, idToken);
  if (!canPost(member, chatId)) throw new HttpError(403, 'not authorized');

  const isAnnouncement = chatId === 'announcements';
  const access = await getAccessToken(env);
  const link = `${env.ALLOW_ORIGIN}/chat.html#chat=${encodeURIComponent(chatId)}`;
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        topic: isAnnouncement ? ALL_TOPIC : topicFor(chatId),
        notification: {
          title: isAnnouncement ? (title || '📣 Boston Ni Baaje') : `${member.name} · ${chatLabel(chatId)}`,
          body: String(text).slice(0, 200),
        },
        data: { chatId, link },
        webpush: { fcm_options: { link } },
      },
    }),
  });
  if (!res.ok) throw new Error(`send failed: ${res.status} ${await res.text()}`);
  return { ok: true };
}

/* ============================================================
   ADMIN — directors manage join codes + members
   ============================================================ */
async function handleListCodes({ idToken }, env) {
  await requireDirector(env, idToken);
  const docs = await fsList(env, 'joinCodes');
  return { codes: Object.fromEntries(docs.map((d) => [d.id, d.data.code])) };
}

async function handleRotateCode({ idToken, target }, env) {
  await requireDirector(env, idToken);
  if (!/^[a-z0-9]+$/.test(String(target || ''))) throw new Error('invalid target');
  const code = `${target}-${randomCode(6)}`;
  await fsSet(env, `joinCodes/${target}`, { code });
  return { code };
}

async function handleSetRole({ idToken, phone, role, teamId }, env) {
  await requireDirector(env, idToken);
  const uid = normalizePhone(phone);
  if (!ROLES.includes(role)) throw new Error('invalid role');
  const member = await fsGet(env, `members/${uid}`);
  if (!member) throw new HttpError(404, 'member not found');
  const team = STAFF.includes(role) ? '' : String(teamId || member.teamId || '');
  if (!STAFF.includes(role) && !/^[a-z0-9]+$/.test(team)) throw new Error('team required for this role');
  await fsSet(env, `members/${uid}`, { ...member, role, teamId: team });
  return { ok: true };
}

async function handleResetPin({ idToken, phone }, env) {
  await requireDirector(env, idToken);
  await fsDelete(env, `secrets/${normalizePhone(phone)}`);
  return { ok: true };
}

async function handleRemove({ idToken, phone }, env) {
  const { uid: self } = await requireDirector(env, idToken);
  const uid = normalizePhone(phone);
  if (uid === self) throw new Error('you can’t remove yourself');
  await fsDelete(env, `secrets/${uid}`);
  await fsDelete(env, `members/${uid}`);
  return { ok: true };
}

/* ---------- Who can see / post where (mirrors firestore.rules) ---------- */
async function chatsFor(env, member) {
  const chats = ['announcements'];
  if (STAFF.includes(member.role)) chats.push('board');
  if (member.role === 'director') {
    const teams = (await fsList(env, 'joinCodes')).map((d) => d.id).filter((id) => id !== 'board');
    chats.push(...teams.map((t) => `team-${t}`));
  } else if (member.teamId) {
    chats.push(`team-${member.teamId}`);
  }
  return chats;
}

function canPost(member, chatId) {
  if (chatId === 'announcements' || chatId === 'board') return STAFF.includes(member.role);
  if (chatId.startsWith('team-')) {
    return member.role === 'director' || chatId === `team-${member.teamId}`;
  }
  return false;
}

const topicFor = (chatId) => `chat-${chatId}`;
const chatLabel = (chatId) => (chatId === 'board' ? 'Board' : chatId.startsWith('team-') ? 'Team chat' : 'BNB');

async function requireDirector(env, idToken) {
  const caller = await callerFromIdToken(env, idToken);
  if (caller.member.role !== 'director') throw new HttpError(403, 'directors only');
  return caller;
}

/** Verify a Firebase ID token via the Auth REST API and load the member. */
async function callerFromIdToken(env, idToken) {
  if (!idToken) throw new HttpError(401, 'not signed in');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const uid = res.ok ? (await res.json())?.users?.[0]?.localId : null;
  if (!uid) throw new HttpError(401, 'not signed in');
  const member = await fsGet(env, `members/${uid}`);
  if (!member) throw new HttpError(403, 'not a member');
  return { uid, member };
}

/* ---------- Input helpers ---------- */
function normalizePhone(raw) {
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  throw new HttpError(400, 'Enter a valid phone number.');
}

function checkPinFormat(pin) {
  if (!/^\d{4,6}$/.test(String(pin || ''))) throw new HttpError(400, 'PIN must be 4–6 digits.');
}

async function targetForCode(env, code) {
  const c = String(code || '').trim();
  const target = c.split('-')[0].toLowerCase();
  if (!/^[a-z0-9]+$/.test(target)) return null;
  const doc = await fsGet(env, `joinCodes/${target}`);
  return doc && doc.code === c ? target : null;
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

async function rateLimit(env, key, maxPerHour) {
  const now = Date.now();
  const doc = await fsGet(env, `rateLimits/${key}`);
  const fresh = !doc || now - doc.windowStart > 3600_000;
  const count = fresh ? 1 : doc.count + 1;
  if (count > maxPerHour) throw new HttpError(429, 'Too many sign-ups from this network. Try again later.');
  await fsSet(env, `rateLimits/${key}`, { count, windowStart: fresh ? now : doc.windowStart });
}

/* ============================================================
   FIRESTORE REST (service account — bypasses rules)
   ============================================================ */
function docUrl(env, path) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://firestore.googleapis.com/v1/projects/${env.PROJECT_ID}/databases/(default)/documents/${encoded}`;
}

async function fsFetch(env, url, init = {}) {
  const access = await getAccessToken(env);
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', ...init.headers },
  });
}

async function fsGet(env, path) {
  const res = await fsFetch(env, docUrl(env, path));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore get failed: ${res.status}`);
  return fromFields((await res.json()).fields || {});
}

async function fsList(env, collection) {
  const res = await fsFetch(env, `${docUrl(env, collection)}?pageSize=300`);
  if (!res.ok) throw new Error(`firestore list failed: ${res.status}`);
  const { documents = [] } = await res.json();
  return documents.map((d) => ({ id: d.name.split('/').pop(), data: fromFields(d.fields || {}) }));
}

async function fsSet(env, path, data) {
  const res = await fsFetch(env, docUrl(env, path), {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`firestore write failed: ${res.status}`);
}

/** Create only if the doc doesn't exist. Returns false if it already did. */
async function fsCreate(env, path, data) {
  const res = await fsFetch(env, `${docUrl(env, path)}?currentDocument.exists=false`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 409 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(body)) return false;
    throw new Error(`firestore create failed: ${res.status}`);
  }
  return true;
}

async function fsDelete(env, path) {
  const res = await fsFetch(env, docUrl(env, path), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`firestore delete failed: ${res.status}`);
}

function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) out[k] = { timestampValue: v.toISOString() };
    else if (typeof v === 'number') out[k] = { integerValue: String(Math.round(v)) };
    else if (typeof v === 'boolean') out[k] = { booleanValue: v };
    else if (v == null) out[k] = { nullValue: null };
    else out[k] = { stringValue: String(v) };
  }
  return out;
}

function fromFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = v.doubleValue;
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('timestampValue' in v) out[k] = new Date(v.timestampValue);
    else if ('nullValue' in v) out[k] = null;
    else out[k] = v.stringValue;
  }
  return out;
}

/* ============================================================
   TOKENS — OAuth access token + Firebase custom token (RS256 JWTs)
   ============================================================ */
let cachedToken = null; // { token, exp } — reused across requests in a warm worker

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = JSON.parse(env.SERVICE_ACCOUNT);
  const jwt = await signJwt(sa.private_key, {
    iss: sa.client_email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

/** A token the client exchanges via signInWithCustomToken (uid = phone number). */
async function mintCustomToken(env, uid) {
  const sa = JSON.parse(env.SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  return signJwt(sa.private_key, {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid,
  });
}

async function signJwt(pem, claims) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  return `${unsigned}.${await signRS256(unsigned, pem)}`;
}

/* ---------- crypto helpers (Web Crypto, available in Workers) ---------- */
async function signRS256(data, pem) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return b64urlBytes(new Uint8Array(sig));
}

async function hashPin(pin, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function sha256Hex(str) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))).slice(0, 32);
}

function randomHex(n) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(n)));
}

// No 0/O/1/I/L so codes are easy to read out loud.
function randomCode(n) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => alphabet[b % alphabet.length]).join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(hex) {
  return new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function b64url(str) {
  return b64urlBytes(new TextEncoder().encode(str));
}
function b64urlBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function corsHeaders(env, request) {
  // Echo the caller's Origin when it matches ALLOW_ORIGIN (case-insensitively),
  // because browsers require an EXACT case match on Access-Control-Allow-Origin
  // and GitHub Pages sends the origin lowercased (jay2541 vs Jay2541).
  const reqOrigin = request?.headers?.get('Origin') || '';
  const allowed = env.ALLOW_ORIGIN || '*';
  const origin =
    allowed === '*' ? '*'
    : reqOrigin && reqOrigin.toLowerCase() === allowed.toLowerCase() ? reqOrigin
    : allowed;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
