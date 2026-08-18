"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getBingoSnapshot,
  startPartyBingo,
  reportBingoEvent,
  finishPartyBingo,
  subscribeToBingo,
} from "@/lib/data-layer";
import { BingoSnapshot, BingoWinCondition } from "@/types";

/**
 * Party-Bingo für ein Event (Modi → Party-Bingo). Nur sinnvoll im
 * Supabase-Modus – siehe isRemoteMode()-Check in der aufrufenden Seite,
 * dieser Hook wird dort im lokalen Demo-Modus gar nicht erst gerendert.
 * `snapshot` ist null, solange für dieses Event noch keine Runde läuft.
 */
export function usePartyBingo(eventId: string) {
  const [snapshot, setSnapshot] = useState<BingoSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await getBingoSnapshot(eventId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bingo-Status konnte nicht geladen werden.");
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

  // Realtime-Abo erst, sobald eine Runde existiert (bingo.id bekannt) -
  // meldet ein Mitspieler ein Ereignis, aktualisiert sich der Zustand
  // (inkl. eines etwaigen frisch ermittelten Gewinners) bei ALLEN
  // Geräten automatisch, ohne Polling.
  useEffect(() => {
    if (!snapshot?.bingo.id) return;
    const unsubscribe = subscribeToBingo(eventId, snapshot.bingo.id, (next) => {
      setSnapshot(next);
    });
    return unsubscribe;
  }, [eventId, snapshot?.bingo.id]);

  const start = useCallback(
    async (config?: {
      gridSize?: number;
      freeCenter?: boolean;
      winCondition?: BingoWinCondition;
      requireConfirmations?: number;
    }) => {
      setBusy(true);
      setError(null);
      try {
        await startPartyBingo(eventId, config);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bingo konnte nicht gestartet werden.");
      } finally {
        setBusy(false);
      }
    },
    [eventId, refresh]
  );

  const report = useCallback(
    async (bingoEventId: string) => {
      setBusy(true);
      setError(null);
      try {
        await reportBingoEvent(bingoEventId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ereignis konnte nicht gemeldet werden.");
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const finish = useCallback(async () => {
    if (!snapshot?.bingo.id) return;
    setBusy(true);
    setError(null);
    try {
      await finishPartyBingo(snapshot.bingo.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bingo konnte nicht beendet werden.");
    } finally {
      setBusy(false);
    }
  }, [snapshot, refresh]);

  return { snapshot, ready, busy, error, start, report, finish, refresh };
}
