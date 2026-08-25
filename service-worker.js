const CACHE_NAME = 'april-dashboard-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'Дебрянск Авто';
  const options = {
    body: data.body || 'Данные дашборда обновлены.',
    tag: data.tag || 'dashboard-update',
    renotify: true,
    icon: '/favicon/web-app-manifest-192x192.png',
    badge: '/favicon/web-app-manifest-192x192.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
    const existing = windowClients.find(client => 'focus' in client);
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
  }));
});