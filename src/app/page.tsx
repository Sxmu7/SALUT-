"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Typewriter } from "@/components/ui/Typewriter";
import { LogoMark } from "@/components/brand/Logo";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { isOnboarded, getCurrentProfile } from "@/lib/data-layer";

// Kurz, einfach, ohne Vergleiche zu anderen Apps – verständlich für jeden.
// Wird nur beim allerersten Öffnen gezeigt (siehe `returning` unten).
const STEPS = [
  { icon: "🎲", text: "Würfle deine nächste Challenge" },
  { icon: "📸", text: "Beweise sie mit Foto oder Video" },
  { icon: "🏆", text: "Sammle Punkte und gewinne den Abend" },
];

// Wie lange der Splash nach dem Tippen noch stehen bleibt, bevor
// wiederkehrende Nutzer automatisch weitergeleitet werden.
const AUTO_CONTINUE_DELAY = 750;

export default function LandingPage() {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const [returning, setReturning] = useState(false);
  const [typedDone, setTypedDone] = useState(false);

  useEffect(() => {
    (async () => {
      // Wie in useProfile.ts: ein vorhandenes Profil zählt zusätzlich zum
      // separaten "onboarded"-Flag als Beweis für "schon eingerichtet" –
      // schützt gegen denselben Storage-Timing-Fall, der sonst nach dem
      // Zurückkehren aus dem Hintergrund fälschlich wieder die
      // Erstnutzer-Intro statt "Tippen zum Überspringen" zeigen könnte.
      const [onboardedFlag, profile] = await Promise.all([isOnboarded(), getCurrentProfile()]);
      setReturning(onboardedFlag || Boolean(profile));
      setReady(true);
    })();
  }, []);

  function goToApp() {
    // replace statt push: "/" ist bei einem Neuladen aus dem Hintergrund
    // (iOS lädt eine im Hintergrund liegende Web-App/PWA gelegentlich
    // komplett neu) oft kein bewusst gewählter Schritt, sondern nur der
    // technische Startpunkt. Mit push würde "/" als Verlaufseintrag stehen
    // bleiben und der Zurück-Button könnte hierher zurückspringen – mit
    // replace verschwindet die Intro-Maske sauber aus der Historie.
    router.replace(returning ? "/dashboard" : "/onboarding");
  }

  // Wiederkehrende Nutzer: Marke kurz animiert zeigen, dann ohne
  // Erklärtext automatisch weiter – den kennen sie schon.
  useEffect(() => {
    if (!ready || !returning || !typedDone) return;
    const timeout = setTimeout(goToApp, AUTO_CONTINUE_DELAY);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, returning, typedDone]);

  return (
    <div
      className="h-[100dvh] overflow-hidden relative flex flex-col safe-top safe-bottom"
      onClick={returning ? goToApp : undefined}
      onKeyDown={
        returning
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") goToApp();
            }
          : undefined
      }
      role={returning ? "button" : undefined}
      tabIndex={returning ? 0 : undefined}
      aria-label={returning ? "Weiter zum Dashboard" : undefined}
    >
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
            initial={reducedMotion ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
          >
            <LogoMark size={60} animated={!reducedMotion} />
          </motion.div>
        )}

        <h1 className="font-display font-extrabold text-[52px] tracking-tight mt-5 min-h-[1.15em]">
          {ready && (
            <Typewriter
              text="Salut!"
              speed={120}
              startDelay={reducedMotion ? 0 : 300}
              reduced={reducedMotion}
              onDone={() => setTypedDone(true)}
              className="gradient-text"
            />
          )}
        </h1>

        {!returning && (
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
        )}

        {returning && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={typedDone ? { opacity: 1 } : {}}
            transition={{ delay: 0.2 }}
            className="text-muted text-xs mt-8"
          >
            Tippen zum Überspringen
          </motion.p>
        )}
      </div>

      {!returning && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={typedDone ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.55 }}
          className="relative px-6 pb-6 shrink-0"
        >
          <Button size="lg" fullWidth onClick={goToApp}>
            Los geht&apos;s 🥂
          </Button>
        </motion.div>
      )}
    </div>
  );
}
