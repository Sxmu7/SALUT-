"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CategoryPill } from "@/components/challenges/CategoryPill";
import { CATEGORIES } from "@/lib/data/categories";
import { addCustomChallenges } from "@/lib/data-layer";
import { parseChallengesFromText } from "@/lib/parseChallenges";
import { CategoryId, Challenge, ProofType } from "@/types";
import { uid } from "@/lib/utils";

export default function NewChallengePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "upload">("manual");
  const [category, setCategory] = useState<CategoryId>("klassiker");

  // Manual form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(25);
  const [proofType, setProofType] = useState<ProofType>("photo");

  // Upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imported, setImported] = useState<Challenge[]>([]);

  async function addManual() {
    if (!title.trim()) return;
    const challenge: Challenge = {
      id: uid("custom"),
      categoryId: category,
      title: title.trim(),
      description: description.trim() || "Eigene Challenge der Crew.",
      points,
      difficulty: points >= 80 ? "legendary" : points >= 50 ? "hard" : points >= 25 ? "medium" : "easy",
      proofType,
      icon: CATEGORIES.find((c) => c.id === category)?.icon ?? "🎯",
      animation: "pop",
      isCustom: true,
      source: "manual",
    };
    await addCustomChallenges([challenge]);
    router.push("/challenges");
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setImported(parseChallengesFromText(text, category));
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (imported.length === 0) return;
    await addCustomChallenges(imported);
    router.push("/challenges");
  }

  return (
    <AppShell>
      <TopBar title="Challenge hinzufügen" subtitle="Manuell oder per Dokument" />

      <div className="px-5">
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
              tab === "manual" ? "text-white" : "card-surface text-muted"
            }`}
            style={tab === "manual" ? { background: "var(--gradient-party)" } : {}}
          >
            ✍️ Manuell
          </button>
          <button
            onClick={() => setTab("upload")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
              tab === "upload" ? "text-white" : "card-surface text-muted"
            }`}
            style={tab === "upload" ? { background: "var(--gradient-party)" } : {}}
          >
            📄 Dokument
          </button>
        </div>

        <p className="text-xs font-semibold text-muted uppercase mb-2">Kategorie</p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4">
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              category={cat}
              active={category === cat.id}
              onClick={() => setCategory(cat.id)}
            />
          ))}
        </div>

        {tab === "manual" && (
          <div className="space-y-3">
            <Card>
              <label className="text-xs font-semibold text-muted uppercase">Titel</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Zungenbrecher-Duell"
                className="w-full bg-transparent border-b border-white/10 py-2 mt-1 font-medium"
              />
            </Card>
            <Card>
              <label className="text-xs font-semibold text-muted uppercase">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Was genau muss gemacht werden?"
                rows={3}
                className="w-full bg-transparent border-b border-white/10 py-2 mt-1 resize-none"
              />
            </Card>
            <Card>
              <label className="text-xs font-semibold text-muted uppercase">
                Punkte: <span className="gradient-text font-bold">{points}</span>
              </label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full mt-2 accent-[#BF5AF2]"
              />
            </Card>
            <Card>
              <label className="text-xs font-semibold text-muted uppercase mb-2 block">
                Beweistyp
              </label>
              <div className="flex gap-2">
                {(["photo", "video", "none"] as ProofType[]).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => setProofType(pt)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
                      proofType === pt ? "bg-white/15" : "bg-white/5 text-muted"
                    }`}
                  >
                    {pt === "photo" ? "📸 Foto" : pt === "video" ? "🎥 Video" : "🤝 Ehrenwort"}
                  </button>
                ))}
              </div>
            </Card>
            <Button fullWidth size="lg" onClick={addManual}>
              Challenge hinzufügen
            </Button>
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv,.md"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => fileRef.current?.click()}
              className="w-full card-surface rounded-2xl py-10 flex flex-col items-center gap-2 border-2 border-dashed border-white/15"
            >
              <span className="text-3xl">📄</span>
              <span className="text-sm font-semibold">
                {fileName ?? "Datei auswählen (.txt, .csv, .md)"}
              </span>
              <span className="text-muted text-xs px-6 text-center">
                Format pro Zeile: Titel | Beschreibung | Punkte
              </span>
            </motion.button>

            {imported.length > 0 && (
              <Card>
                <p className="font-semibold text-sm mb-3">
                  {imported.length} Challenges erkannt
                </p>
                <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar">
                  {imported.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <span>{c.icon}</span>
                      <span className="flex-1 truncate">{c.title}</span>
                      <span className="text-xs gradient-text font-bold">+{c.points}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Button fullWidth size="lg" disabled={imported.length === 0} onClick={confirmImport}>
              {imported.length > 0 ? `${imported.length} Challenges importieren` : "Datei hochladen"}
            </Button>

            <div className="card-surface rounded-2xl p-4 flex items-center gap-3 opacity-60">
              <span className="text-xl">🤖</span>
              <div>
                <p className="text-sm font-semibold">KI-Modus</p>
                <p className="text-muted text-xs">
                  Bald: automatisch neue Challenges aus jedem Dokument generieren.
                </p>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full bg-white/10">
                BALD
              </span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
