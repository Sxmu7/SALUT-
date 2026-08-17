"use client";

import { useId } from "react";
import { motion } from "framer-motion";

/**
 * Salut! Markenzeichen – zwei anstoßende Gläser als Monogramm.
 * Ersetzt das bisherige Emoji/Text-Provisorium auf Landingpage & Intro.
 */

function GlassGlyph({ tilt, delay, animated }: { tilt: number; delay: number; animated: boolean }) {
  return (
    <motion.g
      initial={animated ? { opacity: 0, y: 8, rotate: tilt * 1.4 } : undefined}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ type: "spring", stiffness: 180, damping: 14, delay }}
    >
      {/* Kelch */}
      <path
        d="M -14 0 L 14 0 L 2 34 L -2 34 Z"
        fill="white"
        fillOpacity={0.96}
      />
      {/* Sprudel-Bläschen */}
      <circle cx={-4} cy={10} r={1.6} fill="white" fillOpacity={0.5} />
      <circle cx={3} cy={16} r={1.1} fill="white" fillOpacity={0.4} />
      {/* Stiel + Fuß */}
      <path d="M -1.6 34 L 1.6 34 L 1.6 50 L 9 57 L -9 57 L -1.6 50 Z" fill="white" fillOpacity={0.96} />
    </motion.g>
  );
}

export function LogoMark({
  size = 40,
  animated = true,
  rounded = true,
  className,
}: {
  size?: number;
  animated?: boolean;
  rounded?: boolean;
  className?: string;
}) {
  const gid = `salut-logo-g-${useId()}`;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      initial={animated ? { scale: 0.85, opacity: 0 } : undefined}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 16 }}
    >
      <defs>
        <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff375f" />
          <stop offset="50%" stopColor="#bf5af2" />
          <stop offset="100%" stopColor="#64d2ff" />
        </linearGradient>
      </defs>
      {rounded && <rect width="100" height="100" rx="24" fill={`url(#${gid})`} />}
      <g transform="translate(50 62)">
        <g transform="translate(-18 -2)">
          <GlassGlyph tilt={-16} delay={0} animated={animated} />
        </g>
        <g transform="translate(18 -2)">
          <GlassGlyph tilt={16} delay={0.08} animated={animated} />
        </g>
        {/* Anstoß-Funke */}
        <motion.circle
          cx={0}
          cy={-14}
          r={3.2}
          fill="white"
          initial={animated ? { scale: 0, opacity: 0 } : undefined}
          animate={{ scale: [0, 1.6, 1], opacity: [0, 1, 0.9] }}
          transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
        />
      </g>
    </motion.svg>
  );
}

export function Logo({
  size = 36,
  showWordmark = true,
  animated = true,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  animated?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} animated={animated} />
      {showWordmark && (
        <motion.span
          initial={animated ? { opacity: 0, x: -6 } : undefined}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="font-display font-extrabold tracking-tight"
          style={{ fontSize: size * 0.5 }}
        >
          Salut!
        </motion.span>
      )}
    </div>
  );
}
