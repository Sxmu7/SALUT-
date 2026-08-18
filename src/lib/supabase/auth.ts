"use client";

import { getSupabaseClient } from "./client";

let userIdPromise: Promise<string> | null = null;

/**
 * Stellt sicher, dass eine Supabase-Session existiert, und gibt die
 * User-ID zurück. Salut! ist eine Party-App ohne Login-Zwang – dafür
 * nutzen wir Supabase Anonymous Sign-in. Das muss im Projekt aktiviert
 * sein (Authentication → Providers → Anonymous Sign-Ins), siehe DEPLOY.md.
 *
 * Das Ergebnis wird pro Browser-Tab gecacht (ein In-Flight-Promise), damit
 * parallele Aufrufe beim ersten Laden nicht mehrfach signInAnonymously()
 * auslösen.
 */
export function ensureSupabaseUser(): Promise<string> {
  if (!userIdPromise) {
    userIdPromise = resolveUser().catch((err) => {
      // Bei Fehlschlag den Cache zurücksetzen, damit ein späterer Retry
      // (z.B. nach Netzwerkfehler) es erneut versucht statt für immer zu
      // hängen.
      userIdPromise = null;
      throw err;
    });
  }
  return userIdPromise;
}

async function resolveUser(): Promise<string> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      "Anonyme Anmeldung bei Supabase fehlgeschlagen. Ist 'Anonymous Sign-ins' im Supabase-Projekt aktiviert? " +
        (error?.message ?? "")
    );
  }
  return data.user.id;
}
