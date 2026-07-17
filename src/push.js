// Web push (FCM) subscription — the "subscribe" half of notifications.
// Devices subscribe to the "all" topic via the Cloudflare Worker; the board
// broadcasts to that topic (see worker/ and updates.js).
import { app, VAPID_PUBLIC_KEY, PUSH_WORKER_URL } from './firebase.js';
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

/**
 * Ask for permission and register this device's push token in Firestore.
 * Returns { ok, reason }. Call this from a user gesture (button click).
 */
export async function enablePush() {
  if (!VAPID_PUBLIC_KEY || !PUSH_WORKER_URL) return { ok: false, reason: 'not-configured' };
  if (!(await pushSupported())) return { ok: false, reason: 'unsupported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const messaging = getMessaging(app);

  // The FCM SW must live at the site root scope. Vite serves it from public/.
  const swReg = await navigator.serviceWorker.register(
    `${BASE}firebase-messaging-sw.js`
  );

  const token = await getToken(messaging, {
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: swReg,
  });
  if (!token) return { ok: false, reason: 'no-token' };

  // Subscribe this device to the "all" topic via the Worker.
  const res = await fetch(`${PUSH_WORKER_URL}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return { ok: false, reason: 'subscribe-failed' };

  // Foreground messages: show a lightweight in-page toast.
  onMessage(messaging, (payload) => {
    const n = payload?.notification;
    if (n) showToast(n.title, n.body);
  });

  return { ok: true };
}

/** Current notification permission: 'default' | 'granted' | 'denied'. */
export function notifPermission() {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

function showToast(title, body) {
  const el = document.createElement('div');
  el.className = 'push-toast';
  el.innerHTML = `<strong>${title || 'Update'}</strong>${body ? `<span>${body}</span>` : ''}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 6000);
}
