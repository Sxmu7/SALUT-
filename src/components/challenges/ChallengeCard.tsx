"use client";

import { motion, Variants } from "framer-motion";
import { Challenge } from "@/types";
import { getCategory } from "@/lib/data/categories";
import { cn } from "@/lib/utils";

const ANIMATION_VARIANTS: Record<Challenge["animation"], Variants> = {
  flip: {
    rest: { rotateY: 0 },
    hover: { rotateY: 8, transition: { type: "spring", stiffness: 200 } },
  },
  bounce: {
    rest: { y: 0 },
    hover: { y: -6, transition: { type: "spring", stiffness: 300, damping: 10 } },
  },
  shake: {
    rest: { x: 0 },
    hover: { x: [0, -3, 3, -2, 2, 0], transition: { duration: 0.4 } },
  },
  pulse: {
    rest: { scale: 1 },
    hover: { scale: 1.02, transition: { duration: 0.3, repeat: Infinity, repeatType: "reverse" } },
  },
  slide: {
    rest: { x: 0 },
    hover: { x: 4, transition: { type: "spring", stiffness: 250 } },
  },
  glow: {
    rest: { filter: "brightness(1)" },
    hover: { filter: "brightness(1.15)", transition: { duration: 0.3 } },
  },
  pop: {
    rest: { scale: 1 },
    hover: { scale: 1.03, transition: { type: "spring", stiffness: 400, damping: 12 } },
  },
};

const DIFFICULTY_LABEL: Record<Challenge["difficulty"], { label: string; color: string }> = {
  easy: { label: "Leicht", color: "#30D158" },
  medium: { label: "Mittel", color: "#FFD60A" },
  hard: { label: "Schwer", color: "#FF9F0A" },
  legendary: { label: "Legendär", color: "#FF375F" },
};

export function ChallengeCard({
  challenge,
  onClick,
  done,
  index = 0,
}: {
  challenge: Challenge;
  onClick?: () => void;
  done?: boolean;
  index?: number;
}) {
  const category = getCategory(challenge.categoryId);
  const diff = DIFFICULTY_LABEL[challenge.difficulty];
  const variants = ANIMATION_VARIANTS[challenge.animation];

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.97 }}
      variants={variants}
      whileHover="hover"
      className={cn(
        "relative w-full text-left rounded-[var(--radius-md)] p-4 overflow-hidden card-surface",
        done && "opacity-60"
      )}
      style={{ perspective: 800 }}
    >
      <div
        className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20 blur-xl"
        style={{ background: category.gradient }}
      />
      <div className="relative flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{ background: category.gradient }}
        >
          {challenge.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {category.name}
            </span>
            {challenge.isBirthdayExclusive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full gradient-gold-text font-bold border border-[#FFD60A]/30">
                🎂 Exklusiv
              </span>
            )}
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
