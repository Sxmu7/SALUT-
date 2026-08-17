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
