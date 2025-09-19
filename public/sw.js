// Service Worker for Push Notifications
const CACHE_NAME = 'amrit-dairy-v2'; // Updated version to force cache refresh
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  // Force the new service worker to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Only cache GET requests - PATCH, POST, PUT, DELETE are not cacheable
  if (event.request.method !== 'GET') {
    // For non-GET requests, just pass through without caching
    event.respondWith(fetch(event.request));
    return;
  }

  // Skip caching for API requests that change frequently
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('amrit-dairy')) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Push event
self.addEventListener('push', (event) => {
  console.log('🔔 Push notification received:', event);
  
  let notificationData = {
    title: 'Amrit Dairy',
    body: 'You have a new notification',
    icon: '/icon-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'amrit-dairy-notification',
    data: {},
    timestamp: Date.now()
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📋 Parsed notification data:', data);
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (error) {
      console.log('❌ Error parsing push data:', error);
      notificationData.body = event.data.text() || 'New notification from Amrit Dairy';
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    actions: [
      {
        action: 'view',
        title: 'View App',
        icon: '/icon-192x192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    requireInteraction: true, // Keep notification visible longer
    silent: false,
    vibrate: [200, 100, 200] // Vibration pattern for mobile
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Default action or 'view' action
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no existing window/tab, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync logic here
      console.log('Background sync triggered')
    );
  }
});

// Message event for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});