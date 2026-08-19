"use client";

import { motion } from "framer-motion";
import { useVoteNotifications } from "@/hooks/useVoteNotifications";
import { isPushSupported, isIosNonStandalone } from "@/lib/push";

/**
 * Schalter für Live-Push-Benachrichtigungen rund um Challenges – deckt
 * ZWEI Fälle ab, beide über dieselbe Push-Subscription (kein separates
 * Opt-in nötig): (1) "bei neuer Einreichung benachrichtigen" – sobald
 * jemand eine Challenge samt Beweis einreicht, bekommen alle anderen eine
 * Push und können direkt zum "Wartet auf deine Stimme"-Panel springen
 * (siehe PendingVotes.tsx); (2) "QuizDuell-Style" – sobald jemandes
 * Challenge genehmigt wird, bekommen alle anderen (bzw. im Reihum-Modus
 * insbesondere die als Nächstes dran ist) ebenfalls eine Push (siehe
 * notify-challenge-completed Edge Function). Beides funktioniert auch bei
 * geschlossener PWA. Anders als PartyPushToggle (nur Party-Events,
 * automatischer Challenge-Takt) gilt dieser Schalter für JEDEN Event-Typ.
 */
export function VoteNotifyToggle() {
  const { enabled, ready, busy, error, enable, disable } = useVoteNotifications();
  const supported = isPushSupported();

  // iOS ohne "Zum Home-Bildschirm"-Installation: PushManager fehlt, der
  // Schalter würde sonst kommentarlos verschwinden – stattdessen ein
  // erklärender Hinweis, wie man Push auf dem iPhone überhaupt aktivieren
  // kann (Safari-Voraussetzung, keine App-Einstellung).
  if (!ready) return null;
  if (!supported) {
    if (!isIosNonStandalone()) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface rounded-2xl p-4 mb-4"
      >
        <p className="font-semibold text-sm flex items-center gap-1.5 mb-1">
          🔔 Push-Benachrichtigungen auf dem iPhone
        </p>
        <p className="text-muted text-xs leading-relaxed">
          Safari erlaubt Push-Benachrichtigungen nur für Apps, die &bdquo;Zum
          Home-Bildschirm&ldquo; hinzugefügt wurden (iOS 16.4+). Tippe unten
          im Teilen-Menü auf <strong>&bdquo;Zum Home-Bildschirm&ldquo;</strong>{" "}
          und öffne Salut! danach von dort – erst dann taucht dieser
          Schalter aktiv auf.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-surface rounded-2xl p-4 mb-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            🔔 Live-Benachrichtigungen
          </p>
          <p className="text-muted text-xs mt-0.5">
            {enabled
              ? "Aktiv – Push bei neuen Einreichungen & gemeisterten Challenges"
              : "Push, wenn jemand einreicht (deine Stimme) oder eine Challenge schafft"}
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
