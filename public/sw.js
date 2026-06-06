// Service Worker NMRY Coaching
// Gère les notifications push et le cache PWA

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;

  let payload;
  try {
    payload = e.data.json();
  } catch {
    payload = { title: "NMRY Coaching", body: e.data.text() };
  }

  const { title = "NMRY Coaching", body = "", url = "/" } = payload;

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo-light.png",
      badge: "/logo-light.png",
      data: { url },
      vibrate: [200, 100, 200],
    })
  );
});

// Clic sur la notif → ouvrir l'app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? "/";
  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Si une fenêtre est déjà ouverte, la focus
        for (const client of clients) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        return self.clients.openWindow(url);
      })
  );
});
