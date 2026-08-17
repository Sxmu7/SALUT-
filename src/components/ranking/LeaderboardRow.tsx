"use client";

import { motion } from "framer-motion";
import { RankingEntry } from "@/types";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

const RANK_STYLES: Record<number, string> = {
  1: "gradient-gold-text",
  2: "text-[#C0C4CC]",
  3: "text-[#CD7F32]",
};

export function LeaderboardRow({
  entry,
  index,
  isSelf,
}: {
  entry: RankingEntry;
  index: number;
  isSelf?: boolean;
}) {
  const isTop3 = entry.rank <= 3;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 26 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl",
        isSelf ? "glass border border-[#BF5AF2]/30" : "border border-transparent"
      )}
    >
      <div className="w-7 flex items-center justify-center">
        {isTop3 ? (
          <span className={cn("text-xl font-display font-extrabold", RANK_STYLES[entry.rank])}>
            {entry.rank}
          </span>
        ) : (
          <span className="text-muted font-semibold tabular-nums">{entry.rank}</span>
        )}
      </div>
      <Avatar emoji={entry.avatarEmoji} size="md" ring={isTop3} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] truncate">
          {entry.name} {isSelf && <span className="text-muted font-normal">(Du)</span>}
        </p>
        <p className="text-muted text-xs">{entry.challengesCompleted} Challenges</p>
      </div>
      <div className="text-right">
        <AnimatedNumber value={entry.points} className="font-display font-extrabold tabular-nums text-lg" />
        <p className="text-muted text-[10px] -mt-0.5">Punkte</p>
      </div>
    </motion.div>
  );
}
