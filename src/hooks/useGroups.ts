"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listGroups,
  listGroupMembers,
  createGroup,
  joinGroupByCode,
} from "@/lib/db";
import { Group, Profile } from "@/types";

/** Alle Gruppen/Crews des aktuellen Nutzers ("Freunde"-Tab). */
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setGroups(listGroups());
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
  }, [refresh]);

  const create = useCallback(
    (name: string, emoji: string) => {
      const g = createGroup(name, emoji);
      refresh();
      return g;
    },
    [refresh]
  );

  const join = useCallback(
    (code: string) => {
      const g = joinGroupByCode(code);
      if (g) refresh();
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

  const refresh = useCallback(() => {
    const g = listGroups()[0] ?? null;
    setGroup(g);
    setMembers(g ? listGroupMembers(g.id) : []);
  }, []);

  useEffect(() => {
    refresh();
    setReady(true);
  }, [refresh]);

  return { group, members, ready, refresh };
}
