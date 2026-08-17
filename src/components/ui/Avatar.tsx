"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function Avatar({
  emoji,
  size = "md",
  ring,
  className,
}: {
  emoji: string;
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  className?: string;
}) {
  const sizes: Record<string, string> = {
    sm: "w-8 h-8 text-base",
    md: "w-11 h-11 text-xl",
    lg: "w-16 h-16 text-3xl",
    xl: "w-24 h-24 text-5xl",
  };
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={cn(
        "rounded-full flex items-center justify-center shrink-0",
        sizes[size],
        ring ? "ring-2 ring-offset-2 ring-offset-background" : "",
        className
      )}
      style={{
        background: "linear-gradient(135deg, rgba(191,90,242,0.25), rgba(255,55,95,0.2))",
        ...(ring ? ({ ["--tw-ring-color" as string]: "#BF5AF2" }) : {}),
      }}
    >
      {emoji}
    </motion.div>
  );
}
