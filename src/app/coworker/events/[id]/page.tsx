"use client";

import { use as usePromise, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { CoworkerChallengeCard } from "@/components/challenges/CoworkerChallengeCard";
import { PendingVotes } from "@/components/challenges/PendingVotes";
import { TopBarSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { useEvent, latestByChallenge } from "@/hooks/useEvent";
import { useCoworkerTheme } from "@/app/coworker/layout";
import { useProfile } from "@/hooks/useProfile";
import {
  getAnyCoworkerChallenge,
  listCoworkerGroupMembers,
  claimCoworkerChallenge,
  subscribeToEventChallenges,
} from "@/lib/data-layer";
import { CoworkerChallenge, Profile } from "@/types";

export default function CoworkerEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { event, submissions, refresh } = useEvent(id);
  const { profile } = useProfile();
  const { theme, toggle } = useCoworkerTheme();
  const [challenges, setChallenges] = useState<CoworkerChallenge[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [claimError, setClaimError] = useState("");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // event.challengeIds wächst automatisch alle 5 Minuten per Server-Push
  // (siehe coworker-push-tick) – hier nur die Details dazu laden.
  useEffect(() => {
    if (!event) {
      setChallenges([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const all = await Promise.all(event.challengeIds.map((cid) => getAnyCoworkerChallenge(cid)));
      if (cancelled) return;
      setChallenges(all.filter((c): c is CoworkerChallenge => Boolean(c)).reverse());
    })();
    return () => {
      cancelled = true;
    };
  }, [event]);

  useEffect(() => {
    if (!event?.coworkerGroupId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const m = await listCoworkerGroupMembers(event.coworkerGroupId as string);
      if (!cancelled) setMembers(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [event]);

  // Live: neue automatisch verschickte Challenges + wer welche geclaimt
  // hat (siehe subscribeToEventChallenges() in data-layer.ts).
  useEffect(() => {
    return subscribeToEventChallenges(id, refresh);
  }, [id, refresh]);

  if (event === undefined) {
    return (
      <AppShell>
        <TopBarSkeleton />
        <div className="px-5 space-y-3">
          <Skeleton className="h-24 rounded-[28px]" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </AppShell>
    );
  }
  if (event === null) {
    return (
      <AppShell>
        <TopBar title="Nicht gefunden" />
      </AppShell>
    );
  }

  const myLatestByChallenge = latestByChallenge(submissions.filter((s) => s.userId === profile?.id));
  function statusFor(challengeId: string) {
    return myLatestByChallenge.get(challengeId)?.status;
  }

  const doneCount = challenges.filter((c) => statusFor(c.id) === "approved").length;
  const challengesById = new Map(challenges.map((c) => [c.id, c]));
  const membersById = new Map(members.map((m) => [m.id, m]));

  async function handleClaim(challengeId: string) {
    setClaimError("");
    setClaimingId(challengeId);
    try {
      await claimCoworkerChallenge(event!.id, challengeId);
      await refresh();
    } catch (err) {
      setClaimError(
        err instanceof Error && err.message.includes("already_claimed")
          ? "Zu spät – jemand anderes war schneller."
          : "Annehmen fehlgeschlagen. Bitte erneut versuchen."
      );
    } finally {
      setClaimingId(null);
    }
  }

  const nextPush = event.coworkerNextPushAt ? new Date(event.coworkerNextPushAt) : null;

  return (
    <AppShell>
      <TopBar
        title={event.title}
        subtitle={`💼 ${doneCount} gemeistert`}
        right={
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-full flex items-center justify-center card-surface text-base"
            aria-label="Hell/Dunkel umschalten"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        }
      />

      <div className="px-5">
        {nextPush && (
          <Card className="mb-4 text-center py-3">
            <p className="text-muted text-xs">
              Nächste Challenge frühestens{" "}
              <span className="font-semibold text-foreground">
                {nextPush.toLocaleString("de-DE", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          </Card>
        )}

        {claimError && (
          <p className="text-[#FF453A] text-xs text-center mb-3">{claimError}</p>
        )}

        <PendingVotes
          submissions={submissions}
          challengesById={challengesById}
          membersById={membersById}
          currentUserId={profile?.id}
          onVoted={refresh}
        />

        {challenges.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-muted uppercase mb-3">Challenges</p>
            <div className="space-y-3 pb-6">
              {challenges.map((c, i) => {
                const assignedUserId = event.challengeAssignments[c.id];
                const claimedBy = assignedUserId ? membersById.get(assignedUserId) : null;
                const isMine = assignedUserId === profile?.id;
                const isOpen = !assignedUserId;
                const done = statusFor(c.id) === "approved";

                if (isOpen) {
                  return (
                    <CoworkerChallengeCard
                      key={c.id}
                      challenge={c}
                      index={i}
                      onClick={
                        claimingId === c.id
                          ? undefined
                          : () => handleClaim(c.id)
                      }
                    />
                  );
                }

                if (isMine) {
                  return (
                    <Link key={c.id} href={`/coworker/events/${event.id}/challenges/${c.id}`}>
                      <CoworkerChallengeCard challenge={c} index={i} done={done} claimedBy={claimedBy} />
                    </Link>
                  );
                }

                return (
                  <CoworkerChallengeCard
                    key={c.id}
                    challenge={c}
                    index={i}
                    done={done}
                    claimedBy={claimedBy}
                  />
                );
              })}
            </div>
          </div>
        )}

        {challenges.length === 0 && (
          <p className="text-muted text-sm text-center pb-10">
            Noch keine Challenge da – die erste kommt automatisch während der
            Arbeitszeit (Mo-Fr, 09-12:30 & 14-17 Uhr).
          </p>
        )}
      </div>
    </AppShell>
  );
}
