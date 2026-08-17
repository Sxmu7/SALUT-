"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StaggerText } from "@/components/ui/StaggerText";
import { PhoneMockup } from "@/components/landing/PhoneMockup";
import { Logo } from "@/components/brand/Logo";
import { isOnboarded } from "@/lib/db";

const FEATURES = [
  {
    icon: "🎲",
    title: "Würfel statt Liste",
    text: "Challenges kommen überraschend per Würfel – nichts ist vorher sichtbar.",
  },
  {
    icon: "📸",
    title: "Beweis zählt",
    text: "Foto oder Video als Nachweis, live von der Crew abgestimmt.",
  },
  {
    icon: "⚡",
    title: "Punkte wie Kickbase",
    text: "Fester Punktewert pro Challenge. Sammeln, aufsteigen, gewinnen.",
  },
  {
    icon: "🎂",
    title: "Geburtstags-Events",
    text: "Einmal eintragen – Salut! startet automatisch dein Special-Event.",
  },
  {
    icon: "📄",
    title: "Eigene Challenges",
    text: "Lade eigene Listen hoch. KI-Modus für neue Challenges folgt bald.",
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

      <div className="relative max-w-md mx-auto px-6 safe-top pt-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
        >
          {ready && <Logo size={32} />}
        </motion.div>

        <h1 className="font-display font-extrabold text-[40px] leading-[1.05] tracking-tight mt-9">
          <StaggerText text="Jede Party." active={ready} delay={0.15} />
          <br />
          <StaggerText
            text="Ein Ranking."
            active={ready}
            delay={0.4}
            className="gradient-text"
          />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.75 }}
          className="text-muted mt-4 text-[15px] leading-relaxed"
        >
          Trinkchallenges per Würfel, Foto-/Videobeweis, Live-Abstimmung der
          Crew und ein Punktesystem wie bei Kickbase – inklusive automatischer
          Geburtstags-Events.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={ready ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.85 }}
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

        <div className="mt-14">
          <p className="text-muted text-xs font-semibold uppercase tracking-wide px-0.5 mb-3">
            So funktioniert&apos;s
          </p>
          <FeatureCarousel />
        </div>

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          className="w-full mt-10 mb-24 rounded-[28px] p-6 text-left relative overflow-hidden"
          style={{ background: "var(--gradient-party)" }}
        >
          <p className="font-display text-xl font-extrabold text-white">
            Bereit für die nächste Runde?
          </p>
          <p className="text-white/80 text-sm mt-1">
            Crew erstellen & direkt loslegen →
          </p>
        </motion.button>
      </div>
    </div>
  );
}

function FeatureCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function handleScroll() {
    const el = trackRef.current;
    if (!el || el.children.length === 0) return;
    const cardWidth = (el.children[0] as HTMLElement).offsetWidth + 12;
    setActive(Math.round(el.scrollLeft / cardWidth));
  }

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-6 px-6 pb-1"
      >
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{ delay: i * 0.04, type: "spring", stiffness: 200, damping: 22 }}
            className="card-surface rounded-2xl p-5 shrink-0 w-[72%] snap-start"
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
              style={{ background: "var(--gradient-party)" }}
            >
              {f.icon}
            </div>
            <h3 className="font-semibold text-[15px] mt-3">{f.title}</h3>
            <p className="text-muted text-[13px] mt-1 leading-relaxed">{f.text}</p>
          </motion.div>
        ))}
      </div>
      <div className="flex gap-1.5 justify-center mt-4">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === active ? 16 : 6,
              background: i === active ? "var(--accent)" : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
