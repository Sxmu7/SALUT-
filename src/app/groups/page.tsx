"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useGroups } from "@/hooks/useGroups";
import { useNextHighlight } from "@/hooks/useRanking";
import { listGroupMembers } from "@/lib/db";
import { daysUntil } from "@/lib/utils";
import { Group } from "@/types";

const GROUP_EMOJIS = ["🎉", "🍻", "🥂", "🎊", "🔥", "🎈"];

export default function GroupsPage() {
  const { groups, create, join } = useGroups();
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleCreate() {
    if (!name.trim()) return;
    create(name.trim(), emoji);
    setName("");
    setMode("none");
  }

  function handleJoin() {
    const g = join(code);
    if (!g) {
      setError("Code nicht gefunden");
      return;
    }
    setCode("");
    setError("");
    setMode("none");
  }

  return (
    <AppShell>
      <TopBar title="Freunde" subtitle="Deine Crews" />

      <div className="px-5 space-y-3">
        {groups.map((g, i) => (
          <GroupCard key={g.id} group={g} index={i} />
        ))}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="secondary" onClick={() => setMode("create")}>
            + Neue Gruppe
          </Button>
          <Button variant="secondary" onClick={() => setMode("join")}>
            Beitreten
          </Button>
        </div>

        {mode === "create" && (
          <Card>
            <p className="font-semibold mb-3">Neue Gruppe</p>
            <div className="flex gap-2 mb-3">
              {GROUP_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center card-surface ${
                    emoji === e ? "ring-2 ring-[#BF5AF2]" : ""
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gruppenname"
              className="w-full card-surface rounded-xl px-4 py-3 mb-3"
            />
            <Button fullWidth onClick={handleCreate}>
              Erstellen
            </Button>
          </Card>
        )}

        {mode === "join" && (
          <Card>
            <p className="font-semibold mb-3">Gruppe beitreten</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Einladungscode"
              className="w-full card-surface rounded-xl px-4 py-3 mb-2 font-mono tracking-widest"
            />
            {error && <p className="text-[#FF453A] text-xs mb-2">{error}</p>}
            <Button fullWidth onClick={handleJoin}>
              Beitreten
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function GroupCard({ group, index }: { group: Group; index: number }) {
  const members = listGroupMembers(group.id);
  const { highlight } = useNextHighlight(group.id);
  const days = highlight ? daysUntil(highlight.date.toISOString()) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: "var(--gradient-party)" }}
        >
          {group.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{group.name}</p>
          <div className="flex items-center -space-x-2 mt-1.5">
            {members.slice(0, 5).map((m) => (
              <Avatar
                key={m.id}
                emoji={m.avatarEmoji}
                size="sm"
                className="ring-2 ring-[var(--surface)]"
              />
            ))}
            <span className="text-muted text-xs ml-3">{members.length} Mitglieder</span>
          </div>
          <p className="text-muted text-[11px] mt-1">
            Code: <span className="font-mono font-semibold text-foreground">{group.inviteCode}</span>
          </p>
        </div>
        {highlight && (
          <div className="text-right shrink-0 pl-2">
            <p className="text-[10px] text-muted uppercase font-semibold">
              {days === 0 ? "Heute" : highlight.emoji}
            </p>
            <p className="text-sm font-bold gradient-text">{days === 0 ? "🎉" : `${days}T`}</p>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
