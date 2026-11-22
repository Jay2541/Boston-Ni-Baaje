// Runs the real worker/src/worker.js locally on :8787, with Google APIs pointed
// at the Firebase emulators (Firestore :8080, Auth :9099). FCM calls are
// appended to push-log.jsonl so the e2e test can check who got notified.
import http from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { appendFileSync, writeFileSync } from 'node:fs';

const worker = (await import(new URL('../worker/src/worker.js', import.meta.url))).default;
export const PUSH_LOG = new URL('./push-log.jsonl', import.meta.url);

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@local', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
  FIREBASE_API_KEY: 'fake-key',
  PROJECT_ID: 'boston-ni-baaje',
  ALLOW_ORIGIN: 'http://localhost:5173',
  DIRECTOR_PHONES: '6175550001',
};

const realFetch = globalThis.fetch;

/** Route the worker's outgoing calls to the emulators / a log file. */
function fakeGoogle(url, init = {}) {
  const u = new URL(url);
  const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
  if (u.host === 'oauth2.googleapis.com') return ok({ access_token: 'owner', expires_in: 3600 });
  if (u.host === 'fcm.googleapis.com') {
    appendFileSync(PUSH_LOG, JSON.stringify({ kind: 'send', ...JSON.parse(init.body).message }) + '\n');
    return ok({ name: 'sent' });
  }
  if (u.host === 'iid.googleapis.com') {
    appendFileSync(PUSH_LOG, JSON.stringify({ kind: 'subscribe', topic: u.pathname.split('/').pop() }) + '\n');
    return ok({});
  }
  if (u.host === 'firestore.googleapis.com') {
    // "Bearer owner" is the emulator's admin token (skips rules, like a service account).
    return realFetch(`http://127.0.0.1:8080${u.pathname}${u.search}`, {
      ...init, headers: { ...init.headers, Authorization: 'Bearer owner' },
    });
  }
  if (u.host === 'identitytoolkit.googleapis.com') {
    return realFetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com${u.pathname}${u.search}`, init);
  }
  // Anything else (e.g. the test talking to the site) goes through untouched.
  return realFetch(url, init);
}

export function startWorker(port = 8787) {
  writeFileSync(PUSH_LOG, '');
  globalThis.fetch = fakeGoogle;
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(`http://127.0.0.1:${port}${req.url}`, {
        method: req.method,
        headers: { ...req.headers, 'CF-Connecting-IP': '127.0.0.1' },
        body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const out = await worker.fetch(request, env);
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
    });
    server.listen(port, () => resolve(server));
  });
}
