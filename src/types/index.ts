export type ProofType = "photo" | "video" | "none";

export type Difficulty = "easy" | "medium" | "hard" | "legendary";

export type CategoryId =
  | "klassiker"
  | "performance"
  | "wissen"
  | "mut"
  | "team"
  | "kreativ";

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  gradient: string;
  description: string;
}

export interface Challenge {
  id: string;
  categoryId: CategoryId;
  title: string;
  description: string;
  points: number;
  difficulty: Difficulty;
  proofType: ProofType;
  icon: string;
  animation: "flip" | "bounce" | "shake" | "pulse" | "slide" | "glow" | "pop";
  isCustom?: boolean;
  isBirthdayExclusive?: boolean;
  source?: "fixed" | "manual" | "ai";
}

export interface Profile {
  id: string;
  name: string;
  avatarEmoji: string;
  birthday: string | null; // YYYY-MM-DD
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
}

export type EventType = "birthday" | "custom" | "party";
export type EventStatus = "upcoming" | "live" | "finished";

export interface GameEvent {
  id: string;
  groupId: string;
  title: string;
  type: EventType;
  emoji: string;
  eventDate: string; // ISO date
  birthdayUserId?: string;
  status: EventStatus;
  challengeIds: string[];
  createdAt: string;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  eventId: string;
  challengeId: string;
  userId: string;
  proofType: ProofType;
  proofDataUrl?: string;
  note?: string;
  status: SubmissionStatus;
  pointsAwarded: number;
  votes: Vote[];
  createdAt: string;
}

export interface Vote {
  voterId: string;
  approve: boolean;
  createdAt: string;
}

export interface RankingEntry {
  userId: string;
  name: string;
  avatarEmoji: string;
  points: number;
  rank: number;
  previousRank: number;
  challengesCompleted: number;
  trend: "up" | "down" | "same" | "new";
}

/**
 * Automatischer Push-Modus für eine Party (Event mit type="party").
 * Nur im Supabase-Modus verfügbar – siehe lib/push.ts und
 * supabase/functions/party-push-tick.
 */
export interface PartyPushState {
  eventId: string;
  pushEnabled: boolean;
  intervalMinutes: number;
  randomPick: boolean;
  noDuplicates: boolean;
  cycle: number;
  nextPushAt: string | null;
}

/**
 * Party-Bingo (Event mit type="party"). Nur im Supabase-Modus verfügbar –
 * die Gewinner-Ermittlung/Kartenerzeugung läuft serverseitig (siehe
 * supabase/schema.sql, Abschnitt "Party-Bingo").
 */
export type BingoWinCondition = "one_line" | "two_lines" | "full_card";

export interface PartyBingoConfig {
  id: string;
  eventId: string;
  status: "active" | "finished";
  gridSize: number;
  freeCenter: boolean;
  winCondition: BingoWinCondition;
  requireConfirmations: number;
  winnerUserId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Ein Ereignis aus dem Bingo-Katalog dieser Runde – global pro Party,
 * nicht pro Spieler. */
export interface BingoEventItem {
  id: string;
  text: string;
  icon: string;
  isTriggered: boolean;
}

/** Eine Zelle der EIGENEN Bingo-Karte, angereichert mit dem verknüpften
 * Ereignis (oder null bei der freien Mittelzelle). */
export interface BingoCardCell {
  position: number;
  isFree: boolean;
  eventId: string | null;
  text: string | null;
  icon: string | null;
  isTriggered: boolean;
}

/** Fortschritt eines Mitspielers – bleibt dank RLS automatisch leer,
 * solange die Runde aktiv ist (siehe schema.sql), erst nach Abschluss für
 * den Reveal-Moment befüllt. */
export interface BingoPlayerProgress {
  userId: string;
  name: string;
  avatarEmoji: string;
  completedCount: number;
  totalCount: number;
  isWinner: boolean;
}

export interface BingoSnapshot {
  bingo: PartyBingoConfig;
  events: BingoEventItem[];
  myCard: BingoCardCell[];
  playersProgress: BingoPlayerProgress[];
}
