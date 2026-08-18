// Salut! – Service Worker für Push-Benachrichtigungen (Party-Modus).
//
// Bewusst minimal: kein Offline-Caching, keine sonstige PWA-Logik - nur
// die zwei Events, die für Web Push nötig sind. Wird NICHT global beim
// App-Start registriert, sondern erst, wenn ein Nutzer den "Automatische
// Challenges"-Schalter im Party-Modus aktiviert (siehe src/lib/push.ts),
// damit niemand ungefragt eine Benachrichtigungs-Anfrage sieht.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "🔥 Neue Challenge!";
  const options = {
    body: data.body || "Deine neue Party-Challenge wartet auf dich.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.eventId ? `salut-party-${data.eventId}` : undefined,
    data: {
      url: data.url || "/dashboard",
      eventId: data.eventId,
      challengeId: data.challengeId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

      // Ein bereits offenes App-Fenster bekommt eine postMessage und
      // navigiert über die BESTEHENDE Next.js-Routing-Logik der PWA
      // selbst (siehe PushNavigationBridge in src/app/layout.tsx) - so
      // bleibt der React-Zustand erhalten, statt das Fenster hart neu zu
      // laden.
      for (const client of windows) {
        if ("focus" in client) {
          client.postMessage({ type: "salut:navigate", url });
          await client.focus();
          return;
        }
      }

      // Keine PWA offen: normale Navigation reicht, Next.js rendert die
      // Route beim Laden ganz normal.
      await self.clients.openWindow(url);
    })()
  );
});
