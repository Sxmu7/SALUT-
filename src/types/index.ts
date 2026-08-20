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

export type EventType = "birthday" | "custom" | "party" | "coworker";
export type EventStatus = "upcoming" | "live" | "finished";

export interface GameEvent {
  id: string;
  /** Nur bei Trinkspiel-Events gesetzt (type != "coworker"). Ein Event
   * gehört immer entweder zu einer Trinkspiel-Gruppe (groupId) ODER zu
   * einer Kollegen-Gruppe (coworkerGroupId), nie beides. */
  groupId: string | null;
  /** Nur bei Kollegen-Events gesetzt (type === "coworker"), siehe groupId. */
  coworkerGroupId: string | null;
  title: string;
  type: EventType;
  emoji: string;
  eventDate: string; // ISO date
  birthdayUserId?: string;
  status: EventStatus;
  challengeIds: string[];
  createdAt: string;
  /**
   * "Reihum-Modus": statt dass alle Mitspieler jede aufgedeckte Challenge
   * parallel machen können, ist immer nur EINE Person am Zug – unabhängig
   * davon, wer tatsächlich würfelt. Jederzeit im laufenden Event umschaltbar
   * (siehe TurnModePanel.tsx).
   */
  turnModeEnabled: boolean;
  /** Reihenfolge der Mitglieder-IDs für den Reihum-Modus. Wird beim ersten
   * Aktivieren aus den aktuellen Gruppenmitgliedern befüllt und bleibt dann
   * stabil, auch wenn der Modus zwischendurch ausgeschaltet wird. */
  turnOrder: string[];
  /** Index in turnOrder – wer gerade dran ist. Rückt erst weiter, wenn die
   * zugewiesene Challenge dieser Person genehmigt wurde. */
  turnIndex: number;
  /** challengeId -> userId: wem eine per Würfel aufgedeckte Challenge im
   * Reihum-Modus zugewiesen wurde (nur gesetzt, wenn turnModeEnabled zum
   * Zeitpunkt des Wurfs an war – sonst dürfen wie bisher alle mitmachen). */
  challengeAssignments: Record<string, string>;
  /** Optionales Ziel "Abend endet nach X Challenges" – null = kein Ziel. */
  targetChallengeCount: number | null;
  /** Gesetzt, sobald der Abend manuell oder automatisch (Ziel erreicht)
   * beendet wurde. */
  endedAt: string | null;
  /** Nur bei Kollegen-Events: wann die nächste automatische Challenge
   * verschickt wird (Mo-Fr 09:00-12:30 & 14:00-17:00, Europe/Berlin) – siehe
   * next_coworker_push_time() in schema.sql. Für die Countdown-Anzeige im
   * Kollegen-Feed. */
  coworkerNextPushAt: string | null;
}

/**
 * Kollegen-Gruppe (Co-Worker-Modus). Bewusst komplett getrennt von Group/
 * groups – Arbeitskolleg:innen sollen nicht automatisch in denselben
 * Gruppen wie Trinkspiel-Freunde landen (siehe schema.sql,
 * coworker_groups/coworker_group_members). Nur im Supabase-Modus
 * verfügbar.
 */
export interface CoworkerGroup {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
}

/**
 * Eine Challenge aus dem komplett separaten, alkoholfreien Arbeitsalltag-
 * Katalog (siehe schema.sql, coworker_challenges) – bewusst kein
 * categoryId wie bei Challenge, da es im Kollegen-Modus keine Kategorien
 * gibt.
 */
export interface CoworkerChallenge {
  id: string;
  title: string;
  description: string;
  points: number;
  difficulty: Difficulty;
  proofType: ProofType;
  icon: string;
  animation: Challenge["animation"];
  isCustom?: boolean;
  source?: "fixed" | "manual" | "ai";
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
