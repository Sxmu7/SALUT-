"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listGroups,
  listGroupMembers,
  createGroup,
  joinGroupByCode,
} from "@/lib/data-layer";
import { Group, Profile } from "@/types";

/** Alle Gruppen/Crews des aktuellen Nutzers ("Freunde"-Tab). */
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setGroups(await listGroups());
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

  return { groups, ready, refresh, create, join };
}

/** Die primäre (erste) Gruppe des Nutzers samt Mitgliedern – für Dashboard & Co. */
export function usePrimaryGroup() {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const groups = await listGroups();
    const g = groups[0] ?? null;
    setGroup(g);
    setMembers(g ? await listGroupMembers(g.id) : []);
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

  return { group, members, ready, refresh };
}
