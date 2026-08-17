"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { CategoryPill } from "@/components/challenges/CategoryPill";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { Button } from "@/components/ui/Button";
import { CATEGORIES } from "@/lib/data/categories";
import { Challenge } from "@/types";
import {
  listAllChallenges,
  listGroups,
  getOrCreateQuickEvent,
  addChallengeToEvent,
} from "@/lib/db";
import Link from "next/link";

function ChallengesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [activeCategory, setActiveCategory] = useState<string | null>(
    params.get("category")
  );
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setChallenges(listAllChallenges());
  }, []);

  const filtered = useMemo(
    () =>
      activeCategory
        ? challenges.filter((c) => c.categoryId === activeCategory)
        : challenges,
    [challenges, activeCategory]
  );

  function playNow(challenge: Challenge) {
    setStarting(true);
    const groups = listGroups();
    const group = groups[0];
    if (!group) return;
    const event = getOrCreateQuickEvent(group.id);
    addChallengeToEvent(event.id, challenge.id);
    router.push(`/events/${event.id}/challenges/${challenge.id}`);
  }

  return (
    <AppShell>
      <TopBar title="Challenges" subtitle={`${challenges.length} Herausforderungen`} />

      <div className="px-5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
          <CategoryPill
            category={{ id: "klassiker", name: "Alle", icon: "✨", gradient: "var(--gradient-party)", description: "" }}
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              category={cat}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            />
          ))}
        </div>

        <Link href="/challenges/new">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="mt-2 mb-4 card-surface rounded-2xl p-3.5 flex items-center gap-3 border-dashed border-2 border-white/10"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 text-lg">
              ➕
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Eigene Challenge hinzufügen</p>
              <p className="text-muted text-xs">Manuell oder per Dokument-Upload</p>
            </div>
          </motion.div>
        </Link>

        <div className="space-y-3 pb-4">
          {filtered.map((c, i) => (
            <ChallengeCard key={c.id} challenge={c} index={i} onClick={() => setSelected(c)} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-md mx-auto rounded-t-[32px] p-6 pb-[calc(2rem+var(--safe-bottom))]"
            >
              <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-5" />
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: "var(--gradient-party)" }}
                >
                  {selected.icon}
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl">{selected.title}</h2>
                  <span className="font-display font-extrabold gradient-text text-lg">
                    +{selected.points} Punkte
                  </span>
                </div>
              </div>
              <p className="text-muted text-[15px] leading-relaxed mb-6">
                {selected.description}
              </p>
              <Button fullWidth size="lg" disabled={starting} onClick={() => playNow(selected)}>
                {starting ? "Wird gestartet…" : "Challenge jetzt spielen 🎬"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default function ChallengesPage() {
  return (
    <Suspense fallback={null}>
      <ChallengesContent />
    </Suspense>
  );
}
