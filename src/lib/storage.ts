// Kleiner, typsicherer Wrapper um localStorage. Läuft nur im Browser.
export function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLS<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export const LS_KEYS = {
  profile: "salut:profile",
  profiles: "salut:profiles",
  groups: "salut:groups",
  events: "salut:events",
  submissions: "salut:submissions",
  customChallenges: "salut:customChallenges",
  onboarded: "salut:onboarded",
  /** Dark/Light für den Kollegen-Modus – rein optisch, unabhängig vom Rest
   * der App (die aktuell nur Dark kennt), siehe app/coworker/layout.tsx. */
  coworkerTheme: "salut:coworkerTheme",
} as const;
