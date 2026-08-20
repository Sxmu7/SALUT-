"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { castVote } from "@/lib/data-layer";
import { Submission, Challenge, Profile } from "@/types";

/**
 * "Wartet auf deine Stimme" – die eigentliche Abstimmungs-UI für ANDERE
 * Mitspieler. Bis hierhin gab es zwar cast_vote()/castVote() in Schema und
 * Datenschicht, aber nirgendwo eine Stelle, an der ein echter Mitspieler
 * (im Demo-Modus stimmen nur simulierte Bots ab) tatsächlich abstimmen
 * konnte – dieses Panel schließt genau diese Lücke. Zusammen mit der
 * Realtime-Subscription in useEvent() (subscribeToEventSubmissions) ist
 * das der "Sync mit anderen Spielern zur Abstimmung".
 */
export function PendingVotes({
  submissions,
  challengesById,
  membersById,
  currentUserId,
  onVoted,
}: {
  submissions: Submission[];
  // Pick statt vollem Challenge: wird auch vom Kollegen-Feed mit einer Map
  // aus CoworkerChallenge (kein categoryId) wiederverwendet – hier werden
  // ohnehin nur icon/title gebraucht.
  challengesById: Map<string, Pick<Challenge, "icon" | "title">>;
  membersById: Map<string, Profile>;
  currentUserId?: string;
  onVoted: () => void;
}) {
  const pending = submissions.filter(
    (s) =>
      s.status === "pending" &&
      s.userId !== currentUserId &&
      !s.votes.some((v) => v.voterId === currentUserId)
  );

  if (pending.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-muted uppercase mb-3">
        Wartet auf deine Stimme 🗳️
      </p>
      <div className="space-y-3">
        <AnimatePresence>
          {pending.map((s) => (
            <VoteCard
              key={s.id}
              submission={s}
              challenge={challengesById.get(s.challengeId)}
              member={membersById.get(s.userId)}
              currentUserId={currentUserId}
              onVoted={onVoted}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function VoteCard({
  submission,
  challenge,
  member,
  currentUserId,
  onVoted,
}: {
  submission: Submission;
  challenge?: Pick<Challenge, "icon" | "title">;
  member?: Profile;
  currentUserId?: string;
  onVoted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function vote(approve: boolean) {
    if (!currentUserId) return;
    setBusy(true);
    setError("");
    try {
      await castVote(submission.id, currentUserId, approve);
      onVoted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Abstimmen fehlgeschlagen. Bitte erneut versuchen."
      );
      setBusy(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="card-surface rounded-2xl p-4"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <Avatar emoji={member?.avatarEmoji ?? "🙂"} size="sm" />
        <span className="text-sm font-medium flex-1 min-w-0 truncate">
          {member?.name ?? "Jemand"} · {challenge?.icon} {challenge?.title ?? "Challenge"}
        </span>
      </div>

      {submission.proofDataUrl && (
        <div className="rounded-xl overflow-hidden mb-3 bg-black/20">
          {submission.proofType === "video" ? (
            <video
              src={submission.proofDataUrl}
              controls
              className="w-full max-h-56 object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={submission.proofDataUrl}
              alt="Beweis"
              className="w-full max-h-56 object-cover"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={busy}
          onClick={() => vote(true)}
          className="rounded-xl py-2.5 font-semibold text-sm text-center disabled:opacity-40"
          style={{ background: "rgba(48,209,88,0.15)", color: "#30D158" }}
        >
          ✅ Zustimmen
        </button>
        <button
          disabled={busy}
          onClick={() => vote(false)}
          className="rounded-xl py-2.5 font-semibold text-sm text-center disabled:opacity-40"
          style={{ background: "rgba(255,69,58,0.15)", color: "#FF453A" }}
        >
          ❌ Ablehnen
        </button>
      </div>
      {error && <p className="text-[#FF453A] text-xs mt-2 text-center">{error}</p>}
    </motion.div>
  );
}
