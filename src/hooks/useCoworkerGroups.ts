"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCoworkerGroups,
  createCoworkerGroup,
  joinCoworkerGroupByCode,
  leaveCoworkerGroup,
  kickCoworkerGroupMember,
  deleteCoworkerGroup,
  subscribeToCoworkerGroups,
} from "@/lib/data-layer";
import { CoworkerGroup } from "@/types";

// Gleicher Modul-Cache-Trick wie in useGroups.ts – siehe dortigen Kommentar.
let cachedCoworkerGroups: CoworkerGroup[] = [];
let hasLoadedCoworkerGroupsOnce = false;

/** Alle Kollegen-Gruppen des aktuellen Nutzers – "komplett getrennt" von
 * den Trinkspiel-Gruppen (siehe useGroups()), 1:1 dasselbe Muster. */
export function useCoworkerGroups() {
  const [groups, setGroups] = useState<CoworkerGroup[]>(cachedCoworkerGroups);
  const [ready, setReady] = useState(hasLoadedCoworkerGroupsOnce);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const g = await listCoworkerGroups();
      cachedCoworkerGroups = g;
      hasLoadedCoworkerGroupsOnce = true;
      setGroups(g);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kollegen-Gruppen konnten nicht geladen werden."
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
    const unsubscribe = subscribeToCoworkerGroups(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  const create = useCallback(
    async (name: string, emoji: string) => {
      const g = await createCoworkerGroup(name, emoji);
      await refresh();
      return g;
    },
    [refresh]
  );

  const join = useCallback(
    async (code: string) => {
      const g = await joinCoworkerGroupByCode(code);
      if (g) await refresh();
      return g;
    },
    [refresh]
  );

  const leave = useCallback(
    async (groupId: string) => {
      await leaveCoworkerGroup(groupId);
      await refresh();
    },
    [refresh]
  );

  const kick = useCallback(
    async (groupId: string, userId: string) => {
      await kickCoworkerGroupMember(groupId, userId);
      await refresh();
    },
    [refresh]
  );

  const destroy = useCallback(
    async (groupId: string) => {
      await deleteCoworkerGroup(groupId);
      await refresh();
    },
    [refresh]
  );

  return { groups, ready, error, refresh, create, join, leave, kick, destroy };
}
