"use client";

import { useCallback, useEffect, useState } from "react";
import { savePushSubscription, deletePushSubscription } from "@/lib/data-layer";
import { subscribeToPush, getExistingPushSubscription, unsubscribeFromPush } from "@/lib/push";

/**
 * Push-Benachrichtigungen für "jemand hat eine Challenge eingereicht,
 * bitte abstimmen" (siehe PendingVotes.tsx + notify-vote-request Edge
 * Function). Bewusst unabhängig vom Party-Modus-Schalter "Automatische
 * Challenges" (usePartyPush) - Abstimmen ist bei JEDEM Event-Typ relevant,
 * nicht nur bei Partys. Beide Features teilen sich dieselbe
 * push_subscriptions-Tabelle: ein Gerät, das für irgendeinen Zweck
 * abonniert ist, bekommt beide Arten von Push - die Umschalter hier und
 * bei "Automatische Challenges" sind bewusst unabhängige UI-Ansichten auf
 * denselben zugrunde liegenden Browser-Mechanismus.
 */
export function useVoteNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = await getExistingPushSubscription();
      if (!cancelled) {
        setEnabled(Boolean(existing));
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await subscribeToPush();
      await savePushSubscription(sub);
      setEnabled(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Benachrichtigungen konnten nicht aktiviert werden."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await deletePushSubscription(endpoint);
      setEnabled(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Benachrichtigungen konnten nicht deaktiviert werden."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return { enabled, ready, busy, error, enable, disable };
}
