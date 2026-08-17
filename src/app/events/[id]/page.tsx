"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { DiceRoller } from "@/components/challenges/DiceRoller";
import {
  getEvent,
  getAnyChallenge,
  listSubmissions,
  getCurrentProfile,
} from "@/lib/db";
import { GameEvent, Submission } from "@/types";
import { formatDate } from "@/lib/utils";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const [event, setEvent] = useState<GameEvent | null | undefined>(undefined);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const userId = getCurrentProfile()?.id;

  useEffect(() => {
    const e = getEvent(id);
    setEvent(e ?? null);
    if (e) setSubmissions(listSubmissions(e.id));
  }, [id]);

  if (event === undefined) return null;
  if (event === null) {
    return (
      <AppShell>
        <TopBar title="Event nicht gefunden" />
      </AppShell>
    );
  }

  // event.challengeIds wächst ausschließlich durch Würfeln – hier stehen
  // also nur Challenges, die die Gruppe in diesem Abend schon aufgedeckt hat.
  // Der Rest bleibt bewusst verborgen, bis gewürfelt wird.
  const revealed = event.challengeIds
    .map((cid) => getAnyChallenge(cid))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .reverse();

  function statusFor(challengeId: string) {
    const sub = submissions.find(
      (s) => s.challengeId === challengeId && s.userId === userId
    );
    return sub?.status;
  }

  const doneCount = revealed.filter((c) => statusFor(c.id) === "approved").length;

  return (
    <AppShell>
      <TopBar
        title={event.title}
        subtitle={`${event.emoji} ${formatDate(event.eventDate)} · ${doneCount} gemeistert`}
      />

      <div className="px-5">
        {event.type === "birthday" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 mb-2 text-center font-semibold"
            style={{ background: "var(--gradient-gold)" }}
          >
            🎂 Geburtstags-Special – exklusive Challenges im Würfel-Topf!
          </motion.div>
        )}

        <DiceRoller eventId={event.id} />

        {revealed.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-muted uppercase mb-3">
              Bisher aufgedeckt
            </p>
            <div className="space-y-3 pb-6">
              {revealed.map((c, i) => (
                <Link key={`${c.id}-${i}`} href={`/events/${event.id}/challenges/${c.id}`}>
                  <ChallengeCard
                    challenge={c}
                    index={i}
                    done={statusFor(c.id) === "approved"}
                  />
                </Link>
              ))}
            </div>
          </div>
        )}

        {revealed.length === 0 && (
          <p className="text-muted text-sm text-center pb-10">
            Noch nichts gewürfelt – tippt oben auf den Würfel, um die erste
            Challenge des Abends aufzudecken.
          </p>
        )}
      </div>
    </AppShell>
  );
}
