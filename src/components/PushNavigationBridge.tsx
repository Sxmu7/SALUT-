"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { listenForPushNavigation } from "@/lib/push";

/**
 * Verbindet einen Notification-Klick (Service Worker, siehe public/sw.js)
 * mit der bestehenden Next.js-Routing-Logik der App. Rein additiv: rendert
 * nichts, greift nirgends in bestehende Navigation ein – ohne aktive
 * Push-Subscription passiert hier schlicht nichts, da der Service Worker
 * dann nie eine Nachricht schickt.
 */
export function PushNavigationBridge() {
  const router = useRouter();

  useEffect(() => {
    return listenForPushNavigation((url) => router.push(url));
  }, [router]);

  return null;
}
