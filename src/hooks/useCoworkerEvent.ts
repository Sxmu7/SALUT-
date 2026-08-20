"use client";

import { useEffect, useState } from "react";
import {
  getEvent,
  getAnyCoworkerChallenge,
  listSubmissionsForUser,
  subscribeToSubmission,
} from "@/lib/data-layer";
import { latestByChallenge } from "@/hooks/useEvent";
import { GameEvent, CoworkerChallenge, Submission } from "@/types";

/** Eine einzelne Kollegen-Challenge innerhalb eines Events, inkl. der
 * eigenen Submission dazu – 1:1 dasselbe Muster wie useEventChallenge()
 * für den Trinkspiel-Pfad, nur mit getAnyCoworkerChallenge() statt
 * getAnyChallenge() (komplett getrennter Katalog, siehe schema.sql). */
export function useCoworkerEventChallenge(eventId: string, challengeId: string, userId?: string) {
  const [event, setEvent] = useState<GameEvent | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<CoworkerChallenge | null | undefined>(undefined);
  const [submission, setSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [e, c] = await Promise.all([getEvent(eventId), getAnyCoworkerChallenge(challengeId)]);
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

  useEffect(() => {
    if (!submission) return;
    return subscribeToSubmission(submission.id, setSubmission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.id]);

  return { event, challenge, submission, setSubmission };
}
