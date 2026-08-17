"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

function Digit({ value }: { value: string }) {
  return (
    <span className="relative inline-block w-[0.62em] h-[1.15em] overflow-hidden align-middle">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute inset-0 flex items-center justify-center tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function CountdownFlip({
  days,
  className,
}: {
  days: number;
  className?: string;
}) {
  const str = String(Math.max(days, 0)).padStart(2, "0");
  return (
    <span className={cn("inline-flex font-display font-extrabold tabular-nums", className)}>
      {str.split("").map((d, i) => (
        <Digit key={i} value={d} />
      ))}
    </span>
  );
}
