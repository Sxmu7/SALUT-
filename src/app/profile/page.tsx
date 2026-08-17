"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { getCurrentProfile, createOrUpdateProfile, computeRanking, listGroups } from "@/lib/db";
import { AVATAR_EMOJIS, ageOnNextBirthday } from "@/lib/utils";
import { Profile } from "@/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState({ points: 0, rank: 0, completed: 0 });

  useEffect(() => {
    const p = getCurrentProfile();
    setProfile(p);
    if (p) {
      setName(p.name);
      setBirthday(p.birthday ?? "");
      const groups = listGroups();
      if (groups[0]) {
        const ranking = computeRanking(groups[0].id);
        const me = ranking.find((r) => r.userId === p.id);
        if (me) setStats({ points: me.points, rank: me.rank, completed: me.challengesCompleted });
      }
    }
  }, []);

  function save() {
    const updated = createOrUpdateProfile({ name, birthday: birthday || null });
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  if (!profile) return null;

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
                onClick={() => setProfile(createOrUpdateProfile({ avatarEmoji: e }))}
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
            <p className="font-display font-extrabold text-xl">{stats.points}</p>
            <p className="text-muted text-[11px] mt-0.5">Punkte</p>
          </Card>
          <Card className="text-center py-4">
            <p className="font-display font-extrabold text-xl gradient-text">#{stats.rank || "–"}</p>
            <p className="text-muted text-[11px] mt-0.5">Rang</p>
          </Card>
          <Card className="text-center py-4">
            <p className="font-display font-extrabold text-xl">{stats.completed}</p>
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
              Geburtstags-Event erstellt.
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
