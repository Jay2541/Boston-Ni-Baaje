/*
 * Boston Ni Baaje push sender — Cloudflare Worker (free tier, no card).
 *
 * Two endpoints:
 *   POST /subscribe { token }              → subscribe a device to the "all" topic
 *   POST /send      { idToken, title, body } → board broadcasts to the "all" topic
 *
 * Secrets/vars (set via `wrangler secret put` / wrangler.toml — never in git):
 *   SERVICE_ACCOUNT  (secret) — the Firebase service-account JSON, as a string
 *   FIREBASE_API_KEY (var)    — public web API key, for verifying the board's login
 *   BOARD_EMAIL      (var)    — the board account email
 *   PROJECT_ID       (var)    — Firebase project id
 *   ALLOW_ORIGIN     (var)    — the site origin allowed to call this (CORS)
 */

const TOPIC = 'all';

export default {
  async fetch(request, env) {
    const cors = corsHeaders(env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/subscribe') {
        return json(await handleSubscribe(request, env), 200, cors);
      }
      if (request.method === 'POST' && url.pathname === '/send') {
        return json(await handleSend(request, env), 200, cors);
      }
      return json({ error: 'not found' }, 404, cors);
    } catch (err) {
      return json({ error: String(err?.message || err) }, 400, cors);
    }
  },
};

/* ---------- Subscribe a device token to the topic ---------- */
async function handleSubscribe(request, env) {
  const { token } = await request.json();
  if (!token) throw new Error('missing token');

  const access = await getAccessToken(env);
  const res = await fetch(`https://iid.googleapis.com/iid/v1/${token}/rel/topics/${TOPIC}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, access_token_auth: 'true' },
  });
  if (!res.ok) throw new Error(`subscribe failed: ${res.status} ${await res.text()}`);
  return { ok: true };
}

/* ---------- Board broadcasts to the topic ---------- */
async function handleSend(request, env) {
  const { idToken, title, body } = await request.json();
  if (!idToken || !title || !body) throw new Error('missing idToken/title/body');

  // Verify the caller is the board account.
  const email = await emailFromIdToken(idToken, env.FIREBASE_API_KEY);
  if (!email || email.toLowerCase() !== env.BOARD_EMAIL.toLowerCase()) {
    throw new Error('not authorized');
  }

  const access = await getAccessToken(env);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${env.PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          topic: TOPIC,
          notification: { title, body },
          webpush: { fcm_options: { link: `${env.ALLOW_ORIGIN}/Boston-Ni-Baaje/updates.html` } },
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`send failed: ${res.status} ${await res.text()}`);
  return { ok: true };
}

/* ---------- Verify board login via Firebase Auth REST ---------- */
async function emailFromIdToken(idToken, apiKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.users?.[0]?.email || null;
}

/* ---------- OAuth2 access token from the service account (RS256 JWT) ---------- */
let cachedToken = null; // { token, exp } — reused across requests in a warm worker

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = JSON.parse(env.SERVICE_ACCOUNT);
  const scope = 'https://www.googleapis.com/auth/firebase.messaging';
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signature = await signRS256(unsigned, sa.private_key);
  const jwt = `${unsigned}.${signature}`;

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

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
