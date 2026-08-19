"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentProfile, createOrUpdateProfile, isOnboarded } from "@/lib/data-layer";
import { LS_KEYS, writeLS } from "@/lib/storage";
import { Profile } from "@/types";

/** Siehe Kommentar in useProfile() weiter unten: repariert das separate
 * "onboarded"-Geräte-Flag, falls es trotz vorhandenem Profil fehlt. */
function writeOnboardedFlag() {
  writeLS(LS_KEYS.onboarded, true);
}

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
      const [p, oFlag] = await Promise.all([getCurrentProfile(), isOnboarded()]);
      if (cancelled) return;

      // Selbstheilung gegen den "nach dem Backgrounden zurück im Intro"-Bug:
      // "onboarded" ist ein eigenes, rein lokales Geräte-Flag (siehe
      // isOnboarded() in lib/db.ts), getrennt vom eigentlichen Profil. Auf
      // iOS wird eine im Hintergrund liegende Web-App/PWA vom System
      // gelegentlich komplett neu geladen (kein "Resume" wie bei nativen
      // Apps) - kommt genau in diesem Moment/durch ein Storage-Timing-
      // Problem das Flag als "false" zurück, obwohl längst ein echtes
      // Profil existiert, hat das bisher fälschlich zurück zu /onboarding
      // geschickt (siehe dashboard/page.tsx) - gefühlt ein Endlosloop, weil
      // es bei jedem Zurückkehren aus dem Hintergrund erneut passieren
      // konnte. Ein existierendes Profil ist der zuverlässigere Beweis
      // "diese Person hat sich schon eingerichtet" – das Flag wird dann
      // gleich mit repariert, statt bei jedem Reload erneut zu stolpern.
      const o = oFlag || Boolean(p);
      if (p && !oFlag) {
        writeOnboardedFlag();
      }

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
