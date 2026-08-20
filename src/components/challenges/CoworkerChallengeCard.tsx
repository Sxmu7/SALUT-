"use client";

import { motion } from "framer-motion";
import { CoworkerChallenge, Profile } from "@/types";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABEL: Record<CoworkerChallenge["difficulty"], { label: string; color: string }> = {
  easy: { label: "Leicht", color: "#30D158" },
  medium: { label: "Mittel", color: "#FFD60A" },
  hard: { label: "Schwer", color: "#FF9F0A" },
  legendary: { label: "Legendär", color: "#DE002E" },
};

/**
 * Eine Karte im Kollegen-Feed – entweder noch offen ("annehmen" tippen,
 * wer zuerst tippt kriegt sie, siehe claim_coworker_challenge() in
 * schema.sql) oder bereits von jemandem angenommen (dann nur noch
 * Anzeige, kein Klick mehr möglich). Bewusst eigenständig statt
 * ChallengeCard wiederzuverwenden – kein categoryId/Kategorie-Badge, dafür
 * ein "von X angenommen"-Badge.
 */
export function CoworkerChallengeCard({
  challenge,
  claimedBy,
  done,
  onClick,
  index = 0,
}: {
  challenge: CoworkerChallenge;
  claimedBy?: Profile | null;
  done?: boolean;
  onClick?: () => void;
  index?: number;
}) {
  const diff = DIFFICULTY_LABEL[challenge.difficulty];
  const clickable = Boolean(onClick);

  return (
    <motion.button
      onClick={onClick}
      disabled={!clickable}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 24 }}
      whileTap={clickable ? { scale: 0.97 } : undefined}
      className={cn(
        "relative w-full text-left rounded-[var(--radius-md)] p-4 overflow-hidden card-surface",
        done && "opacity-60",
        !clickable && "cursor-default"
      )}
    >
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 blur-xl"
        style={{ background: "var(--gradient-accent)" }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{ background: "var(--gradient-accent)" }}
        >
          {challenge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {claimedBy ? `${claimedBy.avatarEmoji} ${claimedBy.name} ist dran` : "Noch offen"}
            </span>
          </div>
          <h3 className="font-semibold text-[15px] leading-snug">{challenge.title}</h3>
          <p className="text-muted text-[13px] mt-1 leading-snug line-clamp-2">
            {challenge.description}
          </p>
          <div className="flex items-center gap-3 mt-2.5">
            <span
              className="text-[11px] font-bold px-2 py-1 rounded-full"
              style={{ color: diff.color, background: `${diff.color}1A` }}
            >
              {diff.label}
            </span>
            <span className="text-[11px] text-muted flex items-center gap-1">
              {challenge.proofType === "photo" && "📸 Foto"}
              {challenge.proofType === "video" && "🎥 Video"}
              {challenge.proofType === "none" && "🤝 Ehrenwort"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className="font-display font-extrabold text-lg gradient-text">
            +{challenge.points}
          </span>
          <span className="text-[10px] text-muted">Punkte</span>
        </div>
      </div>
      {done && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
          <span className="text-2xl">✅</span>
        </div>
      )}
    </motion.button>
  );
}
