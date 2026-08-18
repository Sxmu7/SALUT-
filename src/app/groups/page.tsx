"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useGroups } from "@/hooks/useGroups";
import { useNextHighlight } from "@/hooks/useRanking";
import { useProfile } from "@/hooks/useProfile";
import { listGroupMembers, subscribeToGroups } from "@/lib/data-layer";
import { daysUntil } from "@/lib/utils";
import { Group, Profile } from "@/types";

const GROUP_EMOJIS = ["🎉", "🍻", "🥂", "🎊", "🔥", "🎈"];

export default function GroupsPage() {
  const { groups, ready, error: loadError, refresh, create, join, leave, kick, destroy } =
    useGroups();
  const { profile } = useProfile();
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    setError("");
    try {
      await create(name.trim(), emoji);
      setName("");
      setMode("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gruppe konnte nicht erstellt werden.");
    }
  }

  async function handleJoin() {
    setError("");
    try {
      const g = await join(code);
      if (!g) {
        setError("Code nicht gefunden");
        return;
      }
      setCode("");
      setMode("none");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beitritt fehlgeschlagen.");
    }
  }

  return (
    <AppShell>
      <TopBar title="Freunde" subtitle="Deine Crews" />

      <div className="px-5 space-y-3">
        {!ready && (
          <>
            <CardSkeleton lines={1} className="h-[92px]" />
            <CardSkeleton lines={1} className="h-[92px]" />
          </>
        )}

        {ready && loadError && (
          <Card className="text-center py-6">
            <p className="text-sm font-semibold">Gruppen konnten nicht geladen werden</p>
            <p className="text-muted text-xs mt-1 break-words">{loadError}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => refresh()}>
              Erneut versuchen
            </Button>
          </Card>
        )}

        {ready &&
          !loadError &&
          groups.map((g, i) => (
            <GroupCard
              key={g.id}
              group={g}
              index={i}
              currentUserId={profile?.id ?? null}
              onLeave={() => leave(g.id)}
              onKick={(userId) => kick(g.id, userId)}
              onDelete={() => destroy(g.id)}
            />
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

function GroupCard({
  group,
  index,
  currentUserId,
  onLeave,
  onKick,
  onDelete,
}: {
  group: Group;
  index: number;
  currentUserId: string | null;
  onLeave: () => Promise<void>;
  onKick: (userId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const { highlight } = useNextHighlight(group.id);

  const refreshMembers = useCallback(async () => {
    const m = await listGroupMembers(group.id);
    setMembers(m);
  }, [group.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await listGroupMembers(group.id);
      if (!cancelled) setMembers(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  // Zusätzliches, kartenlokales Realtime-Abo: die Mitgliederliste dieser
  // einen Karte hängt an group.id (nicht an der Gruppen-Objektidentität),
  // ohne dieses Abo würde ein Beitritt/Kick eines ANDEREN Mitglieds hier
  // nicht sichtbar, obwohl die Gruppenliste selbst (useGroups) schon
  // aktualisiert.
  useEffect(() => {
    const unsubscribe = subscribeToGroups(() => {
      refreshMembers();
    });
    return unsubscribe;
  }, [refreshMembers]);

  const days = highlight ? daysUntil(highlight.date.toISOString()) : null;
  const isOwner = currentUserId != null && group.ownerId === currentUserId;

  async function handleLeave() {
    if (!window.confirm(`"${group.name}" wirklich verlassen?`)) return;
    setBusy(true);
    setActionError("");
    try {
      await onLeave();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Verlassen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `"${group.name}" wirklich komplett löschen? Das entfernt die Gruppe für alle Mitglieder inklusive aller Events und Fortschritte.`
      )
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      await onDelete();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleKick(member: Profile) {
    if (!window.confirm(`${member.name} wirklich aus der Gruppe entfernen?`)) return;
    setBusy(true);
    setActionError("");
    try {
      await onKick(member.id);
      await refreshMembers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Entfernen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "var(--gradient-accent)" }}
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
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted text-xs font-semibold mt-3 flex items-center gap-1"
        >
          {expanded ? "Verwalten schließen" : "Verwalten"}
          <span className={`transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-white/8 space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <Avatar emoji={m.avatarEmoji} size="sm" />
                    <span className="text-sm flex-1 min-w-0 truncate">
                      {m.name}
                      {m.id === group.ownerId && (
                        <span className="text-muted text-[11px] ml-1.5">Ersteller</span>
                      )}
                    </span>
                    {isOwner && m.id !== group.ownerId && (
                      <button
                        disabled={busy}
                        onClick={() => handleKick(m)}
                        className="text-[#FF453A] text-xs font-semibold disabled:opacity-40"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                ))}

                {actionError && (
                  <p className="text-[#FF453A] text-xs">{actionError}</p>
                )}

                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  disabled={busy}
                  className="mt-2"
                  onClick={isOwner ? handleDelete : handleLeave}
                >
                  {busy
                    ? "Wird ausgeführt…"
                    : isOwner
                      ? "🗑 Gruppe löschen"
                      : "🚪 Gruppe verlassen"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
