"use client";

import { useEffect, useState } from "react";
import { computeRanking, getNextHighlight } from "@/lib/db";
import { RankingEntry } from "@/types";

export function useRanking(groupId?: string | null) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!groupId) {
      setRanking([]);
      setReady(true);
      return;
    }
    setRanking(computeRanking(groupId));
    setReady(true);
  }, [groupId]);

  return { ranking, ready };
}

export type NextHighlight = ReturnType<typeof getNextHighlight>;

export function useNextHighlight(groupId?: string | null) {
  const [highlight, setHighlight] = useState<NextHighlight>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!groupId) {
      setHighlight(null);
      setReady(true);
      return;
    }
    setHighlight(getNextHighlight(groupId));
    setReady(true);
  }, [groupId]);

  return { highlight, ready };
}
