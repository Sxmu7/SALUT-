"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { fireConfetti } from "@/components/ui/Confetti";
import { TopBarSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useProfile } from "@/hooks/useProfile";
import { useCoworkerEventChallenge } from "@/hooks/useCoworkerEvent";
import {
  submitChallengeProof,
  declineChallenge,
  listCoworkerGroupMembers,
} from "@/lib/data-layer";
import { Profile } from "@/types";

export default function CoworkerChallengePlayPage({
  params,
}: {
  params: Promise<{ id: string; challengeId: string }>;
}) {
  const { id, challengeId } = usePromise(params);
  const router = useRouter();
  const { profile } = useProfile();
  const { event, challenge, submission, setSubmission } = useCoworkerEventChallenge(
    id,
    challengeId,
    profile?.id
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [proofType, setProofType] = useState<"photo" | "video" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!event?.coworkerGroupId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const all = await listCoworkerGroupMembers(event.coworkerGroupId as string);
      if (!cancelled) setMembers(all.filter((m) => m.id !== profile?.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [event, profile?.id]);

  useEffect(() => {
    if (submission?.status === "approved" && !celebratedRef.current) {
      celebratedRef.current = true;
      fireConfetti("big");
    }
  }, [submission?.status]);

  if (challenge === undefined || event === undefined) {
    return (
      <AppShell>
        <TopBarSkeleton />
        <div className="px-5 space-y-4">
          <Skeleton className="h-48 rounded-[28px]" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </AppShell>
    );
  }
  if (!challenge || !event) {
    return (
      <AppShell>
        <TopBar title="Nicht gefunden" />
      </AppShell>
    );
  }

  // Nur wer die Challenge angenommen ("geclaimt") hat, darf sie einreichen/
  // ablehnen – alle anderen sehen nur, wer dran ist (Annehmen passiert in
  // der Feed-Übersicht, siehe /coworker/events/[id]).
  const assignedUserId = event.challengeAssignments[challengeId];
  const isBlocked = Boolean(assignedUserId) && assignedUserId !== profile?.id;
  const assignedMember = assignedUserId ? members.find((m) => m.id === assignedUserId) : undefined;

  if (isBlocked && !submission) {
    return (
      <AppShell>
        <TopBar title={challenge.title} />
        <div className="px-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[28px] p-8 flex flex-col items-center text-center mb-5"
            style={{ background: "var(--gradient-accent)" }}
          >
            <span className="text-5xl mb-3">{challenge.icon}</span>
            <p className="text-white/90 text-sm leading-relaxed">{challenge.description}</p>
          </motion.div>

          <div className="card-surface rounded-2xl p-5 flex flex-col items-center text-center gap-3">
            {assignedMember && <Avatar emoji={assignedMember.avatarEmoji} size="lg" />}
            <p className="font-semibold text-sm">
              💼 {assignedMember?.name ?? "Jemand anderes"} hat diese Challenge angenommen
            </p>
            <p className="text-muted text-xs">
              Wer zuerst annimmt, muss sie machen – bei der nächsten Challenge
              bist du vielleicht schneller.
            </p>
          </div>

          <Button
            fullWidth
            variant="secondary"
            className="mt-4"
            onClick={() => router.push(`/coworker/events/${id}`)}
          >
            Zurück zum Feed
          </Button>
        </div>
      </AppShell>
    );
  }

  function handleFile(file: File) {
    const type = file.type.startsWith("video") ? "video" : "photo";
    setProofType(type);
    if (type === "photo") {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(URL.createObjectURL(file));
    }
  }

  async function submit(withoutProof = false) {
    if (!profile) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sub = await submitChallengeProof({
        eventId: id,
        challengeId,
        userId: profile.id,
        proofDataUrl: withoutProof ? undefined : preview ?? undefined,
        note: withoutProof ? "Ehrenwort" : undefined,
      });
      setSubmission(sub);
      if (sub.status === "approved") fireConfetti("big");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Einreichen fehlgeschlagen. Bitte erneut versuchen."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function decline() {
    if (!profile) return;
    if (!window.confirm("Diese Challenge wirklich ablehnen? Du bekommst dafür keine Punkte.")) {
      return;
    }
    setDeclining(true);
    setSubmitError(null);
    try {
      const sub = await declineChallenge({ eventId: id, challengeId, userId: profile.id });
      setSubmission(sub);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ablehnen fehlgeschlagen. Bitte erneut versuchen."
      );
    } finally {
      setDeclining(false);
    }
  }

  function retry() {
    setSubmission(null);
    setPreview(null);
    setProofType(null);
    setSubmitError(null);
    celebratedRef.current = false;
  }

  return (
    <AppShell>
      <TopBar title={challenge.title} subtitle="Kollegen-Modus" />

      <div className="px-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="rounded-[28px] p-8 flex flex-col items-center text-center mb-5"
          style={{ background: "var(--gradient-accent)" }}
        >
          <span className="text-5xl mb-3">{challenge.icon}</span>
          <p className="text-white/90 text-sm leading-relaxed">{challenge.description}</p>
          <span className="mt-4 font-display font-extrabold text-3xl text-white">
            +{challenge.points}
          </span>
          <span className="text-white/70 text-xs">Punkte bei Erfolg</span>
        </motion.div>

        <AnimatePresence mode="wait">
          {!submission && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {challenge.proofType !== "none" ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={challenge.proofType === "video" ? "video/*" : "image/*"}
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  {preview ? (
                    <div className="rounded-2xl overflow-hidden card-surface">
                      {proofType === "video" ? (
                        <video src={preview} controls className="w-full max-h-72 object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview} alt="Beweis" className="w-full max-h-72 object-cover" />
                      )}
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full card-surface rounded-2xl py-10 flex flex-col items-center gap-2 border-2 border-dashed border-white/15"
                    >
                      <span className="text-3xl">
                        {challenge.proofType === "video" ? "🎥" : "📸"}
                      </span>
                      <span className="text-sm font-semibold">
                        {challenge.proofType === "video" ? "Video aufnehmen" : "Foto aufnehmen"}
                      </span>
                      <span className="text-muted text-xs">Tippen zum Aufnehmen/Auswählen</span>
                    </motion.button>
                  )}

                  <Button
                    fullWidth
                    size="lg"
                    disabled={!preview || submitting}
                    onClick={() => submit(false)}
                  >
                    Beweis einreichen 🚀
                  </Button>
                  {preview && (
                    <button
                      onClick={() => {
                        setPreview(null);
                        setProofType(null);
                      }}
                      className="w-full text-center text-muted text-sm"
                    >
                      Neu aufnehmen
                    </button>
                  )}
                </>
              ) : (
                <Button fullWidth size="lg" disabled={submitting} onClick={() => submit(true)}>
                  Erledigt – auf Ehrenwort ✅
                </Button>
              )}

              <button
                onClick={decline}
                disabled={declining || submitting}
                className="w-full text-center text-muted text-sm disabled:opacity-40"
              >
                {declining ? "Wird abgelehnt…" : "Challenge ablehnen ❌"}
              </button>

              {submitError && (
                <p className="text-[#FF453A] text-xs text-center">{submitError}</p>
              )}
            </motion.div>
          )}

          {submission && (
            <motion.div
              key="status"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {submission.status === "pending" && (
                <div className="card-surface rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                      className="text-lg"
                    >
                      🗳️
                    </motion.span>
                    <p className="font-semibold text-sm">Abstimmung im Team läuft…</p>
                  </div>
                  <div className="space-y-2">
                    {members.map((m) => {
                      const vote = submission.votes.find((v) => v.voterId === m.id);
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <Avatar emoji={m.avatarEmoji} size="sm" />
                          <span className="text-sm flex-1">{m.name}</span>
                          {!vote && (
                            <span className="text-muted text-xs animate-pulse">wartet…</span>
                          )}
                          {vote && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-lg">
                              {vote.approve ? "✅" : "❌"}
                            </motion.span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {submission.status === "approved" && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                  className="rounded-2xl p-6 text-center"
                  style={{ background: "var(--gradient-party)" }}
                >
                  <span className="text-4xl">🎉</span>
                  <p className="font-display font-extrabold text-xl mt-2 text-white">
                    Challenge gemeistert!
                  </p>
                  <p className="text-white/90 mt-1">+{submission.pointsAwarded} Punkte</p>
                </motion.div>
              )}

              {submission.status === "rejected" && (
                <div className="rounded-2xl p-6 text-center bg-[#FF453A]/15 border border-[#FF453A]/30">
                  <span className="text-4xl">😅</span>
                  <p className="font-semibold mt-2">
                    {submission.note === "declined_by_user"
                      ? "Von dir abgelehnt"
                      : "Vom Team abgelehnt"}
                  </p>
                  <p className="text-muted text-sm mt-1">
                    {submission.note === "declined_by_user"
                      ? "Kein Problem – du kannst es dir aber auch nochmal überlegen."
                      : "Kein Problem, die nächste Challenge kommt automatisch."}
                  </p>
                </div>
              )}

              {submission.status === "rejected" && submission.note === "declined_by_user" && (
                <Button fullWidth size="lg" onClick={retry}>
                  Nochmal versuchen 🔁
                </Button>
              )}

              <Button
                fullWidth
                variant="secondary"
                onClick={() => router.push(`/coworker/events/${id}`)}
              >
                Zurück zum Feed
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
