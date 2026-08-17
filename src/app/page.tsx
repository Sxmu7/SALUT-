"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Typewriter } from "@/components/ui/Typewriter";
import { LogoMark } from "@/components/brand/Logo";
import { isOnboarded } from "@/lib/db";

// Kurz, einfach, ohne Vergleiche zu anderen Apps – verständlich für jeden.
const STEPS = [
  { icon: "🎲", text: "Würfle deine nächste Challenge" },
  { icon: "📸", text: "Beweise sie mit Foto oder Video" },
  { icon: "🏆", text: "Sammle Punkte und gewinne den Abend" },
];

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [typedDone, setTypedDone] = useState(false);

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
    <div className="h-[100dvh] overflow-hidden relative flex flex-col safe-top safe-bottom">
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--gradient-party)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-gold)" }}
      />

      <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
        {ready && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
          >
            <LogoMark size={60} />
          </motion.div>
        )}

        <h1 className="font-display font-extrabold text-[52px] tracking-tight mt-5 min-h-[1.15em]">
          {ready && (
            <Typewriter
              text="Salut!"
              speed={120}
              startDelay={300}
              onDone={() => setTypedDone(true)}
              className="gradient-text"
            />
          )}
        </h1>

        <div className="mt-10 space-y-4 w-full max-w-xs">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.text}
              initial={{ opacity: 0, y: 10 }}
              animate={typedDone ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.14 }}
              className="flex items-center gap-3 text-left"
            >
              <span className="text-xl shrink-0">{step.icon}</span>
              <span className="text-[15px] text-foreground/90">{step.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={typedDone ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.55 }}
        className="relative px-6 pb-6 shrink-0"
      >
        <Button size="lg" fullWidth onClick={handleStart}>
          Los geht&apos;s 🥂
        </Button>
      </motion.div>
    </div>
  );
}
