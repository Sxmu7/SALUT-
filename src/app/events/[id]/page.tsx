"use client";

import { use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { DiceRoller } from "@/components/challenges/DiceRoller";
import { TopBarSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useEvent } from "@/hooks/useEvent";
import { useProfile } from "@/hooks/useProfile";
import { getAnyChallenge } from "@/lib/data-layer";
import { formatDate } from "@/lib/utils";
import { Challenge } from "@/types";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { event, submissions } = useEvent(id);
  const { profile } = useProfile();
  const [revealed, setRevealed] = useState<Challenge[]>([]);

  // event.challengeIds wächst ausschließlich durch Würfeln – hier stehen
  // also nur Challenges, die die Gruppe in diesem Abend schon aufgedeckt hat.
  // Der Rest bleibt bewusst verborgen, bis gewürfelt wird.
  useEffect(() => {
    if (!event) {
      setRevealed([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const challenges = await Promise.all(event.challengeIds.map((cid) => getAnyChallenge(cid)));
      if (cancelled) return;
      setRevealed(
        challenges.filter((c): c is Challenge => Boolean(c)).reverse()
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [event]);

  if (event === undefined) {
    return (
      <AppShell>
        <TopBarSkeleton />
        <div className="px-5 space-y-3">
          <Skeleton className="h-24 rounded-[28px]" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </AppShell>
    );
  }
  if (event === null) {
    return (
      <AppShell>
        <TopBar title="Event nicht gefunden" />
      </AppShell>
    );
  }

  function statusFor(challengeId: string) {
    const sub = submissions.find(
      (s) => s.challengeId === challengeId && s.userId === profile?.id
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
