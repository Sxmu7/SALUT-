"use client";

import { useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
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

  const challenges = event.challengeIds
    .map((cid) => getAnyChallenge(cid))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  function statusFor(challengeId: string) {
    const sub = submissions.find(
      (s) => s.challengeId === challengeId && s.userId === userId
    );
    return sub?.status;
  }

  const doneCount = challenges.filter((c) => statusFor(c.id) === "approved").length;

  return (
    <AppShell>
      <TopBar
        title={event.title}
        subtitle={`${event.emoji} ${formatDate(event.eventDate)} · ${doneCount}/${challenges.length} erledigt`}
      />

      <div className="px-5">
        {event.type === "birthday" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 mb-4 text-center font-semibold"
            style={{ background: "var(--gradient-gold)" }}
          >
            🎂 Geburtstags-Special mit Extra-Punkten!
          </motion.div>
        )}

        <div className="h-2 rounded-full bg-white/8 overflow-hidden mb-5">
          <motion.div
            className="h-full"
            style={{ background: "var(--gradient-party)" }}
            initial={{ width: 0 }}
            animate={{
              width: challenges.length
                ? `${(doneCount / challenges.length) * 100}%`
                : "0%",
            }}
            transition={{ duration: 0.6 }}
          />
        </div>

        <div className="space-y-3 pb-6">
          {challenges.map((c, i) => (
            <Link key={c.id} href={`/events/${event.id}/challenges/${c.id}`}>
              <ChallengeCard
                challenge={c}
                index={i}
                done={statusFor(c.id) === "approved"}
              />
            </Link>
          ))}
          {challenges.length === 0 && (
            <p className="text-muted text-sm text-center py-10">
              Noch keine Challenges in diesem Event.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
