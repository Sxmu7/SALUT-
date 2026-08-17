"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentProfile, createOrUpdateProfile, isOnboarded } from "@/lib/db";
import { Profile } from "@/types";

/**
 * Zentraler Zugriff auf das eigene Profil.
 *
 * Liest bewusst NUR innerhalb von useEffect aus localStorage – ein direkter
 * Aufruf im Render-Body würde auf dem Server (kein window vorhanden) einen
 * anderen Wert liefern als beim Hydrieren im Client und zu einem Hydration-
 * Mismatch führen. `ready` wird erst nach dem ersten Client-Render true,
 * Components können darauf einen Ladezustand zeigen.
 */
export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(getCurrentProfile());
    setOnboarded(isOnboarded());
    setReady(true);
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    const updated = createOrUpdateProfile(patch);
    setProfile(updated);
    setOnboarded(true);
    return updated;
  }, []);

  return { profile, onboarded, ready, updateProfile };
}
