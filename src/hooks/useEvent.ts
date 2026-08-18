"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEvent,
  listSubmissions,
  listSubmissionsForUser,
  getAnyChallenge,
  subscribeToSubmission,
} from "@/lib/data-layer";
import { GameEvent, Submission, Challenge } from "@/types";

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
      const existing = (await listSubmissionsForUser(eventId, userId)).find(
        (s) => s.challengeId === challengeId
      );
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
