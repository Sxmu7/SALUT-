"use client";

import { motion } from "framer-motion";
import { useVoteNotifications } from "@/hooks/useVoteNotifications";
import { isPushSupported } from "@/lib/push";

/**
 * Schalter für "bei neuer Einreichung benachrichtigen" – anders als
 * PartyPushToggle (nur Party-Events, automatischer Challenge-Takt) geht es
 * hier um die Abstimmung: sobald jemand aus der Gruppe eine Challenge samt
 * Beweis einreicht, bekommen alle anderen Mitglieder mit aktivem Schalter
 * eine Push-Benachrichtigung ("🗳️ Mia hat eingereicht!") und können direkt
 * zum "Wartet auf deine Stimme"-Panel springen (siehe PendingVotes.tsx),
 * auch wenn die PWA gerade geschlossen ist.
 */
export function VoteNotifyToggle() {
  const { enabled, ready, busy, error, enable, disable } = useVoteNotifications();
  const supported = isPushSupported();

  if (!ready || !supported) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-surface rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            🗳️ Abstimmungs-Benachrichtigungen
          </p>
          <p className="text-muted text-xs mt-0.5">
            {enabled
              ? "Aktiv – Push bei jeder neuen Einreichung"
              : "Erfahre per Push, wenn jemand einreicht und deine Stimme braucht"}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          disabled={busy}
          onClick={() => (enabled ? disable() : enable())}
          className="shrink-0 w-14 h-8 rounded-full relative transition-colors disabled:opacity-40"
          style={{ background: enabled ? "var(--gradient-accent)" : "rgba(255,255,255,0.12)" }}
          aria-pressed={enabled}
          aria-label="Abstimmungs-Benachrichtigungen umschalten"
        >
          <motion.span
            className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow"
            animate={{ x: enabled ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </motion.button>
      </div>

      {error && <p className="text-[#FF453A] text-xs mt-2">{error}</p>}
    </motion.div>
  );
}
