"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { getCategory } from "@/lib/data/categories";
import { pickChallengeForEvent, addChallengeToEvent } from "@/lib/data-layer";
import { categoryForFace, rollDie, DICE_FACES } from "@/lib/dice";
import { CategoryId, Challenge, Profile } from "@/types";

/** Reihum-Modus-Kontext für den Würfel: siehe events/[id]/page.tsx, wo das
 * aus event.turnOrder/turnIndex + den offenen Zuweisungen berechnet wird. */
export interface TurnInfo {
  currentTurnMember?: Profile;
  isMyTurn: boolean;
  /** Nicht-null, solange die Person, die dran ist, noch eine offene
   * (nicht genehmigte) zugewiesene Challenge hat – dann darf niemand neu
   * würfeln, sondern es geht erst mit dieser Challenge weiter. */
  blockedChallenge?: Challenge | null;
}

export function DiceRoller({ eventId, turnInfo }: { eventId: string; turnInfo?: TurnInfo }) {
  const router = useRouter();
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const [revealedCategoryId, setRevealedCategoryId] = useState<CategoryId | null>(null);
  const [empty, setEmpty] = useState(false);
  // Gesetzt, wenn die gewürfelte Kategorie für diesen Abend schon leer
  // gespielt ist und pickChallengeForEvent auf eine andere ausweicht –
  // das soll sichtbar sein statt sich wie ein Bug anzufühlen.
  const [fallback, setFallback] = useState<{ from: CategoryId; to: CategoryId } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const category = revealedCategoryId ? getCategory(revealedCategoryId) : null;

  function roll() {
    if (rolling) return;
    setRolling(true);
    setEmpty(false);
    setFallback(null);
    setError(null);

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
        try {
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
        } catch (err) {
          // Ohne dieses catch blieb der Button bei einem Fehler (z.B.
          // Supabase nicht erreichbar) für immer auf "Würfelt…" hängen.
          setError(
            err instanceof Error ? err.message : "Würfeln fehlgeschlagen. Bitte erneut versuchen."
          );
          setRolling(false);
        }
      }, 450);
      timeoutsRef.current.push(revealDelay);
    }, ticks * 80);
    timeoutsRef.current.push(settle);
  }

  if (turnInfo?.blockedChallenge) {
    const bc = turnInfo.blockedChallenge;
    return (
      <div className="flex flex-col items-center gap-4 py-8 px-5 text-center">
        <span className="text-5xl">{bc.icon}</span>
        <div>
          <p className="font-semibold text-sm mb-1">
            {turnInfo.isMyTurn ? "Du bist dran! 🎲" : `${turnInfo.currentTurnMember?.name ?? "Jemand"} ist dran`}
          </p>
          <p className="text-muted text-xs max-w-[260px]">
            Weiter geht&apos;s erst, wenn <strong>{bc.title}</strong>{" "}
            {turnInfo.isMyTurn ? "erledigt" : "gemeistert"} ist – dann wird automatisch neu gewürfelt.
          </p>
        </div>
        <Button size="lg" onClick={() => router.push(`/events/${eventId}/challenges/${bc.id}`)}>
          {turnInfo.isMyTurn ? "Jetzt spielen 🚀" : "Challenge ansehen"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      {turnInfo?.currentTurnMember && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/5 text-xs font-semibold"
        >
          <Avatar emoji={turnInfo.currentTurnMember.avatarEmoji} size="sm" />
          {turnInfo.isMyTurn ? "🔄 Du bist dran" : `🔄 ${turnInfo.currentTurnMember.name} ist dran`}
        </motion.div>
      )}

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

        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[#FF453A] text-xs text-center max-w-[260px]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
