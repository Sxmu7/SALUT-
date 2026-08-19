"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { setTurnMode, setEventTarget, endEvent } from "@/lib/data-layer";
import { GameEvent, Profile } from "@/types";

/**
 * Steuerung für den laufenden Abend: Reihum-Modus an/aus, optionales
 * Challenge-Ziel ("Abend endet nach X Challenges") und ein manueller
 * "Abend beenden"-Button. Funktioniert bewusst in BEIDEN Modi (lokal +
 * Supabase) – anders als Push/Bingo braucht das kein Backend.
 */
export function EventControlsPanel({
  event,
  members,
  onChanged,
}: {
  event: GameEvent;
  members: Profile[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const [busyTurn, setBusyTurn] = useState(false);
  const [busyTarget, setBusyTarget] = useState(false);
  const [busyEnd, setBusyEnd] = useState(false);
  const [targetInput, setTargetInput] = useState(
    event.targetChallengeCount !== null ? String(event.targetChallengeCount) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const membersById = new Map(members.map((m) => [m.id, m]));
  const currentTurnMember = event.turnModeEnabled
    ? membersById.get(event.turnOrder[event.turnIndex])
    : undefined;

  async function toggleTurnMode() {
    setBusyTurn(true);
    setError(null);
    try {
      await setTurnMode(event.id, !event.turnModeEnabled);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reihum-Modus konnte nicht geändert werden.");
    } finally {
      setBusyTurn(false);
    }
  }

  async function saveTarget() {
    setBusyTarget(true);
    setError(null);
    try {
      const parsed = targetInput.trim() === "" ? null : Math.max(1, parseInt(targetInput, 10));
      await setEventTarget(event.id, Number.isNaN(parsed as number) ? null : parsed);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ziel konnte nicht gespeichert werden.");
    } finally {
      setBusyTarget(false);
    }
  }

  async function finishEvening() {
    if (!window.confirm("Diesen Abend jetzt wirklich beenden?")) return;
    setBusyEnd(true);
    setError(null);
    try {
      await endEvent(event.id);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abend konnte nicht beendet werden.");
      setBusyEnd(false);
    }
  }

  const played = event.challengeIds.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-surface rounded-2xl p-4 mb-4 space-y-4"
    >
      {/* Reihum-Modus */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm flex items-center gap-1.5">🔄 Reihum-Modus</p>
          <p className="text-muted text-xs mt-0.5">
            {event.turnModeEnabled
              ? currentTurnMember
                ? `Dran: ${currentTurnMember.name}`
                : "Aktiv"
              : "Aus – wie bisher machen alle jede Challenge"}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          disabled={busyTurn}
          onClick={toggleTurnMode}
          className="shrink-0 w-14 h-8 rounded-full relative transition-colors disabled:opacity-40"
          style={{ background: event.turnModeEnabled ? "var(--gradient-accent)" : "rgba(255,255,255,0.12)" }}
          aria-pressed={event.turnModeEnabled}
          aria-label="Reihum-Modus umschalten"
        >
          <motion.span
            className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow"
            animate={{ x: event.turnModeEnabled ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </motion.button>
      </div>

      {event.turnModeEnabled && currentTurnMember && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/5">
          <Avatar emoji={currentTurnMember.avatarEmoji} size="sm" />
          <span className="text-sm">
            <strong>{currentTurnMember.name}</strong> ist als Nächstes dran
          </span>
        </div>
      )}

      <div className="h-px bg-white/10" />

      {/* Abend-Ziel */}
      <div>
        <p className="font-semibold text-sm flex items-center gap-1.5 mb-1">🎯 Abend-Ziel</p>
        <p className="text-muted text-xs mb-2">
          {event.targetChallengeCount
            ? `${played} von ${event.targetChallengeCount} Challenges – Abend endet automatisch bei Erreichen.`
            : "Optional: nach wie vielen Challenges soll der Abend automatisch enden?"}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="kein Ziel"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            className="w-24 rounded-xl bg-white/5 px-3 py-2 text-sm outline-none border border-white/10 focus:border-white/25"
          />
          <button
            disabled={busyTarget}
            onClick={saveTarget}
            className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            Speichern
          </button>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <button
        disabled={busyEnd}
        onClick={finishEvening}
        className="w-full rounded-xl py-2.5 font-semibold text-sm text-center disabled:opacity-40"
        style={{ background: "rgba(255,69,58,0.15)", color: "#FF453A" }}
      >
        {busyEnd ? "Wird beendet…" : "Abend beenden 🏁"}
      </button>

      {error && <p className="text-[#FF453A] text-xs text-center">{error}</p>}
    </motion.div>
  );
}
