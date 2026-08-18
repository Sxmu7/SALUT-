"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listGroups,
  listGroupMembers,
  createGroup,
  joinGroupByCode,
  leaveGroup,
  kickGroupMember,
  deleteGroup,
  subscribeToGroups,
} from "@/lib/data-layer";
import { Group, Profile } from "@/types";

// Gleicher Modul-Cache-Trick wie in useProfile.ts: verhindert, dass jede
// Rückkehr zur "Freunde"-Seite oder zum Dashboard wieder bei null/[]
// startet und das Skeleton neu zeigt, obwohl die Daten Sekunden vorher
// schon geladen waren. Erster Ladevorgang pro Tab zeigt weiterhin normal
// das Skeleton; danach zeigen Revisits sofort den letzten Stand und
// aktualisieren still im Hintergrund.
let cachedGroups: Group[] = [];
let hasLoadedGroupsOnce = false;
let cachedPrimaryGroup: Group | null = null;
let cachedPrimaryMembers: Profile[] = [];
let hasLoadedPrimaryOnce = false;

/** Alle Gruppen/Crews des aktuellen Nutzers ("Freunde"-Tab). */
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>(cachedGroups);
  const [ready, setReady] = useState(hasLoadedGroupsOnce);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // listGroups() wirft jetzt bei einem echten Fehler statt still []
    // zurückzugeben (siehe queries.ts) – ohne dieses catch würde "ready"
    // nie true werden und die Seite für immer im Skeleton hängen bleiben,
    // wie schon bei den anderen "stuck forever"-Bugs in dieser Session.
    try {
      const g = await listGroups();
      cachedGroups = g;
      hasLoadedGroupsOnce = true;
      setGroups(g);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gruppen konnten nicht geladen werden."
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Live-Updates: tritt jemand bei, verlässt die Gruppe oder wird
  // entfernt, sehen alle Mitglieder das jetzt automatisch, ohne die App
  // neu laden zu müssen (siehe subscribeToGroups() in data-layer.ts).
  useEffect(() => {
    const unsubscribe = subscribeToGroups(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const create = useCallback(
    async (name: string, emoji: string) => {
      const g = await createGroup(name, emoji);
      await refresh();
      return g;
    },
    [refresh]
  );

  const join = useCallback(
    async (code: string) => {
      const g = await joinGroupByCode(code);
      if (g) await refresh();
      return g;
    },
    [refresh]
  );

  const leave = useCallback(
    async (groupId: string) => {
      await leaveGroup(groupId);
      await refresh();
    },
    [refresh]
  );

  const kick = useCallback(
    async (groupId: string, userId: string) => {
      await kickGroupMember(groupId, userId);
      await refresh();
    },
    [refresh]
  );

  const destroy = useCallback(
    async (groupId: string) => {
      await deleteGroup(groupId);
      await refresh();
    },
    [refresh]
  );

  return { groups, ready, error, refresh, create, join, leave, kick, destroy };
}

/** Die primäre (erste) Gruppe des Nutzers samt Mitgliedern – für Dashboard & Co. */
export function usePrimaryGroup() {
  const [group, setGroup] = useState<Group | null>(cachedPrimaryGroup);
  const [members, setMembers] = useState<Profile[]>(cachedPrimaryMembers);
  const [ready, setReady] = useState(hasLoadedPrimaryOnce);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Gleiches Prinzip wie in useGroups(): ohne dieses catch würde ein
    // Fehler beim Laden für immer im Skeleton hängen bleiben UND
    // ununterscheidbar von "Nutzer hat wirklich keine Gruppe" aussehen.
    try {
      const groups = await listGroups();
      const g = groups[0] ?? null;
      const m = g ? await listGroupMembers(g.id) : [];
      cachedPrimaryGroup = g;
      cachedPrimaryMembers = m;
      hasLoadedPrimaryOnce = true;
      setGroup(g);
      setMembers(m);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gruppe konnte nicht geladen werden."
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const unsubscribe = subscribeToGroups(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  return { group, members, ready, error, refresh };
}
