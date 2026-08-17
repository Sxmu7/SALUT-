"use client";

import { motion } from "framer-motion";
import { Category } from "@/types";
import { cn } from "@/lib/utils";

export function CategoryPill({
  category,
  active,
  onClick,
}: {
  category: Category;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      className={cn(
        "shrink-0 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 border transition-colors",
        active ? "border-transparent text-white" : "border-white/10 text-muted"
      )}
      style={active ? { background: category.gradient } : { background: "rgba(255,255,255,0.04)" }}
    >
      <span>{category.icon}</span>
      {category.name}
    </motion.button>
  );
}
