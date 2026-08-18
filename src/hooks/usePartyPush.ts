"use client";

import { useCallback, useEffect, useState } from "react";
import { getPartyPushState, setPartyPushConfig, savePushSubscription } from "@/lib/data-layer";
import { subscribeToPush } from "@/lib/push";
import { PartyPushState } from "@/types";

/**
 * Automatischer Push-Modus für eine Party (Modi → "Automatische
 * Challenges"). Nur sinnvoll im Supabase-Modus – siehe isRemoteMode()-
 * Check in der aufrufenden Seite, dieser Hook wird dort gar nicht erst
 * gerendert, wenn lokaler Demo-Modus aktiv ist.
 */
export function usePartyPush(eventId: string) {
  const [state, setState] = useState<PartyPushState | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getPartyPushState(eventId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push-Status konnte nicht geladen werden.");
    }
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const enable = useCallback(
    async (intervalMinutes: number) => {
      setBusy(true);
      setError(null);
      try {
        // Erst die Browser-Subscription einrichten (fragt ggf. die
        // Notification-Berechtigung ab) - erst wenn DAS klappt, den Push
        // in der Datenbank aktivieren. Sonst wäre "aktiviert" gesetzt,
        // ohne dass dieses Gerät überhaupt etwas empfangen könnte.
        const sub = await subscribeToPush();
        await savePushSubscription(sub);
        const next = await setPartyPushConfig(eventId, { enabled: true, intervalMinutes });
        setState(next);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Automatische Challenges konnten nicht aktiviert werden."
        );
      } finally {
        setBusy(false);
      }
    },
    [eventId]
  );

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await setPartyPushConfig(eventId, { enabled: false });
      setState(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Automatische Challenges konnten nicht deaktiviert werden."
      );
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  return { state, ready, busy, error, enable, disable, refresh };
}
