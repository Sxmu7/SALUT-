"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

/**
 * Animiert einen Textblock wortweise ein – für Überschriften, die mehr
 * nach nativer App-Bewegung wirken sollen statt einfach nur zu faden.
 */
export function StaggerText({
  text,
  className,
  delay = 0,
  wordDelay = 0.045,
  active = true,
}: {
  text: string;
  className?: string;
  delay?: number;
  wordDelay?: number;
  active?: boolean;
}) {
  const words = text.split(" ");
  return (
    <span>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
          animate={active ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
          transition={{
            delay: delay + i * wordDelay,
            type: "spring",
            stiffness: 220,
            damping: 22,
          }}
          // className is applied per word, not on the wrapper: background-clip:text
          // gradients (gradient-text) don't paint through child elements, so putting
          // the class only on the outer <span> would leave every word invisible.
          className={`inline-block ${className ?? ""}`}
        >
          {word}
        </motion.span>
      )).reduce<ReactNode[]>((acc, el, i) => {
        // Plain-text space nodes between spans: a space *inside* an
        // inline-block span gets collapsed at the box edge and the words
        // would run together ("JedeParty." instead of "Jede Party.").
        if (i > 0) acc.push(" ");
        acc.push(el);
        return acc;
      }, [] as ReactNode[])}
    </span>
  );
}
