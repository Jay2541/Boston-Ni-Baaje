/* Firebase Cloud Messaging service worker — handles background push.
   Uses the compat CDN builds because service workers can't use bundled ES modules.
   Keep the version in step with the `firebase` package in package.json. */
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

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
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    data: payload.data || {},
  });
});

// Open the chat the notification is about (or the app) when it's tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.link || '/chat.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && 'focus' in w) {
          return w.focus().then((c) => (c && 'navigate' in c ? c.navigate(url) : c));
        }
      }
      return clients.openWindow(url);
    })
  );
});
