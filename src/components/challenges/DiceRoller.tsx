"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { getCategory } from "@/lib/data/categories";
import { pickChallengeForEvent, addChallengeToEvent } from "@/lib/data-layer";
import { categoryForFace, rollDie, DICE_FACES } from "@/lib/dice";
import { CategoryId } from "@/types";

export function DiceRoller({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const [revealedCategoryId, setRevealedCategoryId] = useState<CategoryId | null>(null);
  const [empty, setEmpty] = useState(false);
  // Gesetzt, wenn die gewürfelte Kategorie für diesen Abend schon leer
  // gespielt ist und pickChallengeForEvent auf eine andere ausweicht –
  // das soll sichtbar sein statt sich wie ein Bug anzufühlen.
  const [fallback, setFallback] = useState<{ from: CategoryId; to: CategoryId } | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const category = revealedCategoryId ? getCategory(revealedCategoryId) : null;

  function roll() {
    if (rolling) return;
    setRolling(true);
    setEmpty(false);
    setFallback(null);

    const ticks = 10;
    for (let i = 0; i < ticks; i++) {
      const t = setTimeout(() => {
        setFace(1 + Math.floor(Math.random() * 6));
      }, i * 80);
      timeoutsRef.current.push(t);
    }

    const settle = setTimeout(() => {
      const finalFace = rollDie();
      setFace(finalFace);
      const rolledCategoryId = categoryForFace(finalFace);
      setRevealedCategoryId(rolledCategoryId);

      const revealDelay = setTimeout(async () => {
        const challenge = await pickChallengeForEvent(eventId, rolledCategoryId);
        if (!challenge) {
          setEmpty(true);
          setRolling(false);
          return;
        }

        const isFallback = challenge.categoryId !== rolledCategoryId;
        if (isFallback) {
          setRevealedCategoryId(challenge.categoryId);
          setFallback({ from: rolledCategoryId, to: challenge.categoryId });
        }

        await addChallengeToEvent(eventId, challenge.id);
        const navDelay = setTimeout(
          () => {
            router.push(`/events/${eventId}/challenges/${challenge.id}`);
          },
          // Bei Fallback bleibt der Hinweistext etwas länger sichtbar,
          // bevor wir weiterspringen.
          isFallback ? 1400 : 550
        );
        timeoutsRef.current.push(navDelay);
      }, 450);
      timeoutsRef.current.push(revealDelay);
    }, ticks * 80);
    timeoutsRef.current.push(settle);
  }

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <motion.div
        animate={
          rolling
            ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.08, 1] }
            : { rotate: 0, scale: 1 }
        }
        transition={{ duration: 0.5, repeat: rolling ? Infinity : 0, ease: "easeInOut" }}
        className="w-28 h-28 rounded-[28px] flex items-center justify-center text-6xl shadow-2xl"
        style={{
          background: category ? category.gradient : "var(--gradient-party)",
        }}
      >
        {face ? DICE_FACES[face - 1] : "🎲"}
      </motion.div>

      {category && !rolling && (
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-semibold text-muted flex items-center gap-1.5"
        >
          <span>{category.icon}</span> {category.name}
        </motion.p>
      )}

      <Button size="lg" onClick={roll} disabled={rolling}>
        {rolling ? "Würfelt…" : face ? "Nochmal würfeln 🎲" : "Würfeln 🎲"}
      </Button>

      <AnimatePresence mode="wait">
        {fallback && (
          <motion.p
            key="fallback"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-muted text-xs text-center max-w-[260px]"
          >
            {getCategory(fallback.from).icon} {getCategory(fallback.from).name} ist für
            heute schon leer gespielt – hier kommt stattdessen eine{" "}
            {getCategory(fallback.to).icon} {getCategory(fallback.to).name}-Challenge.
          </motion.p>
        )}

        {empty && (
          <motion.p
            key="empty"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-muted text-xs text-center max-w-[240px]"
          >
            Für diesen Abend sind schon alle Challenges gespielt – auf zur
            nächsten Party!
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
