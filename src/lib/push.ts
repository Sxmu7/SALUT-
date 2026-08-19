"use client";

/**
 * Client-Helfer für Web Push (Party-Modus). Nur relevant im Supabase-
 * Modus - im lokalen Demo-Modus gibt es keinen Server, der Pushs
 * verschicken könnte, deshalb wird dieses Modul dort gar nicht erst
 * aufgerufen (siehe isRemoteMode()-Check in den UI-Komponenten).
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  );
}

/**
 * iOS/iPadOS unterstützt Web Push erst ab 16.4 UND nur, wenn die PWA über
 * "Zum Home-Bildschirm" installiert wurde (Safari im normalen Tab liefert
 * kein PushManager) – isPushSupported() liefert dort also `false`, ohne
 * dass ersichtlich wäre, warum. Dieser Helfer erkennt genau diesen Fall,
 * damit die UI (siehe VoteNotifyToggle.tsx) statt eines stillschweigend
 * verschwundenen Schalters einen erklärenden Hinweis zeigen kann.
 */
export function isIosNonStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  if (!isIos) return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const isStandalone = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return !isStandalone;
}

// Web Push erwartet den VAPID-Public-Key als Uint8Array, nicht als
// Base64-String - kleine, standardisierte Konvertierung (Padding +
// URL-sicheres Base64 → normales Base64 → Bytes).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export interface RawPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Registriert den Service Worker (falls noch nicht getan), fragt die
 * Notification-Berechtigung ab und erstellt eine Push-Subscription.
 * Wirft mit einer verständlichen Fehlermeldung, wenn irgendein Schritt
 * scheitert - die aufrufende UI zeigt das direkt an (siehe
 * events/[id]/page.tsx), statt den Fehler zu verschlucken.
 */
export async function subscribeToPush(): Promise<RawPushSubscription> {
  if (!isPushSupported()) {
    throw new Error(
      "Push-Benachrichtigungen werden von diesem Browser nicht unterstützt oder sind nicht konfiguriert."
    );
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Benachrichtigungen wurden nicht erlaubt.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Push-Subscription war unvollständig.");
  }

  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/**
 * Prüft, ob dieses Gerät/dieser Browser bereits eine aktive Push-
 * Subscription hat, OHNE dabei die Notification-Berechtigung abzufragen
 * (reine Leseoperation) – damit UI-Schalter (z.B. "Abstimmungs-
 * Benachrichtigungen") beim Laden ihren echten Zustand zeigen können,
 * statt immer bei "aus" zu starten.
 */
export async function getExistingPushSubscription(): Promise<RawPushSubscription | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/**
 * Meldet dieses Gerät browserseitig von Push ab. Gibt den zuletzt
 * genutzten Endpoint zurück (damit die aufrufende Seite die zugehörige
 * Server-Zeile per deletePushSubscription() entfernen kann), oder null,
 * wenn ohnehin keine Subscription bestand.
 */
export async function unsubscribeFromPush(): Promise<string | null> {
  const existing = await getExistingPushSubscription();
  if (!existing) return null;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
  return existing.endpoint;
}

/**
 * Hört auf Nachrichten vom Service Worker (siehe public/sw.js,
 * notificationclick) und ruft den übergebenen Navigations-Callback auf,
 * damit ein Notification-Klick die bestehende Next.js-Routing-Logik der
 * PWA nutzt statt eines harten Reloads. Gibt eine Cleanup-Funktion
 * zurück. No-op außerhalb des Browsers oder ohne Service-Worker-Support.
 */
export function listenForPushNavigation(onNavigate: (url: string) => void): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => {};
  }
  const handler = (event: MessageEvent) => {
    if (event.data && event.data.type === "salut:navigate" && typeof event.data.url === "string") {
      onNavigate(event.data.url);
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
