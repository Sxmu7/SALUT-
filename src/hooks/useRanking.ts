"use client";

import { useEffect, useState } from "react";
import { computeRanking, getNextHighlight } from "@/lib/data-layer";
import { RankingEntry } from "@/types";

// Gleicher Cache-Trick wie in useProfile.ts/useGroups.ts, hier zusätzlich
// pro Gruppen-ID (ein Nutzer kann mehrere Gruppen haben) – verhindert,
// dass Rang/Punkte auf dem Dashboard bei jedem Revisit erst kurz auf
// "0"/"–" zurückspringen, bevor die Werte nachgeladen sind.
const rankingCache = new Map<string, RankingEntry[]>();
const highlightCache = new Map<string, NextHighlight>();

export function useRanking(groupId?: string | null) {
  const [ranking, setRanking] = useState<RankingEntry[]>(
    groupId ? rankingCache.get(groupId) ?? [] : []
  );
  const [ready, setReady] = useState(Boolean(groupId && rankingCache.has(groupId)));

  useEffect(() => {
    let cancelled = false;
    if (!groupId) {
      setRanking([]);
      setReady(true);
      return;
    }
    const cached = rankingCache.get(groupId);
    if (cached) {
      setRanking(cached);
      setReady(true);
    } else {
      setReady(false);
    }
    (async () => {
      const r = await computeRanking(groupId);
      if (!cancelled) {
        rankingCache.set(groupId, r);
        setRanking(r);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return { ranking, ready };
}

export type NextHighlight = Awaited<ReturnType<typeof getNextHighlight>>;

export function useNextHighlight(groupId?: string | null) {
  const [highlight, setHighlight] = useState<NextHighlight>(
    groupId ? highlightCache.get(groupId) ?? null : null
  );
  const [ready, setReady] = useState(Boolean(groupId && highlightCache.has(groupId)));

  useEffect(() => {
    let cancelled = false;
    if (!groupId) {
      setHighlight(null);
      setReady(true);
      return;
    }
    const cached = highlightCache.get(groupId);
    if (cached !== undefined) {
      setHighlight(cached);
      setReady(true);
    } else {
      setReady(false);
    }
    (async () => {
      const h = await getNextHighlight(groupId);
      if (!cancelled) {
        highlightCache.set(groupId, h);
        setHighlight(h);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return { highlight, ready };
}
