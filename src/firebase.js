// Firebase initialization — shared across the site.
// These are public client keys (safe to ship in the frontend). Security comes
// from Firestore security rules + Auth, not from hiding these values.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app);

// Web push (FCM) VAPID public key. Safe to ship — it's the public half of the
// key pair (Firebase console → Project settings → Cloud Messaging → Web Push certificates).
export const VAPID_PUBLIC_KEY =
  'BLTsK2YrZbWF2YCRK2BSUGhwFJqrnmkJGgQalc5zhdVRTqZqjhN9wrND7H6mZ08Vv-Yc0gqOxDZld9kZEDfNSbA';

// URL of the Cloudflare Worker that subscribes devices + sends broadcasts.
// Deployed from worker/ (see worker/README.md).
export const PUSH_WORKER_URL = 'https://bnb-push.bnb-dev.workers.dev';
