"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentProfile, createOrUpdateProfile, isOnboarded } from "@/lib/data-layer";
import { Profile } from "@/types";

// Modul-weiter Cache (lebt außerhalb der Komponente, also über
// Mount/Unmount hinweg für die Dauer des Browser-Tabs). Ohne das zeigt
// JEDE Rückkehr zum Dashboard/Profil erneut das volle Lade-Skeleton, auch
// wenn das Profil vor Sekunden schon geladen wurde – bei Next.js' App
// Router wird die Seiten-Komponente bei jeder Navigation neu gemountet und
// der bisherige useState(null)-Startwert vergisst den letzten Stand
// komplett. Mit dem Cache zeigt ein erneuter Besuch sofort die zuletzt
// bekannten Daten (kein Skeleton-Flackern) und aktualisiert im Hintergrund
// still, statt den Nutzer jedes Mal warten zu lassen ("stale-while-
// revalidate").
let cachedProfile: Profile | null = null;
let cachedOnboarded = false;
let hasLoadedOnce = false;

/**
 * Zentraler Zugriff auf das eigene Profil.
 *
 * Liest bewusst NUR innerhalb von useEffect – ein direkter Aufruf im
 * Render-Body würde auf dem Server (kein window vorhanden) einen anderen
 * Wert liefern als beim Hydrieren im Client und zu einem Hydration-Mismatch
 * führen. `ready` wird erst nach dem ersten Client-Render true, Components
 * können darauf einen Ladezustand zeigen.
 *
 * lib/data-layer entscheidet selbst, ob lokal (localStorage) oder gegen
 * Supabase gelesen wird – dieser Hook kennt den Unterschied nicht.
 */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(cachedProfile);
  const [onboarded, setOnboarded] = useState(cachedOnboarded);
  const [ready, setReady] = useState(hasLoadedOnce);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, o] = await Promise.all([getCurrentProfile(), isOnboarded()]);
      if (cancelled) return;
      cachedProfile = p;
      cachedOnboarded = o;
      hasLoadedOnce = true;
      setProfile(p);
      setOnboarded(o);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const updated = await createOrUpdateProfile(patch);
    cachedProfile = updated;
    cachedOnboarded = true;
    setProfile(updated);
    setOnboarded(true);
    return updated;
  }, []);

  return { profile, onboarded, ready, updateProfile };
}
