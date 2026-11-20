/*
 * Scribe service worker: web push (study reminders) and opening the right
 * page when a notification is tapped. No fetch handler and no caching — the
 * app behaves exactly as before; this only exists for push and installability.
 *
 * Payload (sent by the server's comeback loop):
 *   { title, body, url: "/workspace/…/session/…?utm_…", tag }
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Only same-origin paths; anything else opens the home page. */
function safeUrl(raw) {
  try {
    const url = new URL(raw || "/", self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + "/";
  } catch (e) {
    return self.location.origin + "/";
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }
  const title = data.title || "Scribe";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || "scribe",
      data: { url: safeUrl(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(target);
            return;
          }
        } catch (e) {
          // Not controlled by this worker yet: open a new window below.
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
