"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

let cachedClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Liefert den Supabase Browser-Client. Nur aufrufen, wenn
 * isSupabaseConfigured() true zurückgibt – sonst läuft die App im
 * lokalen Demo-Modus (siehe lib/db.ts).
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase ist nicht konfiguriert. NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY setzen."
    );
  }
  if (!cachedClient) {
    cachedClient = createBrowserClient(supabaseUrl as string, supabaseAnonKey as string);
  }
  return cachedClient;
}
