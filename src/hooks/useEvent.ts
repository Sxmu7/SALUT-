"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEvent,
  listSubmissions,
  listSubmissionsForUser,
  getAnyChallenge,
  subscribeToSubmission,
  subscribeToEventSubmissions,
  isRemoteMode,
} from "@/lib/data-layer";
import { GameEvent, Submission, Challenge } from "@/types";

/** Bei mehreren Submissions zur selben Challenge (Nacheinreichung nach
 * Ablehnung – siehe declineChallenge()/"Nochmal versuchen") zählt für den
 * Status immer die zuletzt eingereichte, nicht irgendeine ältere. Ohne
 * das könnte eine frische, noch offene Einreichung von einer alten
 * abgelehnten überdeckt werden, je nachdem in welcher Reihenfolge die
 * Datenbank die Zeilen zurückgibt. */
export function latestByChallenge(submissions: Submission[]): Map<string, Submission> {
  const byChallenge = new Map<string, Submission>();
  for (const s of submissions) {
    const current = byChallenge.get(s.challengeId);
    if (!current || new Date(s.createdAt).getTime() > new Date(current.createdAt).getTime()) {
      byChallenge.set(s.challengeId, s);
    }
  }
  return byChallenge;
}

export function useEvent(eventId: string) {
  const [event, setEvent] = useState<GameEvent | null | undefined>(undefined);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const refresh = useCallback(async () => {
    const e = await getEvent(eventId);
    setEvent(e ?? null);
    setSubmissions(e ? await listSubmissions(e.id) : []);
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // "Sync mit anderen Spielern": neue Einreichungen von Mitspielern (zum
  // Abstimmen) und neue/geänderte Stimmen sollen live ankommen, nicht erst
  // nach einem manuellen Reload. Supabase-Modus nutzt Realtime, der lokale
  // Demo-Modus pollt (dort gibt es kein Realtime, aber Bot-Stimmen
  // kommen zeitversetzt per setTimeout rein, siehe lib/db.ts).
  useEffect(() => {
    if (isRemoteMode()) {
      return subscribeToEventSubmissions(eventId, setSubmissions);
    }
    const interval = setInterval(() => {
      listSubmissions(eventId).then(setSubmissions);
    }, 1000);
    return () => clearInterval(interval);
  }, [eventId]);

  return { event, submissions, refresh };
}

/** Eine einzelne Challenge innerhalb eines Events, inkl. der eigenen Submission dazu. */
export function useEventChallenge(eventId: string, challengeId: string, userId?: string) {
  const [event, setEvent] = useState<GameEvent | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined);
  const [submission, setSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [e, c] = await Promise.all([getEvent(eventId), getAnyChallenge(challengeId)]);
      if (cancelled) return;
      setEvent(e ?? null);
      setChallenge(c ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, challengeId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const existing = latestByChallenge(
        await listSubmissionsForUser(eventId, userId)
      ).get(challengeId);
      if (!cancelled && existing) setSubmission(existing);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, challengeId, userId]);

  // Supabase Realtime: sobald jemand abstimmt oder der Status kippt, direkt
  // nachziehen (ersetzt in diesem Modus das 800ms-Polling der Seite). Im
  // Demo-Modus liefert subscribeToSubmission eine No-Op-Funktion zurück.
  useEffect(() => {
    if (!submission) return;
    return subscribeToSubmission(submission.id, setSubmission);
    // Bewusst nur an die ID gekoppelt: würde hier das volle `submission`-
    // Objekt als Dependency stehen, löst jedes setSubmission() aus der
    // Subscription selbst (neue Objektreferenz) ein Re-Subscribe aus –
    // Endlosschleife aus Unsubscribe/Subscribe statt einer stabilen
    // Live-Verbindung pro Submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.id]);

  return { event, challenge, submission, setSubmission };
}
