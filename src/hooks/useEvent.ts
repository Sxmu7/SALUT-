"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getEvent,
  listSubmissions,
  listSubmissionsForUser,
  getAnyChallenge,
} from "@/lib/db";
import { GameEvent, Submission, Challenge } from "@/types";

export function useEvent(eventId: string) {
  const [event, setEvent] = useState<GameEvent | null | undefined>(undefined);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const refresh = useCallback(() => {
    const e = getEvent(eventId);
    setEvent(e ?? null);
    setSubmissions(e ? listSubmissions(e.id) : []);
  }, [eventId]);

  useEffect(refresh, [refresh]);

  return { event, submissions, refresh };
}

/** Eine einzelne Challenge innerhalb eines Events, inkl. der eigenen Submission dazu. */
export function useEventChallenge(eventId: string, challengeId: string, userId?: string) {
  const [event, setEvent] = useState<GameEvent | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined);
  const [submission, setSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    setEvent(getEvent(eventId) ?? null);
    setChallenge(getAnyChallenge(challengeId) ?? null);
  }, [eventId, challengeId]);

  useEffect(() => {
    if (!userId) return;
    const existing = listSubmissionsForUser(eventId, userId).find(
      (s) => s.challengeId === challengeId
    );
    if (existing) setSubmission(existing);
  }, [eventId, challengeId, userId]);

  return { event, challenge, submission, setSubmission };
}
