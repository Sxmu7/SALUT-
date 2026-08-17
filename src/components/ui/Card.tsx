"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  glass?: boolean;
}

export function Card({ children, className, glass, ...props }: CardProps) {
  return (
    <motion.div
      className={cn(
        glass ? "glass" : "card-surface",
        "rounded-[var(--radius-md)] p-5",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
