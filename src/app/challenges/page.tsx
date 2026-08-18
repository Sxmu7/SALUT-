"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";
import { listGroups, getOrCreateQuickEvent } from "@/lib/data-layer";

export default function ModesPage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function startEvening() {
    setStarting(true);
    const groups = await listGroups();
    const group = groups[0];
    if (!group) {
      setStarting(false);
      return;
    }
    const event = await getOrCreateQuickEvent(group.id);
    router.push(`/events/${event.id}`);
  }

  return (
    <AppShell>
      <TopBar title="Modi" subtitle="Wie soll heute gespielt werden?" />

      <div className="px-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] p-6 relative overflow-hidden"
          style={{ background: "var(--gradient-party)" }}
        >
          <span className="text-5xl">🎲</span>
          <h2 className="font-display font-extrabold text-2xl text-white mt-3">
            Party-Modus
          </h2>
          <p className="text-white/85 text-[14px] mt-1.5 leading-relaxed max-w-[280px]">
            Keine Liste zum Durchblättern – jede Challenge kommt per Würfel.
            Überraschend, jedes Mal anders.
          </p>
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            className="mt-5 bg-white/15 border-white/20"
            disabled={starting}
            onClick={startEvening}
          >
            {starting ? "Wird gestartet…" : "Abend starten 🥂"}
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 opacity-50 pointer-events-none">
          <div className="card-surface rounded-2xl p-4">
            <span className="text-2xl">🤖</span>
            <p className="font-semibold text-sm mt-2">KI-Modus</p>
            <p className="text-muted text-xs mt-0.5">
              Neue Challenges automatisch generiert.
            </p>
            <span className="inline-block mt-2 text-[10px] font-bold px-2 py-1 rounded-full bg-white/10">
              BALD
            </span>
          </div>
          <div className="card-surface rounded-2xl p-4">
            <span className="text-2xl">📋</span>
            <p className="font-semibold text-sm mt-2">Klassisch-Modus</p>
            <p className="text-muted text-xs mt-0.5">
              Feste Reihenfolge, kein Zufall.
            </p>
            <span className="inline-block mt-2 text-[10px] font-bold px-2 py-1 rounded-full bg-white/10">
              BALD
            </span>
          </div>
        </div>

        <Link href="/challenges/new">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="card-surface rounded-2xl p-3.5 flex items-center gap-3 border-dashed border-2 border-white/10"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 text-lg">
              ➕
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Eigene Challenge beisteuern</p>
              <p className="text-muted text-xs">
                Landet im Würfel-Topf eurer Crew – manuell oder per Dokument
              </p>
            </div>
          </motion.div>
        </Link>
      </div>
    </AppShell>
  );
}
