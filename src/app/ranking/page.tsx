"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { LeaderboardRow } from "@/components/ranking/LeaderboardRow";
import { Avatar } from "@/components/ui/Avatar";
import { computeRanking, listGroups, getCurrentProfile } from "@/lib/db";
import { RankingEntry, Group } from "@/types";

export default function RankingPage() {
  const [group, setGroup] = useState<Group | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const profile = getCurrentProfile();

  useEffect(() => {
    const groups = listGroups();
    const g = groups[0] ?? null;
    setGroup(g);
    if (g) setRanking(computeRanking(g.id));
  }, []);

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <AppShell>
      <TopBar title="Ranking 🏆" subtitle={group?.name} />

      <div className="px-5">
        {podium.length > 0 && (
          <div className="flex items-end justify-center gap-3 mb-6 pt-4">
            {order.map((entry, i) => {
              if (!entry) return null;
              const isFirst = entry.rank === 1;
              return (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, type: "spring", stiffness: 200, damping: 18 }}
                  className="flex flex-col items-center"
                >
                  <Avatar emoji={entry.avatarEmoji} size={isFirst ? "xl" : "lg"} ring />
                  <p className="text-sm font-semibold mt-2 max-w-[70px] truncate">
                    {entry.name}
                  </p>
                  <p className="font-display font-extrabold gradient-text">{entry.points}</p>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: isFirst ? 72 : entry.rank === 2 ? 52 : 36 }}
                    transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                    className="w-16 mt-2 rounded-t-xl flex items-start justify-center pt-1"
                    style={{
                      background: isFirst ? "var(--gradient-gold)" : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <span className="font-display font-extrabold text-lg">
                      {entry.rank}
                    </span>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="space-y-1.5 pb-6">
          {rest.map((entry, i) => (
            <LeaderboardRow
              key={entry.userId}
              entry={entry}
              index={i}
              isSelf={entry.userId === profile?.id}
            />
          ))}
          {ranking.length === 0 && (
            <p className="text-muted text-sm text-center py-16">
              Noch keine Punkte gesammelt – starte deine erste Challenge!
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
