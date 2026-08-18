"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { usePartyBingo } from "@/hooks/usePartyBingo";
import { BingoWinCondition } from "@/types";

const GRID_OPTIONS = [3, 5, 7];
const WIN_OPTIONS: { value: BingoWinCondition; label: string }[] = [
  { value: "one_line", label: "1 Reihe" },
  { value: "two_lines", label: "2 Reihen" },
  { value: "full_card", label: "Volle Karte" },
];

function BingoGrid({
  gridSize,
  cells,
}: {
  gridSize: number;
  cells: { position: number; isFree: boolean; icon: string | null; isTriggered: boolean }[];
}) {
  const byPosition = new Map(cells.map((c) => [c.position, c]));
  return (
    <div
      className="grid gap-1.5 mt-3"
      style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: gridSize * gridSize }, (_, i) => {
        const cell = byPosition.get(i);
        const done = Boolean(cell?.isFree || cell?.isTriggered);
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{ scale: done ? 1 : 0.96 }}
            className="aspect-square rounded-lg flex items-center justify-center text-base"
            style={{
              background: done ? "var(--gradient-accent)" : "rgba(255,255,255,0.06)",
              opacity: done ? 1 : 0.7,
            }}
          >
            {cell?.isFree ? "⭐" : cell?.icon ?? ""}
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Party-Bingo für den Party-Modus (Modi → Event → Party-Bingo). Nur im
 * Supabase-Modus verfügbar (siehe isRemoteMode()-Check am Aufrufort) –
 * Kartenerzeugung und Gewinner-Ermittlung laufen komplett serverseitig
 * (siehe usePartyBingo/lib/supabase/queries.ts/schema.sql). Die eigene
 * Karte ist rein lesbar - markiert wird nie einzeln, sondern immer über
 * die Ereignis-Liste unten, die für die ganze Party gilt.
 */
export function PartyBingoPanel({ eventId }: { eventId: string }) {
  const { snapshot, ready, busy, error, start, report, finish } = usePartyBingo(eventId);
  const [gridSize, setGridSize] = useState(5);
  const [winCondition, setWinCondition] = useState<BingoWinCondition>("one_line");

  if (!ready) return null;

  if (!snapshot) {
    return (
      <Card className="mb-4 !p-4">
        <p className="font-semibold text-sm flex items-center gap-1.5">🎲 Party-Bingo</p>
        <p className="text-muted text-xs mt-1">
          Jeder bekommt eine eigene, zufällige Karte mit Party-Momenten – passiert etwas
          davon wirklich, wird es bei allen Karten automatisch markiert.
        </p>

        <div className="flex gap-2 mt-3">
          {GRID_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setGridSize(n)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                gridSize === n ? "bg-white/15" : "bg-white/5 text-muted"
              }`}
            >
              {n}×{n}
            </button>
          ))}
        </div>

        <div className="flex gap-2 mt-2">
          {WIN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setWinCondition(opt.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${
                winCondition === opt.value ? "bg-white/15" : "bg-white/5 text-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button
          fullWidth
          size="md"
          className="mt-3"
          disabled={busy}
          onClick={() => start({ gridSize, winCondition, freeCenter: true })}
        >
          {busy ? "Wird gestartet…" : "Party-Bingo starten"}
        </Button>

        {error && <p className="text-[#FF453A] text-xs mt-2">{error}</p>}
      </Card>
    );
  }

  const { bingo, events, myCard, playersProgress } = snapshot;
  const myDoneCount = myCard.filter((c) => c.isFree || c.isTriggered).length;
  const openEvents = events.filter((e) => !e.isTriggered);
  const winner = playersProgress.find((p) => p.isWinner);

  return (
    <Card className="mb-4 !p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm flex items-center gap-1.5">🎲 Party-Bingo</p>
        {bingo.status === "active" && (
          <span className="text-muted text-xs">
            {myDoneCount}/{bingo.gridSize * bingo.gridSize}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {bingo.status === "finished" ? (
          <motion.div
            key="finished"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center py-3">
              <span className="text-3xl">🏆</span>
              <p className="font-display font-bold text-base mt-2">
                {winner ? `${winner.name} hat Bingo!` : "Runde beendet – kein Bingo"}
              </p>
            </div>

            <BingoGrid gridSize={bingo.gridSize} cells={myCard} />

            {playersProgress.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted uppercase">Fortschritt</p>
                {playersProgress
                  .slice()
                  .sort((a, b) => b.completedCount - a.completedCount)
                  .map((p) => (
                    <div key={p.userId} className="flex items-center gap-2">
                      <span className="text-sm shrink-0">{p.avatarEmoji}</span>
                      <span className="text-xs shrink-0 w-16 truncate">{p.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (p.completedCount / p.totalCount) * 100)}%`,
                            background: p.isWinner ? "var(--gradient-gold)" : "var(--gradient-accent)",
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-muted shrink-0">
                        {p.completedCount}/{p.totalCount}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <BingoGrid gridSize={bingo.gridSize} cells={myCard} />

            {openEvents.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted uppercase mb-2">
                  Ist das gerade passiert?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {openEvents.map((ev) => (
                    <button
                      key={ev.id}
                      disabled={busy}
                      onClick={() => report(ev.id)}
                      className="px-3 py-1.5 rounded-full text-xs bg-white/6 disabled:opacity-40"
                    >
                      {ev.icon} {ev.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-4"
              disabled={busy}
              onClick={() => finish()}
            >
              Bingo beenden
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-[#FF453A] text-xs mt-2">{error}</p>}
    </Card>
  );
}
