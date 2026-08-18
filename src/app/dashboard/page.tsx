"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CountdownFlip } from "@/components/ui/CountdownFlip";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { TopBarSkeleton, CardSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { useProfile } from "@/hooks/useProfile";
import { usePrimaryGroup } from "@/hooks/useGroups";
import { useRanking, useNextHighlight } from "@/hooks/useRanking";
import { ensureBirthdayEvents, getOrCreateQuickEvent } from "@/lib/data-layer";
import { daysUntil } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { profile, ready: profileReady, onboarded } = useProfile();
  const { group, ready: groupReady, error: groupError, refresh: refreshGroup } = usePrimaryGroup();
  const { ranking } = useRanking(group?.id);
  const { highlight } = useNextHighlight(group?.id);
  const [birthdayToday, setBirthdayToday] = useState(false);

  useEffect(() => {
    if (profileReady && !onboarded) {
      router.replace("/onboarding");
    }
  }, [profileReady, onboarded, router]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const created = await ensureBirthdayEvents();
      if (created.some((e) => e.birthdayUserId === profile.id)) {
        setBirthdayToday(true);
      }
    })();
  }, [profile]);

  // Noch am Laden (Profil/Gruppe werden gerade geladen): Skeletons zeigen.
  if (!profileReady || !groupReady || !profile) {
    return (
      <AppShell>
        <TopBarSkeleton />
        <div className="px-5 space-y-4">
          <CardSkeleton lines={2} className="h-32" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-[var(--radius-md)]" />
            <Skeleton className="h-20 rounded-[var(--radius-md)]" />
          </div>
          <CardSkeleton lines={3} />
        </div>
      </AppShell>
    );
  }

  // Laden ist fertig, aber das Nachladen der Gruppe ist mit einem echten
  // Fehler gescheitert (Netzwerk, RLS, fehlende Datenbankfunktion, ...).
  // Das MUSS sich anders anfühlen als "du hast einfach noch keine Crew" –
  // sonst wirkt eine frisch erstellte Gruppe, die aus irgendeinem Grund
  // nicht geladen werden konnte, wie "Erstellen hat nichts gebracht",
  // ohne jeden Hinweis, was wirklich schiefging.
  if (groupError) {
    return (
      <AppShell>
        <TopBar
          title={`Hey ${profile.name} 👋`}
          right={<Avatar emoji={profile.avatarEmoji} size="md" />}
        />
        <div className="px-5">
          <Card className="text-center py-10">
            <span className="text-4xl">⚠️</span>
            <p className="font-display font-bold text-lg mt-3">
              Gruppe konnte nicht geladen werden
            </p>
            <p className="text-muted text-sm mt-2 max-w-[280px] mx-auto break-words">
              {groupError}
            </p>
            <Button fullWidth size="lg" className="mt-6" onClick={() => refreshGroup()}>
              Erneut versuchen
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  // Fertig geladen, keine Fehler, aber (noch) keine Gruppe vorhanden – das
  // ist ein gültiger Zustand (z.B. bei Supabase-Nutzern, deren automatische
  // Erstgruppe aus irgendeinem Grund nicht angelegt wurde) und darf die App
  // nicht für immer im Skeleton hängen lassen. Statt einer endlosen
  // Ladeanimation bekommt der Nutzer hier einen klaren Weg nach vorn.
  if (!group) {
    return (
      <AppShell>
        <TopBar
          title={`Hey ${profile.name} 👋`}
          right={<Avatar emoji={profile.avatarEmoji} size="md" />}
        />
        <div className="px-5">
          <Card className="text-center py-10">
            <span className="text-4xl">🎉</span>
            <p className="font-display font-bold text-lg mt-3">
              Noch keine Crew
            </p>
            <p className="text-muted text-sm mt-2 max-w-[260px] mx-auto">
              Erstelle eine Gruppe oder tritt mit einem Einladungscode bei,
              um loszulegen.
            </p>
            <Link href="/groups">
              <Button fullWidth size="lg" className="mt-6">
                Zu den Gruppen →
              </Button>
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const days = highlight ? daysUntil(highlight.date.toISOString()) : null;
  const myRank = ranking.find((r) => r.userId === profile.id);
  const isLiveEvent = highlight && days === 0;

  return (
    <AppShell>
      <TopBar
        title={`Hey ${profile.name} 👋`}
        subtitle={group.name}
        right={<Avatar emoji={profile.avatarEmoji} size="md" />}
      />

      <div className="px-5 space-y-4">
        {birthdayToday && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-4 text-center font-semibold"
            style={{ background: "var(--gradient-gold)" }}
          >
            🎉 Alles Gute zum Geburtstag! Dein Special-Abend ist bereit.
          </motion.div>
        )}

        <Card
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden"
        >
          <div
            className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20 blur-2xl"
            style={{ background: "var(--accent)" }}
          />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-muted text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                {isLiveEvent && (
                  <span className="pulse-ring inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                )}
                {isLiveEvent ? "Läuft jetzt" : "Nächstes Event"}
              </p>
              <p className="font-display font-bold text-lg mt-1 flex items-center gap-1.5">
                <span>{highlight?.emoji ?? "🎉"}</span>
                {highlight?.label ?? "Noch kein Event geplant"}
              </p>
            </div>
          </div>
          {highlight && (
            <div className="relative mt-4 flex items-end gap-2">
              {isLiveEvent ? (
                <span className="text-2xl font-display font-extrabold gradient-text">
                  Heute! 🎊
                </span>
              ) : (
                <>
                  <CountdownFlip days={days ?? 0} className="text-4xl gradient-text" />
                  <span className="text-muted mb-1 text-sm">
                    {days === 1 ? "Tag" : "Tage"}
                  </span>
                </>
              )}
            </div>
          )}
          {highlight?.eventId && (
            <Link href={`/events/${highlight.eventId}`}>
              <motion.div
                whileTap={{ scale: 0.97 }}
                className="relative mt-4 text-center py-3 rounded-xl font-semibold text-sm"
                style={{ background: "var(--gradient-accent)" }}
              >
                Event öffnen →
              </motion.div>
            </Link>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <p className="text-muted text-xs font-semibold uppercase">Deine Punkte</p>
            <AnimatedNumber
              value={myRank?.points ?? 0}
              className="font-display font-extrabold text-3xl block mt-1"
            />
          </Card>
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-muted text-xs font-semibold uppercase">Rang</p>
            <span className="font-display font-extrabold text-3xl block mt-1 gradient-text">
              #{myRank?.rank ?? "–"}
            </span>
          </Card>
        </div>

        {!highlight?.eventId && (
          <Button
            fullWidth
            size="lg"
            onClick={async () => {
              const event = await getOrCreateQuickEvent(group.id);
              router.push(`/events/${event.id}`);
            }}
          >
            Abend starten 🎲
          </Button>
        )}

        <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">Top 3</h2>
            <Link href="/ranking" className="text-sm text-muted">
              Ganzes Ranking →
            </Link>
          </div>
          <div className="space-y-2">
            {ranking.slice(0, 3).map((r) => (
              <div key={r.userId} className="flex items-center gap-2.5">
                <span className="w-5 text-sm font-bold gradient-gold-text">{r.rank}</span>
                <Avatar emoji={r.avatarEmoji} size="sm" />
                <span className="flex-1 text-sm font-medium truncate">{r.name}</span>
                <span className="text-sm font-bold">{r.points}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
