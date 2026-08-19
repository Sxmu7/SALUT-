"use client";

import { use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { DiceRoller, TurnInfo } from "@/components/challenges/DiceRoller";
import { PartyPushToggle } from "@/components/challenges/PartyPushToggle";
import { VoteNotifyToggle } from "@/components/challenges/VoteNotifyToggle";
import { PendingVotes } from "@/components/challenges/PendingVotes";
import { EventControlsPanel } from "@/components/challenges/EventControlsPanel";
// PartyBingoPanel ist vorerst deaktiviert (siehe Kommentar unten) - Import
// bewusst entfernt, um keinen "unused import"-Lint-Fehler zu haben.
import { TopBarSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useEvent, latestByChallenge } from "@/hooks/useEvent";
import { useProfile } from "@/hooks/useProfile";
import { getAnyChallenge, listGroupMembers, isRemoteMode } from "@/lib/data-layer";
import { formatDate } from "@/lib/utils";
import { Challenge, Profile } from "@/types";

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { event, submissions, refresh } = useEvent(id);
  const { profile } = useProfile();
  const [revealed, setRevealed] = useState<Challenge[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);

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

  // Für die Abstimmungskarten (PendingVotes): Name + Avatar des
  // Einreichenden anzeigen zu können.
  useEffect(() => {
    if (!event) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const m = await listGroupMembers(event.groupId);
      if (!cancelled) setMembers(m);
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

  // Bei mehreren Submissions zur selben Challenge (Nacheinreichung nach
  // Ablehnung) zählt immer die zuletzt eingereichte für den Status – siehe
  // latestByChallenge() in hooks/useEvent.ts.
  const myLatestByChallenge = latestByChallenge(
    submissions.filter((s) => s.userId === profile?.id)
  );
  function statusFor(challengeId: string) {
    return myLatestByChallenge.get(challengeId)?.status;
  }

  const doneCount = revealed.filter((c) => statusFor(c.id) === "approved").length;
  const challengesById = new Map(revealed.map((c) => [c.id, c]));
  const membersById = new Map(members.map((m) => [m.id, m]));

  // Reihum-Modus: wer ist dran, und blockiert eine noch offene (nicht
  // genehmigte) zugewiesene Challenge das nächste Würfeln? Siehe
  // DiceRoller.tsx – dort wird bei blockedChallenge statt des Würfels ein
  // "weiter geht's hiermit"-Hinweis gezeigt.
  let turnInfo: TurnInfo | undefined;
  if (event.turnModeEnabled && event.turnOrder.length > 0) {
    const currentTurnUserId = event.turnOrder[event.turnIndex];
    const allLatestByChallenge = latestByChallenge(submissions);
    const blockedEntry = Object.entries(event.challengeAssignments).find(
      ([challengeId, assignedUserId]) =>
        assignedUserId === currentTurnUserId &&
        allLatestByChallenge.get(challengeId)?.status !== "approved"
    );
    turnInfo = {
      currentTurnMember: membersById.get(currentTurnUserId),
      isMyTurn: currentTurnUserId === profile?.id,
      blockedChallenge: blockedEntry ? challengesById.get(blockedEntry[0]) ?? null : null,
    };
  }

  const finished = event.status === "finished";

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

        {isRemoteMode() && <VoteNotifyToggle />}
        {event.type === "party" && isRemoteMode() && <PartyPushToggle eventId={event.id} />}
        {/* Party-Bingo ist vorerst wieder ausgeblendet (auf Wunsch) - Code,
            Schema und Tests bleiben erhalten, nur der Einstiegspunkt hier
            ist deaktiviert, damit es sich jederzeit wieder einschalten
            lässt: {event.type === "party" && isRemoteMode() && <PartyBingoPanel eventId={event.id} />} */}

        {finished ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-5 mb-4 text-center"
            style={{ background: "var(--gradient-party)" }}
          >
            <span className="text-3xl">🏁</span>
            <p className="font-display font-extrabold text-lg text-white mt-1">
              Abend beendet
            </p>
            <p className="text-white/80 text-sm mt-1">
              {doneCount} Challenge{doneCount === 1 ? "" : "s"} gemeistert – auf zur nächsten Runde!
            </p>
          </motion.div>
        ) : (
          <>
            <EventControlsPanel event={event} members={members} onChanged={refresh} />
            <DiceRoller eventId={event.id} turnInfo={turnInfo} />
          </>
        )}

        <PendingVotes
          submissions={submissions}
          challengesById={challengesById}
          membersById={membersById}
          currentUserId={profile?.id}
          onVoted={refresh}
        />

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
