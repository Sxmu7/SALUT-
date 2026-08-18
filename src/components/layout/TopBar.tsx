"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

export function TopBar({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="safe-top px-5 pt-5 pb-3 flex items-center justify-between"
    >
      <div>
        <h1 className="font-display text-[21px] font-bold tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-muted text-[13px] mt-1">{subtitle}</p>}
      </div>
      {right}
    </motion.header>
  );
}
