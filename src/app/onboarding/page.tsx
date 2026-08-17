"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { createOrUpdateProfile } from "@/lib/db";
import { AVATAR_EMOJIS } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(AVATAR_EMOJIS[0]);
  const [birthday, setBirthday] = useState("");

  function next() {
    if (step === 0 && !name.trim()) return;
    if (step < 2) setStep(step + 1);
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

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto safe-top safe-bottom">
      <div className="flex gap-1.5 mb-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full overflow-hidden bg-white/10"
          >
            <motion.div
              className="h-full"
              style={{ background: "var(--gradient-party)" }}
              initial={{ width: 0 }}
              animate={{ width: i <= step ? "100%" : "0%" }}
              transition={{ duration: 0.4 }}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="step0"
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

        {step === 1 && (
          <motion.div
            key="step1"
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

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h1 className="font-display text-3xl font-extrabold">Dein Geburtstag 🎂</h1>
            <p className="text-muted mt-2 text-[15px]">
              Salut! merkt sich dein Datum und erstellt an deinem Ehrentag
              automatisch ein Event mit Extra-Challenges für deine Crew.
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
          {step < 2 ? "Weiter" : "Los geht's 🥂"}
        </Button>
      </div>
    </div>
  );
}
