"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CoworkerLogoMark } from "@/components/brand/CoworkerLogo";
import { listCoworkerGroups, getOrCreateCoworkerEvent, isRemoteMode } from "@/lib/data-layer";

/**
 * "/coworker" ist bewusst kein eigener Gruppen-Verwaltungsbildschirm mehr
 * (das ist jetzt im "Kollegen"-Tab von /groups zusammengeführt, siehe
 * "Gruppen neu überarbeitet" – ein Ort für beide Modi statt zwei getrennter
 * Verwaltungsseiten) – sondern ein reiner Resolver: hat der Nutzer schon
 * ein Team, geht's direkt in dessen Feed (wie "Abend starten" im
 * Party-Modus automatisch die erste Gruppe nimmt), sonst weiter zur
 * Team-Auswahl/-Erstellung.
 */
export default function CoworkerResolverPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRemoteMode()) return;
    let cancelled = false;
    (async () => {
      try {
        const groups = await listCoworkerGroups();
        if (cancelled) return;
        if (groups.length === 0) {
          router.replace("/groups?tab=coworker");
          return;
        }
        const event = await getOrCreateCoworkerEvent(groups[0].id);
        if (!cancelled) router.replace(`/coworker/events/${event.id}`);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Kollegen-Modus konnte nicht geöffnet werden."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!isRemoteMode()) {
    return (
      <AppShell>
        <TopBar title="💼 Kollegen-Modus" subtitle="Nur mit Supabase-Konto" />
        <div className="px-5">
          <Card className="text-center py-10">
            <span className="text-4xl">🔒</span>
            <p className="font-display font-bold text-lg mt-3">
              Nur mit Supabase-Konto verfügbar
            </p>
            <p className="text-muted text-sm mt-2 max-w-[280px] mx-auto">
              Der Kollegen-Modus braucht ein echtes Supabase-Projekt (automatische
              Challenges per Push laufen serverseitig). Im lokalen Demo-Modus
              steht nur das Trinkspiel zur Verfügung.
            </p>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <TopBar title="💼 Kollegen-Modus" />
        <div className="px-5">
          <Card className="text-center py-10">
            <span className="text-4xl">⚠️</span>
            <p className="font-display font-bold text-lg mt-3">Etwas ist schiefgelaufen</p>
            <p className="text-muted text-sm mt-2 max-w-[280px] mx-auto break-words">{error}</p>
            <Button
              fullWidth
              size="lg"
              className="mt-6"
              onClick={() => router.push("/groups?tab=coworker")}
            >
              Zu den Kollegen-Teams →
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title="💼 Kollegen-Modus" />
      <div className="px-5 flex flex-col items-center pt-16 gap-4">
        <CoworkerLogoMark size={56} />
        <p className="text-muted text-sm animate-pulse">Wird geöffnet…</p>
      </div>
    </AppShell>
  );
}
