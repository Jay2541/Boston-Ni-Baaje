/* Firebase Cloud Messaging service worker — handles background push.
   Uses the compat CDN builds because service workers can't use bundled ES modules. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB5pgda5BZkSkzDlm0Wr-1WKw70MKU_Hqk',
  authDomain: 'boston-ni-baaje.firebaseapp.com',
  projectId: 'boston-ni-baaje',
  storageBucket: 'boston-ni-baaje.firebasestorage.app',
  messagingSenderId: '829483078910',
  appId: '1:829483078910:web:3da2000114b1aea58f01af',
});

const messaging = firebase.messaging();

// Show the notification when the app is in the background/closed.
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'Boston Ni Baaje', {
    body: n.body || '',
    icon: '/Boston-Ni-Baaje/pwa-192.png',
    badge: '/Boston-Ni-Baaje/pwa-192.png',
    data: payload.data || {},
  });
});

// Focus/open the app when a notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = '/Boston-Ni-Baaje/updates.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes('/Boston-Ni-Baaje/') && 'focus' in w) return w.focus();
      }
      return clients.openWindow(url);
    })
  );
});
