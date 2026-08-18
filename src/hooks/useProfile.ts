"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentProfile, createOrUpdateProfile, isOnboarded } from "@/lib/data-layer";
import { Profile } from "@/types";

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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, o] = await Promise.all([getCurrentProfile(), isOnboarded()]);
      if (cancelled) return;
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
    setProfile(updated);
    setOnboarded(true);
    return updated;
  }, []);

  return { profile, onboarded, ready, updateProfile };
}
