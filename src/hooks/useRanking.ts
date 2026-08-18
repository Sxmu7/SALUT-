"use client";

import { useEffect, useState } from "react";
import { computeRanking, getNextHighlight } from "@/lib/data-layer";
import { RankingEntry } from "@/types";

export function useRanking(groupId?: string | null) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!groupId) {
      setRanking([]);
      setReady(true);
      return;
    }
    setReady(false);
    (async () => {
      const r = await computeRanking(groupId);
      if (!cancelled) {
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
  const [highlight, setHighlight] = useState<NextHighlight>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!groupId) {
      setHighlight(null);
      setReady(true);
      return;
    }
    setReady(false);
    (async () => {
      const h = await getNextHighlight(groupId);
      if (!cancelled) {
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
