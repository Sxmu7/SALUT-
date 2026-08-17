"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { isOnboarded } from "@/lib/db";

const FEATURES = [
  {
    icon: "🎯",
    title: "Trinkchallenges mit Beweis",
    text: "Fotos & Videos als Nachweis – die Gruppe stimmt live über jede Challenge ab.",
  },
  {
    icon: "⚡",
    title: "Punktesystem wie Kickbase",
    text: "Jede Challenge hat einen festen Punktewert. Sammle Punkte und steige im Ranking auf.",
  },
  {
    icon: "🎂",
    title: "Automatische Geburtstags-Events",
    text: "Trag deinen Geburtstag einmal ein – Salut! erstellt automatisch dein Special-Event mit Extra-Challenges.",
  },
  {
    icon: "🏆",
    title: "Live-Ranking",
    text: "Animiertes Leaderboard, Kategorien-Dashboard & Countdown zum nächsten Event.",
  },
  {
    icon: "📄",
    title: "Eigene Challenges",
    text: "Lade eigene Challenge-Listen per Dokument hoch – KI-Modus folgt bald.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  function handleStart() {
    if (typeof window !== "undefined" && isOnboarded()) {
      router.push("/dashboard");
    } else {
      router.push("/onboarding");
    }
  }

  return (
    <div className="min-h-screen overflow-hidden relative">
      {/* Ambient gradient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-30 blur-3xl" style={{ background: "var(--gradient-party)" }} />
      <div className="pointer-events-none absolute top-1/3 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "var(--gradient-gold)" }} />

      <div className="relative max-w-md mx-auto px-6 safe-top pt-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          className="flex items-center gap-2"
        >
          <span className="text-2xl">🥂</span>
          <span className="font-display font-extrabold text-lg tracking-tight">Salut!</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="font-display font-extrabold text-[40px] leading-[1.05] tracking-tight mt-8"
        >
          Jede Party.
          <br />
          <span className="gradient-text">Ein Ranking.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="text-muted mt-4 text-[15px] leading-relaxed"
        >
          Salut! verwandelt Trinkspiele in ein animiertes Erlebnis: Challenges,
          Foto-/Videobeweise, lokale Abstimmung und ein Punktesystem wie bei
          Kickbase – inklusive automatischer Geburtstags-Events.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="mt-7"
        >
          <Button size="lg" fullWidth onClick={handleStart}>
            Jetzt starten 🥂
          </Button>
          <p className="text-center text-muted text-xs mt-3">
            Kostenlos · Optimiert für iPhone · Als App installierbar
          </p>
        </motion.div>

        <div className="mt-10">
          <PhoneMockup />
        </div>

        <div className="mt-14 space-y-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 200, damping: 22 }}
              className="card-surface rounded-2xl p-4 flex items-start gap-3"
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                style={{ background: "var(--gradient-party)" }}
              >
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-[15px]">{f.title}</h3>
                <p className="text-muted text-[13px] mt-0.5 leading-relaxed">{f.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 mb-24 text-center"
        >
          <h2 className="font-display text-2xl font-extrabold">
            Bereit für die nächste Runde?
          </h2>
          <p className="text-muted text-sm mt-2 mb-5">
            Erstelle deine Crew und leg direkt los.
          </p>
          <Button size="lg" fullWidth onClick={handleStart}>
            Salut! kostenlos starten
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
