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
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // listGroups() wirft jetzt bei einem echten Fehler statt still []
    // zurückzugeben (siehe queries.ts) – ohne dieses catch würde "ready"
    // nie true werden und die Seite für immer im Skeleton hängen bleiben,
    // wie schon bei den anderen "stuck forever"-Bugs in dieser Session.
    try {
      setGroups(await listGroups());
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

  return { groups, ready, error, refresh, create, join };
}

/** Die primäre (erste) Gruppe des Nutzers samt Mitgliedern – für Dashboard & Co. */
export function usePrimaryGroup() {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Gleiches Prinzip wie in useGroups(): ohne dieses catch würde ein
    // Fehler beim Laden für immer im Skeleton hängen bleiben UND
    // ununterscheidbar von "Nutzer hat wirklich keine Gruppe" aussehen.
    try {
      const groups = await listGroups();
      const g = groups[0] ?? null;
      setGroup(g);
      setMembers(g ? await listGroupMembers(g.id) : []);
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

  return { group, members, ready, error, refresh };
}
