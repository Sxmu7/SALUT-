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

export function daysUntil(dateISO: string): number {
  const now = new Date();
  const target = new Date(dateISO);
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
  const bday = new Date(birthdayISO);
  const now = new Date();
  let next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next.getTime() < today0.getTime()) {
    next = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
  }
  return next;
}

export function ageOnNextBirthday(birthdayISO: string): number {
  const bday = new Date(birthdayISO);
  const next = nextBirthdayDate(birthdayISO);
  return next.getFullYear() - bday.getFullYear();
}

export function isTodayBirthday(birthdayISO: string): boolean {
  const bday = new Date(birthdayISO);
  const now = new Date();
  return bday.getMonth() === now.getMonth() && bday.getDate() === now.getDate();
}

export function formatDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

export const AVATAR_EMOJIS = [
  "🦊", "🐼", "🐸", "🐵", "🦁", "🐯", "🐨", "🐺",
  "🦄", "🐙", "🦉", "🐧", "🐢", "🦋", "🐝", "🦩",
];
