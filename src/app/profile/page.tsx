"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { TopBarSkeleton, CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useProfile } from "@/hooks/useProfile";
import { usePrimaryGroup } from "@/hooks/useGroups";
import { useRanking } from "@/hooks/useRanking";
import { AVATAR_EMOJIS, ageOnNextBirthday } from "@/lib/utils";

export default function ProfilePage() {
  const { profile, ready, updateProfile } = useProfile();
  const { group } = usePrimaryGroup();
  const { ranking } = useRanking(group?.id);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setBirthday(profile.birthday ?? "");
  }, [profile]);

  const me = ranking.find((r) => r.userId === profile?.id);

  function save() {
    updateProfile({ name, birthday: birthday || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  if (!ready || !profile) {
    return (
      <AppShell>
        <TopBarSkeleton />
        <div className="px-5 space-y-4">
          <div className="card-surface rounded-[var(--radius-md)] p-8 flex flex-col items-center">
            <Skeleton className="w-20 h-20 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-16 rounded-[var(--radius-md)]" />
            <Skeleton className="h-16 rounded-[var(--radius-md)]" />
            <Skeleton className="h-16 rounded-[var(--radius-md)]" />
          </div>
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title="Profil" subtitle="Deine Einstellungen" />

      <div className="px-5 space-y-4">
        <Card className="flex flex-col items-center text-center py-8">
          <Avatar emoji={profile.avatarEmoji} size="xl" ring />
          <div className="grid grid-cols-8 gap-1.5 mt-5">
            {AVATAR_EMOJIS.map((e) => (
              <motion.button
                key={e}
                whileTap={{ scale: 0.85 }}
                onClick={() => updateProfile({ avatarEmoji: e })}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${
                  profile.avatarEmoji === e ? "ring-2 ring-[#BF5AF2]" : "bg-white/5"
                }`}
              >
                {e}
              </motion.button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-4">
            <p className="font-display font-extrabold text-xl">{me?.points ?? 0}</p>
            <p className="text-muted text-[11px] mt-0.5">Punkte</p>
          </Card>
          <Card className="text-center py-4">
            <p className="font-display font-extrabold text-xl gradient-text">
              #{me?.rank ?? "–"}
            </p>
            <p className="text-muted text-[11px] mt-0.5">Rang</p>
          </Card>
          <Card className="text-center py-4">
            <p className="font-display font-extrabold text-xl">{me?.challengesCompleted ?? 0}</p>
            <p className="text-muted text-[11px] mt-0.5">Challenges</p>
          </Card>
        </div>

        <Card>
          <label className="text-xs font-semibold text-muted uppercase">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent border-b border-white/10 py-2.5 mt-1 font-medium focus:border-[#BF5AF2] transition-colors"
          />
        </Card>

        <Card>
          <label className="text-xs font-semibold text-muted uppercase">Geburtstag</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full bg-transparent border-b border-white/10 py-2.5 mt-1 font-medium focus:border-[#BF5AF2] transition-colors"
          />
          {birthday && (
            <p className="text-muted text-xs mt-2">
              🎂 In {ageOnNextBirthday(birthday)} Jahren wird automatisch dein
              Geburtstags-Abend gestartet.
            </p>
          )}
        </Card>

        <Button fullWidth size="lg" onClick={save}>
          {saved ? "Gespeichert ✓" : "Speichern"}
        </Button>

        <div className="pt-4 pb-6">
          <p className="text-muted text-xs text-center leading-relaxed">
            Salut! läuft aktuell im lokalen Demo-Modus. Verbinde Supabase in
            den Projekt-Einstellungen für Multi-Device-Sync mit deiner
            gesamten Crew.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
