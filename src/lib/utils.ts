import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function randomInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

// WICHTIG: `new Date("YYYY-MM-DD")` (reines Datum ohne Uhrzeit) wird laut
// JS-Spezifikation als UTC-Mitternacht geparst – alle Getter hier
// (getMonth/getDate/getFullYear) lesen das Ergebnis aber in der LOKALEN
// Zeitzone. Das führt je nach Zeitzone zu einer Verschiebung um einen Tag
// (z.B. Geburtstag "17.08." wird für Nutzer westlich von UTC als "16.08."
// angezeigt/berechnet). Für reine Datums-Strings (wie sie das
// Geburtstags-Feld liefert) wird deshalb hier manuell Jahr/Monat/Tag
// zerlegt und über den LOKALEN Date-Konstruktor gebaut – der ist
// zeitzonen-eindeutig. Volle ISO-Zeitstempel (mit Uhrzeit/Z, z.B.
// event_date) sind davon nicht betroffen und laufen unverändert über
// new Date().
export function parseLocalDate(dateISO: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateISO);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(dateISO);
}

export function daysUntil(dateISO: string): number {
  const now = new Date();
  const target = parseLocalDate(dateISO);
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  );
  const diff = startOfTarget.getTime() - startOfNow.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/** Nächstes Datum, an dem der Geburtstag (MM-DD) auftritt, ab heute. */
export function nextBirthdayDate(birthdayISO: string): Date {
  const bday = parseLocalDate(birthdayISO);
  const now = new Date();
  let next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next.getTime() < today0.getTime()) {
    next = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
  }
  return next;
}

export function ageOnNextBirthday(birthdayISO: string): number {
  const bday = parseLocalDate(birthdayISO);
  const next = nextBirthdayDate(birthdayISO);
  return next.getFullYear() - bday.getFullYear();
}

export function isTodayBirthday(birthdayISO: string): boolean {
  const bday = parseLocalDate(birthdayISO);
  const now = new Date();
  return bday.getMonth() === now.getMonth() && bday.getDate() === now.getDate();
}

export function formatDate(dateISO: string): string {
  return parseLocalDate(dateISO).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateISO: string): string {
  return parseLocalDate(dateISO).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

export const AVATAR_EMOJIS = [
  "🦊", "🐼", "🐸", "🐵", "🦁", "🐯", "🐨", "🐺",
  "🦄", "🐙", "🦉", "🐧", "🐢", "🦋", "🐝", "🦩",
];
