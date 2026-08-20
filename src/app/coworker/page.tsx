"use client";

import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { CoworkerLogoMark } from "@/components/brand/CoworkerLogo";
import { useCoworkerGroups } from "@/hooks/useCoworkerGroups";
import { useProfile } from "@/hooks/useProfile";
import { useCoworkerTheme } from "./layout";
import {
  listCoworkerGroupMembers,
  subscribeToCoworkerGroups,
  getOrCreateCoworkerEvent,
  isRemoteMode,
} from "@/lib/data-layer";
import { CoworkerGroup, Profile } from "@/types";

const GROUP_EMOJIS = ["💼", "🏢", "📊", "☕", "💻", "🏦"];

export default function CoworkerHomePage() {
  const { theme, toggle } = useCoworkerTheme();

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

  return (
    <AppShell>
      <TopBar
        title="💼 Kollegen-Modus"
        subtitle="Arbeitsalltag-Challenges mit deinem Team"
        right={
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-full flex items-center justify-center card-surface text-base"
            aria-label="Hell/Dunkel umschalten"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        }
      />
      <div className="px-5 mb-4 flex items-center gap-3">
        <CoworkerLogoMark size={44} />
        <p className="text-muted text-xs leading-snug flex-1">
          Alle 5 Minuten (Mo-Fr, 09-12:30 & 14-17 Uhr) kommt eine neue,
          alkoholfreie Challenge rein – wer zuerst annimmt, muss sie machen.
        </p>
      </div>
      <CoworkerGroupsList />
    </AppShell>
  );
}

function CoworkerGroupsList() {
  const { groups, ready, error, refresh, create, join, leave, kick, destroy } =
    useCoworkerGroups();
  const { profile } = useProfile();
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setFormError("");
    try {
      await create(name.trim(), emoji);
      setName("");
      setMode("none");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gruppe konnte nicht erstellt werden.");
    }
  }

  async function handleJoin() {
    setFormError("");
    try {
      const g = await join(code);
      if (!g) {
        setFormError("Code nicht gefunden");
        return;
      }
      setCode("");
      setMode("none");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Beitritt fehlgeschlagen.");
    }
  }

  async function openFeed(group: CoworkerGroup) {
    setOpeningId(group.id);
    try {
      const event = await getOrCreateCoworkerEvent(group.id);
      router.push(`/coworker/events/${event.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Feed konnte nicht geöffnet werden.");
      setOpeningId(null);
    }
  }

  return (
    <div className="px-5 space-y-3">
      {!ready && (
        <>
          <CardSkeleton lines={1} className="h-[92px]" />
          <CardSkeleton lines={1} className="h-[92px]" />
        </>
      )}

      {ready && error && (
        <Card className="text-center py-6">
          <p className="text-sm font-semibold">Kollegen-Gruppen konnten nicht geladen werden</p>
          <p className="text-muted text-xs mt-1 break-words">{error}</p>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => refresh()}>
            Erneut versuchen
          </Button>
        </Card>
      )}

      {ready && !error && groups.length === 0 && mode === "none" && (
        <Card className="text-center py-8">
          <span className="text-3xl">👥</span>
          <p className="font-semibold mt-2">Noch kein Team</p>
          <p className="text-muted text-xs mt-1">
            Erstelle eine Kollegen-Gruppe oder tritt per Code bei.
          </p>
        </Card>
      )}

      {ready &&
        !error &&
        groups.map((g, i) => (
          <CoworkerGroupCard
            key={g.id}
            group={g}
            index={i}
            currentUserId={profile?.id ?? null}
            opening={openingId === g.id}
            onOpen={() => openFeed(g)}
            onLeave={() => leave(g.id)}
            onKick={(userId) => kick(g.id, userId)}
            onDelete={() => destroy(g.id)}
          />
        ))}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button variant="secondary" onClick={() => setMode("create")}>
          + Neues Team
        </Button>
        <Button variant="secondary" onClick={() => setMode("join")}>
          Beitreten
        </Button>
      </div>

      {mode === "create" && (
        <Card>
          <p className="font-semibold mb-3">Neues Team</p>
          <div className="flex gap-2 mb-3">
            {GROUP_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center card-surface ${
                  emoji === e ? "ring-2 ring-[var(--accent)]" : ""
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team-Name"
            className="w-full card-surface rounded-xl px-4 py-3 mb-3"
          />
          {formError && <p className="text-[#FF453A] text-xs mb-2">{formError}</p>}
          <Button fullWidth onClick={handleCreate}>
            Erstellen
          </Button>
        </Card>
      )}

      {mode === "join" && (
        <Card>
          <p className="font-semibold mb-3">Team beitreten</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Einladungscode"
            className="w-full card-surface rounded-xl px-4 py-3 mb-2 font-mono tracking-widest"
          />
          {formError && <p className="text-[#FF453A] text-xs mb-2">{formError}</p>}
          <Button fullWidth onClick={handleJoin}>
            Beitreten
          </Button>
        </Card>
      )}
    </div>
  );
}

function CoworkerGroupCard({
  group,
  index,
  currentUserId,
  opening,
  onOpen,
  onLeave,
  onKick,
  onDelete,
}: {
  group: CoworkerGroup;
  index: number;
  currentUserId: string | null;
  opening: boolean;
  onOpen: () => void;
  onLeave: () => Promise<void>;
  onKick: (userId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const refreshMembers = useCallback(async () => {
    const m = await listCoworkerGroupMembers(group.id);
    setMembers(m);
  }, [group.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await listCoworkerGroupMembers(group.id);
      if (!cancelled) setMembers(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  useEffect(() => {
    const unsubscribe = subscribeToCoworkerGroups(() => {
      refreshMembers();
    });
    return unsubscribe;
  }, [refreshMembers]);

  const isOwner = currentUserId != null && group.ownerId === currentUserId;

  async function handleLeave(e: ReactMouseEvent) {
    e.stopPropagation();
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

  async function handleDelete(e: ReactMouseEvent) {
    e.stopPropagation();
    if (
      !window.confirm(
        `"${group.name}" wirklich komplett löschen? Das entfernt das Team für alle Mitglieder inklusive aller Challenges und Fortschritte.`
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

  async function handleKick(member: Profile, e: ReactMouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`${member.name} wirklich aus dem Team entfernen?`)) return;
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
        <button className="w-full text-left" onClick={onOpen} disabled={opening}>
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
                <span className="text-muted text-xs ml-3">{members.length} Kolleg:innen</span>
              </div>
              <p className="text-muted text-[11px] mt-1">
                Code: <span className="font-mono font-semibold text-foreground">{group.inviteCode}</span>
              </p>
            </div>
            <span className="text-muted text-lg shrink-0">{opening ? "…" : "→"}</span>
          </div>
        </button>

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
                        onClick={(e) => handleKick(m, e)}
                        className="text-[#FF453A] text-xs font-semibold disabled:opacity-40"
                      >
                        Entfernen
                      </button>
                    )}
                  </div>
                ))}

                {actionError && <p className="text-[#FF453A] text-xs">{actionError}</p>}

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
                      ? "🗑 Team löschen"
                      : "🚪 Team verlassen"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
