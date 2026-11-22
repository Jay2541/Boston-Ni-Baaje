// Calls to the Cloudflare Worker (worker/src/worker.js): phone + PIN sign-up and
// login, chat push, and the directors' admin actions.
import { auth, PUSH_WORKER_URL } from './firebase.js';
import { getIdToken, signInWithCustomToken } from 'firebase/auth';

/** POST to the Worker. Adds the signed-in user's ID token when `withAuth`. Throws with a friendly message. */
export async function callWorker(path, body = {}, { withAuth = false } = {}) {
  if (withAuth) {
    if (!auth.currentUser) throw new Error('Please sign in again.');
    body = { ...body, idToken: await getIdToken(auth.currentUser) };
  }
  let res;
  try {
    res = await fetch(`${PUSH_WORKER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network issue. Check your connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Try again.'), { status: res.status });
  return data;
}

/** Create an account from a team join code, then sign in. */
export async function signUp({ code, name, phone, pin }) {
  const { customToken } = await callWorker('/signup', { code, name, phone, pin });
  return signInWithCustomToken(auth, customToken);
}

/** Sign in with phone number + PIN. */
export async function logIn({ phone, pin }) {
  const { customToken } = await callWorker('/login', { phone, pin });
  return signInWithCustomToken(auth, customToken);
}

/** "(617) 555-1234" for US numbers; other numbers shown as typed. */
export function formatPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const us = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (us.length === 10) return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
  return String(raw || '').trim();
}
