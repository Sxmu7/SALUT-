"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePartyPush } from "@/hooks/usePartyPush";
import { isPushSupported } from "@/lib/push";

const INTERVAL_OPTIONS = [5, 10, 15, 30];

/**
 * Schalter für automatische Push-Challenges im Party-Modus. Nur relevant
 * im Supabase-Modus (siehe isRemoteMode()-Check am Aufrufort) – läuft
 * komplett serverseitig (Supabase Edge Function + pg_cron), funktioniert
 * also auch, wenn diese PWA komplett geschlossen ist.
 */
export function PartyPushToggle({ eventId }: { eventId: string }) {
  const { state, ready, busy, error, enable, disable } = usePartyPush(eventId);
  const [interval, setInterval_] = useState(5);

  if (!ready) return null;

  const enabled = state?.pushEnabled ?? false;
  const supported = isPushSupported();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-surface rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            🔔 Automatische Challenges
          </p>
          <p className="text-muted text-xs mt-0.5">
            {enabled
              ? `Aktiv – alle ${state?.intervalMinutes ?? interval} Min. per Push`
              : "Push-Challenge im eingestellten Takt, auch bei geschlossener App"}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          disabled={busy || !supported}
          onClick={() => (enabled ? disable() : enable(interval))}
          className="shrink-0 w-14 h-8 rounded-full relative transition-colors disabled:opacity-40"
          style={{ background: enabled ? "var(--gradient-accent)" : "rgba(255,255,255,0.12)" }}
          aria-pressed={enabled}
          aria-label="Automatische Push-Challenges umschalten"
        >
          <motion.span
            className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow"
            animate={{ x: enabled ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </motion.button>
      </div>

      {!enabled && !busy && (
        <div className="flex gap-2 mt-3">
          {INTERVAL_OPTIONS.map((min) => (
            <button
              key={min}
              onClick={() => setInterval_(min)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                interval === min ? "bg-white/15" : "bg-white/5 text-muted"
              }`}
            >
              {min} Min.
            </button>
          ))}
        </div>
      )}

      {!supported && (
        <p className="text-muted text-[11px] mt-2">
          Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.
        </p>
      )}

      {error && <p className="text-[#FF453A] text-xs mt-2">{error}</p>}
    </motion.div>
  );
}
