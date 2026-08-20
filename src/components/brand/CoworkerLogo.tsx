"use client";

import { useId } from "react";
import { motion } from "framer-motion";

/**
 * Kollegen-Modus Markenzeichen – ein eigenständiges, stilisiertes "S"-
 * Monogramm in Sparkassen-Rot (HKS 13 / #DE002E), NICHT das echte,
 * eingetragene Sparkassen-Logo (der stilisierte Kassierer-Kopf/"Der
 * Sparlöwe" ist als Wort-Bild-Marke geschützt) – bewusst ein eigenes
 * Symbol, das die Zugehörigkeit klar macht ("wo wir arbeiten"), ohne die
 * echte Marke zu reproduzieren.
 */
function SGlyph({ animated }: { animated: boolean }) {
  return (
    <motion.path
      d="M 66 30 C 66 22 58 17 48 17 C 37 17 29 23 29 32 C 29 41 37 44 48 47 C 61 50 71 55 71 68 C 71 79 61 85 49 85 C 38 85 28 80 27 70"
      stroke="white"
      strokeWidth={11}
      strokeLinecap="round"
      fill="none"
      initial={animated ? { pathLength: 0, opacity: 0 } : undefined}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.9, ease: "easeInOut", delay: 0.1 }}
    />
  );
}

export function CoworkerLogoMark({
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
  const gid = `coworker-logo-g-${useId()}`;
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
          <stop offset="0%" stopColor="#ff2d55" />
          <stop offset="55%" stopColor="#de002e" />
          <stop offset="100%" stopColor="#a4001f" />
        </linearGradient>
      </defs>
      {rounded && <rect width="100" height="100" rx="24" fill={`url(#${gid})`} />}
      <SGlyph animated={animated} />
      {/* Funke oben rechts, wie ein kleiner "Fortschritt/Erledigt"-Blitz */}
      <motion.circle
        cx={74}
        cy={22}
        r={4}
        fill="white"
        initial={animated ? { scale: 0, opacity: 0 } : undefined}
        animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.9] }}
        transition={{ delay: 0.75, duration: 0.5, ease: "easeOut" }}
      />
    </motion.svg>
  );
}
