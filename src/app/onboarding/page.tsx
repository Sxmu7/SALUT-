"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { createOrUpdateProfile } from "@/lib/db";
import { AVATAR_EMOJIS } from "@/lib/utils";

const TOTAL_STEPS = 5;
const INTRO_STEPS = 2;

const INTRO_SLIDES = [
  {
    icon: "🎲",
    title: "Nicht durchblättern. Würfeln.",
    text: "Challenges siehst du vorher nicht als Liste. Sie kommen per Würfel – überraschend, jeder Abend anders.",
  },
  {
    icon: "🏆",
    title: "Punkte wie bei Kickbase.",
    text: "Jede gemeisterte Challenge bringt feste Punkte. Am Ende eines Abends zählt, wer oben im Ranking steht.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(AVATAR_EMOJIS[0]);
  const [birthday, setBirthday] = useState("");

  function next() {
    if (step === INTRO_STEPS && !name.trim()) return;
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finish();
  }

  function finish() {
    createOrUpdateProfile({
      name: name.trim() || "Du",
      avatarEmoji: emoji,
      birthday: birthday || null,
    });
    router.push("/dashboard");
  }

  const isIntro = step < INTRO_STEPS;

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto safe-top safe-bottom">
      <div className="flex items-center justify-between mb-10">
        <div className="flex gap-1.5 flex-1">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full overflow-hidden bg-white/10">
              <motion.div
                className="h-full bg-white/70"
                initial={{ width: 0 }}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.4 }}
              />
            </div>
          ))}
        </div>
        {isIntro && (
          <button
            onClick={() => setStep(INTRO_STEPS)}
            className="ml-4 text-muted text-xs shrink-0"
          >
            Überspringen
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <IntroSlide key="intro0" slide={INTRO_SLIDES[0]} />
        )}

        {step === 1 && (
          <IntroSlide key="intro1" slide={INTRO_SLIDES[1]} />
        )}

        {step === 2 && (
          <motion.div
            key="step-name"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h1 className="font-display text-3xl font-extrabold">Wie heißt du? 👋</h1>
            <p className="text-muted mt-2 text-[15px]">
              Dein Name erscheint im Ranking deiner Crew.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
              className="w-full mt-8 card-surface rounded-2xl px-5 py-4 text-lg font-medium placeholder:text-muted"
              onKeyDown={(e) => e.key === "Enter" && next()}
            />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step-avatar"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h1 className="font-display text-3xl font-extrabold">Wähl dein Avatar 🎭</h1>
            <p className="text-muted mt-2 text-[15px]">So erkennt dich die Crew im Ranking.</p>
            <div className="flex justify-center my-8">
              <Avatar emoji={emoji} size="xl" ring />
            </div>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_EMOJIS.map((e) => (
                <motion.button
                  key={e}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setEmoji(e)}
                  className={`aspect-square rounded-xl flex items-center justify-center text-xl card-surface ${
                    emoji === e ? "ring-2 ring-[#BF5AF2]" : ""
                  }`}
                >
                  {e}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step-birthday"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h1 className="font-display text-3xl font-extrabold">Dein Geburtstag 🎂</h1>
            <p className="text-muted mt-2 text-[15px]">
              Salut! merkt sich dein Datum und startet an deinem Ehrentag
              automatisch einen Abend mit exklusiven Challenges für deine Crew.
            </p>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="w-full mt-8 card-surface rounded-2xl px-5 py-4 text-lg font-medium"
            />
            <p className="text-muted text-xs mt-3">
              Optional – du kannst das später jederzeit im Profil ändern.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Zurück
          </Button>
        )}
        <Button fullWidth onClick={next}>
          {isIntro ? "Weiter" : step < TOTAL_STEPS - 1 ? "Weiter" : "Los geht's 🥂"}
        </Button>
      </div>
    </div>
  );
}

function IntroSlide({ slide }: { slide: { icon: string; title: string; text: string } }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="flex flex-col items-center text-center py-6"
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl card-surface"
      >
        {slide.icon}
      </motion.div>
      <h1 className="font-display text-2xl font-extrabold mt-7 max-w-[280px]">
        {slide.title}
      </h1>
      <p className="text-muted mt-3 text-[15px] leading-relaxed max-w-[280px]">
        {slide.text}
      </p>
    </motion.div>
  );
}
