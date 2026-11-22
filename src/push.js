// Web push (FCM) subscription — the "subscribe" half of notifications.
// Devices subscribe via the Cloudflare Worker: everyone gets the "all" topic
// (announcements), and signed-in members also get one topic per chat they're in.
import { app, auth, VAPID_PUBLIC_KEY, PUSH_WORKER_URL } from './firebase.js';
import { getIdToken } from 'firebase/auth';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const BASE = import.meta.env.BASE_URL;

/** True only where FCM web push can actually work. */
export async function pushSupported() {
  try {
    return (await isSupported()) && 'serviceWorker' in navigator && 'Notification' in window;
  } catch {
    return false;
  }
}

// Optional page hook for messages that arrive while the app is open. Return
// true to say "handled" (e.g. the chat is already on screen) and skip the toast.
let foregroundHandler = null;
export function onForegroundMessage(fn) {
  foregroundHandler = fn;
}
let listening = false;

/**
 * Ask for permission and subscribe this device to its push topics.
 * Safe to call again (e.g. on every app launch) to refresh topics.
 * Returns { ok, reason }. Call this from a user gesture (button click).
 */
export async function enablePush() {
  // Never throws — always resolves to { ok, reason } so callers can reset UI.
  try {
    if (!VAPID_PUBLIC_KEY || !PUSH_WORKER_URL) return { ok: false, reason: 'not-configured' };
    if (!(await pushSupported())) return { ok: false, reason: 'unsupported' };

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const messaging = getMessaging(app);

    // The FCM SW must live at the site root scope. Vite serves it from public/.
    const swReg = await navigator.serviceWorker.register(
      `${BASE}firebase-messaging-sw.js`
    );
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg,
    });
    if (!token) return { ok: false, reason: 'no-token' };

    // Subscribe via the Worker; signed-in members also get their chat topics.
    const idToken = auth.currentUser ? await getIdToken(auth.currentUser) : undefined;
    const res = await fetch(`${PUSH_WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, idToken }),
    });
    if (!res.ok) return { ok: false, reason: 'subscribe-failed' };

    // Foreground messages: let the page handle it, else show a lightweight toast.
    if (!listening) {
      listening = true;
      onMessage(messaging, (payload) => {
        if (foregroundHandler && foregroundHandler(payload)) return;
        const n = payload?.notification;
        if (n) showToast(n.title, n.body);
      });
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'error', detail: String(err?.message || err) };
  }
}

/** Current notification permission: 'default' | 'granted' | 'denied'. */
export function notifPermission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

function showToast(title, body) {
  const el = document.createElement('div');
  el.className = 'push-toast';
  el.innerHTML = `<strong>${escapeHtml(title || 'Update')}</strong>${body ? `<span>${escapeHtml(body)}</span>` : ''}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 6000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
