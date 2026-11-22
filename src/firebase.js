// Firebase initialization — shared across the site.
// These are public client keys (safe to ship in the frontend). Security comes
// from Firestore security rules + Auth, not from hiding these values.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB5pgda5BZkSkzDlm0Wr-1WKw70MKU_Hqk',
  authDomain: 'boston-ni-baaje.firebaseapp.com',
  projectId: 'boston-ni-baaje',
  storageBucket: 'boston-ni-baaje.firebasestorage.app',
  messagingSenderId: '829483078910',
  appId: '1:829483078910:web:3da2000114b1aea58f01af',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Against the local emulator (plain HTTP/1.1), force long-polling: its streaming
// transport can stall writes when several test browsers are connected.
export const db = import.meta.env.VITE_USE_EMULATORS
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : getFirestore(app);

// Local testing only: `VITE_USE_EMULATORS=1 npm run dev` talks to the Firebase
// emulators (and VITE_WORKER_URL, if set) instead of the real project.
if (import.meta.env.VITE_USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// Web push (FCM) VAPID public key. Safe to ship — it's the public half of the
// key pair (Firebase console → Project settings → Cloud Messaging → Web Push certificates).
export const VAPID_PUBLIC_KEY =
  'BLTsK2YrZbWF2YCRK2BSUGhwFJqrnmkJGgQalc5zhdVRTqZqjhN9wrND7H6mZ08Vv-Yc0gqOxDZld9kZEDfNSbA';

// URL of the Cloudflare Worker that subscribes devices + sends broadcasts.
// Deployed from worker/ (see worker/README.md).
export const PUSH_WORKER_URL =
  import.meta.env.VITE_WORKER_URL || 'https://bnb-push.bnb-dev.workers.dev';
