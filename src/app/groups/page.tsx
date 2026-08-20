"use client";

import { Suspense, useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { CoworkerLogoMark } from "@/components/brand/CoworkerLogo";
import { useGroups } from "@/hooks/useGroups";
import { useCoworkerGroups } from "@/hooks/useCoworkerGroups";
import { useNextHighlight } from "@/hooks/useRanking";
import { useProfile } from "@/hooks/useProfile";
import {
  listGroupMembers,
  subscribeToGroups,
  listCoworkerGroupMembers,
  subscribeToCoworkerGroups,
  getOrCreateCoworkerEvent,
  isRemoteMode,
} from "@/lib/data-layer";
import { LS_KEYS, readLS } from "@/lib/storage";
import { daysUntil } from "@/lib/utils";
import { Group, CoworkerGroup, Profile } from "@/types";

const GROUP_EMOJIS = ["🎉", "🍻", "🥂", "🎊", "🔥", "🎈"];
const COWORKER_EMOJIS = ["💼", "🏢", "📊", "☕", "💻", "🏦"];

type Tab = "party" | "coworker";

// "Gruppen neu überarbeitet": statt zwei getrennter Verwaltungsseiten
// (/groups für Trinkspiel, /coworker für Kollegen-Teams) gibt es jetzt
// EINEN "Freunde"-Bildschirm mit Umschalter zwischen beiden Mitglieder-
// kreisen – konsistenter mit dem Rest der App und weniger Navigations-
// Ebenen. useSearchParams() erfordert eine Suspense-Grenze (Next.js
// Build-Regel), deshalb der dünne Wrapper unten.
export default function GroupsPage() {
  return (
    <Suspense fallback={<AppShell><TopBar title="Freunde" /></AppShell>}>
      <GroupsPageInner />
    </Suspense>
  );
}

function GroupsPageInner() {
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "coworker" ? "coworker" : "party";
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <AppShell>
      <TopBar title="Freunde" subtitle={tab === "party" ? "Deine Crews" : "Deine Teams"} />

      <div className="px-5 mb-4">
        <div className="card-surface rounded-2xl p-1 flex items-center relative">
          {(["party", "coworker"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative flex-1 py-2.5 rounded-xl text-sm font-semibold text-center"
            >
              {tab === t && (
                <motion.div
                  layoutId="groups-tab-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background:
                      t === "party" ? "var(--gradient-accent)" : "linear-gradient(135deg, #ff2d55 0%, #de002e 100%)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative text-white/95">
                {t === "party" ? "🍻 Trinkspiel" : "💼 Kollegen"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tab === "party" ? <PartyGroupsSection /> : <CoworkerGroupsSection />}
    </AppShell>
  );
}

// ==================== Trinkspiel-Gruppen ====================

function PartyGroupsSection() {
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

// ==================== Kollegen-Teams ====================
// Eigene Designsprache (Sparkassen-Rot) bleibt erhalten, auch innerhalb des
// gemeinsamen "Freunde"-Bildschirms – nur dieser Abschnitt wird lokal in
// .theme-coworker gewrappt, statt die ganze Seite umzufärben.

function CoworkerGroupsSection() {
  const [theme] = useState<"dark" | "light">(() => readLS(LS_KEYS.coworkerTheme, "dark"));

  if (!isRemoteMode()) {
    return (
      <div className="px-5">
        <Card className="text-center py-10">
          <span className="text-4xl">🔒</span>
          <p className="font-display font-bold text-lg mt-3">
            Nur mit Supabase-Konto verfügbar
          </p>
          <p className="text-muted text-sm mt-2 max-w-[280px] mx-auto">
            Kollegen-Teams brauchen ein echtes Supabase-Projekt. Im lokalen
            Demo-Modus steht nur das Trinkspiel zur Verfügung.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`theme-coworker ${theme}`} style={{ background: "var(--background)" }}>
      <div className="px-5 pt-1 mb-4 flex items-center gap-3">
        <CoworkerLogoMark size={40} />
        <p className="text-muted text-xs leading-snug flex-1">
          Eigener Einladungscode, eigener Challenge-Katalog – komplett
          getrennt von deinen Trinkspiel-Crews.
        </p>
      </div>
      <CoworkerGroupsList />
    </div>
  );
}

function CoworkerGroupsList() {
  const { groups, ready, error, refresh, create, join, leave, kick, destroy } =
    useCoworkerGroups();
  const { profile } = useProfile();
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(COWORKER_EMOJIS[0]);
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
      setFormError(err instanceof Error ? err.message : "Team konnte nicht erstellt werden.");
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
    <div className="px-5 pb-6 space-y-3">
      {!ready && (
        <>
          <CardSkeleton lines={1} className="h-[92px]" />
          <CardSkeleton lines={1} className="h-[92px]" />
        </>
      )}

      {ready && error && (
        <Card className="text-center py-6">
          <p className="text-sm font-semibold">Kollegen-Teams konnten nicht geladen werden</p>
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
            Erstelle ein Kollegen-Team oder tritt per Code bei.
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
            {COWORKER_EMOJIS.map((e) => (
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
