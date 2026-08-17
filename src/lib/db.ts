"use client";

import {
  Profile,
  Group,
  GameEvent,
  Submission,
  Challenge,
  CategoryId,
  RankingEntry,
} from "@/types";
import { CHALLENGES } from "@/lib/data/challenges";
import { LS_KEYS, readLS, writeLS } from "@/lib/storage";
import {
  uid,
  randomInviteCode,
  isTodayBirthday,
  AVATAR_EMOJIS,
} from "@/lib/utils";

/**
 * Datenschicht der App.
 *
 * Läuft standardmäßig im lokalen "Demo-Modus" (localStorage) – dadurch
 * funktioniert die App sofort nach dem Deploy, ganz ohne Backend-Setup.
 * Die Tabellenstruktur ist 1:1 auf supabase/schema.sql abgestimmt: Wer ein
 * echtes Supabase-Projekt verbindet (siehe README/SETUP.md), kann die
 * Funktionen hier Stück für Stück gegen echte Supabase-Queries tauschen,
 * ohne dass sich an den Aufrufstellen in den Components etwas ändert.
 */

// ---------- Demo-Mitspieler (füllen Gruppen & Ranking mit Leben) ----------
const DEMO_FRIENDS: Profile[] = [
  { id: "bot_mia", name: "Mia", avatarEmoji: "🦊", birthday: null, createdAt: new Date().toISOString() },
  { id: "bot_leon", name: "Leon", avatarEmoji: "🐼", birthday: null, createdAt: new Date().toISOString() },
  { id: "bot_nina", name: "Nina", avatarEmoji: "🦄", birthday: null, createdAt: new Date().toISOString() },
  { id: "bot_finn", name: "Finn", avatarEmoji: "🐯", birthday: null, createdAt: new Date().toISOString() },
];

function seedProfilesRegistry(): Record<string, Profile> {
  const existing = readLS<Record<string, Profile>>(LS_KEYS.profiles, {});
  if (Object.keys(existing).length > 0) return existing;
  const registry: Record<string, Profile> = {};
  DEMO_FRIENDS.forEach((p) => (registry[p.id] = p));
  writeLS(LS_KEYS.profiles, registry);
  return registry;
}

function getProfilesRegistry(): Record<string, Profile> {
  return readLS<Record<string, Profile>>(LS_KEYS.profiles, seedProfilesRegistry());
}

function saveProfileToRegistry(p: Profile) {
  const reg = getProfilesRegistry();
  reg[p.id] = p;
  writeLS(LS_KEYS.profiles, reg);
}

// ---------------------------- Profile ----------------------------

export function getCurrentProfile(): Profile | null {
  return readLS<Profile | null>(LS_KEYS.profile, null);
}

export function isOnboarded(): boolean {
  return readLS<boolean>(LS_KEYS.onboarded, false);
}

export function createOrUpdateProfile(patch: Partial<Profile>): Profile {
  const existing = getCurrentProfile();
  const profile: Profile = {
    id: existing?.id ?? uid("user"),
    name: patch.name ?? existing?.name ?? "Du",
    avatarEmoji:
      patch.avatarEmoji ??
      existing?.avatarEmoji ??
      AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)],
    birthday: patch.birthday !== undefined ? patch.birthday : existing?.birthday ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  writeLS(LS_KEYS.profile, profile);
  saveProfileToRegistry(profile);
  writeLS(LS_KEYS.onboarded, true);
  return profile;
}

export function getProfileById(id: string): Profile | null {
  if (id === getCurrentProfile()?.id) return getCurrentProfile();
  return getProfilesRegistry()[id] ?? null;
}

// ---------------------------- Gruppen ----------------------------

function seedDemoGroup(ownerId: string): Group {
  const group: Group = {
    id: uid("grp"),
    name: "Meine Crew",
    emoji: "🎉",
    inviteCode: randomInviteCode(),
    ownerId,
    memberIds: [ownerId, ...DEMO_FRIENDS.map((f) => f.id)],
    createdAt: new Date().toISOString(),
  };
  return group;
}

export function listGroups(): Group[] {
  const profile = getCurrentProfile();
  const groups = readLS<Group[]>(LS_KEYS.groups, []);
  if (groups.length === 0 && profile) {
    const seeded = [seedDemoGroup(profile.id)];
    writeLS(LS_KEYS.groups, seeded);
    return seeded;
  }
  return groups;
}

export function getGroup(id: string): Group | undefined {
  return listGroups().find((g) => g.id === id);
}

export function createGroup(name: string, emoji: string): Group {
  const profile = getCurrentProfile();
  if (!profile) throw new Error("Kein Profil vorhanden");
  const groups = listGroups();
  const group: Group = {
    id: uid("grp"),
    name,
    emoji,
    inviteCode: randomInviteCode(),
    ownerId: profile.id,
    memberIds: [profile.id],
    createdAt: new Date().toISOString(),
  };
  writeLS(LS_KEYS.groups, [...groups, group]);
  return group;
}

export function joinGroupByCode(code: string): Group | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  const groups = listGroups();
  const idx = groups.findIndex(
    (g) => g.inviteCode.toUpperCase() === code.trim().toUpperCase()
  );
  if (idx === -1) return null;
  if (!groups[idx].memberIds.includes(profile.id)) {
    groups[idx] = { ...groups[idx], memberIds: [...groups[idx].memberIds, profile.id] };
    writeLS(LS_KEYS.groups, groups);
  }
  return groups[idx];
}

export function listGroupMembers(groupId: string): Profile[] {
  const group = getGroup(groupId);
  if (!group) return [];
  return group.memberIds
    .map((id) => getProfileById(id))
    .filter((p): p is Profile => Boolean(p));
}

// ---------------------------- Challenges ----------------------------

export function listAllChallenges(): Challenge[] {
  const custom = readLS<Challenge[]>(LS_KEYS.customChallenges, []);
  return [...CHALLENGES, ...custom];
}

export function getAnyChallenge(id: string): Challenge | undefined {
  return listAllChallenges().find((c) => c.id === id);
}

export function addCustomChallenges(newOnes: Challenge[]): Challenge[] {
  const custom = readLS<Challenge[]>(LS_KEYS.customChallenges, []);
  const updated = [...custom, ...newOnes];
  writeLS(LS_KEYS.customChallenges, updated);
  return updated;
}

// ---------------------------- Events ----------------------------

export function listEvents(groupId: string): GameEvent[] {
  const all = readLS<GameEvent[]>(LS_KEYS.events, []);
  return all
    .filter((e) => e.groupId === groupId)
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
}

export function getEvent(id: string): GameEvent | undefined {
  const all = readLS<GameEvent[]>(LS_KEYS.events, []);
  return all.find((e) => e.id === id);
}

export function createEvent(input: {
  groupId: string;
  title: string;
  emoji: string;
  type: GameEvent["type"];
  eventDate: string;
  birthdayUserId?: string;
  challengeIds: string[];
}): GameEvent {
  const all = readLS<GameEvent[]>(LS_KEYS.events, []);
  const now = new Date();
  const status: GameEvent["status"] =
    new Date(input.eventDate).toDateString() === now.toDateString()
      ? "live"
      : new Date(input.eventDate) < now
      ? "finished"
      : "upcoming";
  const event: GameEvent = {
    id: uid("evt"),
    groupId: input.groupId,
    title: input.title,
    type: input.type,
    emoji: input.emoji,
    eventDate: input.eventDate,
    birthdayUserId: input.birthdayUserId,
    status,
    challengeIds: input.challengeIds,
    createdAt: new Date().toISOString(),
  };
  writeLS(LS_KEYS.events, [...all, event]);
  return event;
}

/**
 * Prüft für alle Gruppen des Nutzers, ob heute jemand Geburtstag hat, und
 * startet automatisch einen Abend (Event) dafür, falls noch keiner für
 * dieses Jahr existiert. Simuliert den täglichen Vercel-Cron-Job (siehe
 * src/app/api/cron/birthdays/route.ts) auch rein clientseitig, damit es im
 * Demo-Modus ohne Server-Cron sofort funktioniert.
 *
 * Die Challenges selbst werden bewusst NICHT vorab festgelegt – der Abend
 * startet leer und die Challenges kommen erst per Würfel (Party-Modus)
 * zum Vorschein. Weil das Event als "birthday" markiert ist, schaltet der
 * Würfel zusätzlich die exklusiven Geburtstags-Challenges frei.
 */
export function ensureBirthdayEvents(): GameEvent[] {
  const groups = listGroups();
  const created: GameEvent[] = [];
  const thisYear = new Date().getFullYear();

  for (const group of groups) {
    const members = listGroupMembers(group.id);
    for (const member of members) {
      if (!member.birthday || !isTodayBirthday(member.birthday)) continue;
      const existing = listEvents(group.id).find(
        (e) =>
          e.type === "birthday" &&
          e.birthdayUserId === member.id &&
          new Date(e.eventDate).getFullYear() === thisYear
      );
      if (existing) continue;
      const event = createEvent({
        groupId: group.id,
        title: `${member.name}s Geburtstags-Abend`,
        emoji: "🎂",
        type: "birthday",
        eventDate: new Date().toISOString(),
        birthdayUserId: member.id,
        challengeIds: [],
      });
      created.push(event);
    }
  }
  return created;
}

/**
 * Würfel-Logik ("Party-Modus"): wählt zufällig eine noch nicht gespielte
 * Challenge aus der per Würfelzahl vorgegebenen Kategorie. In Geburtstags-
 * Events sind zusätzlich die exklusiven Geburtstags-Challenges im Topf.
 * Ist die Kategorie leer gespielt, wird gruppenweit über alle Kategorien
 * hinweg ausgewichen, damit ein Abend nie "leer" endet.
 */
export function pickChallengeForEvent(
  eventId: string,
  categoryId: CategoryId
): Challenge | null {
  const event = getEvent(eventId);
  if (!event) return null;
  const played = new Set(listSubmissions(eventId).map((s) => s.challengeId));
  const isBirthday = event.type === "birthday";
  const eligible = (c: Challenge) =>
    !played.has(c.id) && (isBirthday || !c.isBirthdayExclusive);

  const inCategory = listAllChallenges().filter(
    (c) => c.categoryId === categoryId && eligible(c)
  );
  if (inCategory.length > 0) {
    return inCategory[Math.floor(Math.random() * inCategory.length)];
  }

  const anyLeft = listAllChallenges().filter(eligible);
  if (anyLeft.length === 0) return null;
  return anyLeft[Math.floor(Math.random() * anyLeft.length)];
}

/**
 * Findet das heutige "Spontane Runde"-Event einer Gruppe oder legt eins an.
 * Damit lassen sich Challenges auch außerhalb eines geplanten Events sofort
 * spielen (Katalog-Browsing → direkt loslegen).
 */
export function getOrCreateQuickEvent(groupId: string): GameEvent {
  const todayEvents = listEvents(groupId).filter(
    (e) => e.status !== "finished" && new Date(e.eventDate).toDateString() === new Date().toDateString()
  );
  if (todayEvents.length > 0) return todayEvents[0];
  return createEvent({
    groupId,
    title: "Spontane Runde",
    emoji: "🥂",
    type: "party",
    eventDate: new Date().toISOString(),
    challengeIds: [],
  });
}

export function addChallengeToEvent(eventId: string, challengeId: string): GameEvent | undefined {
  const all = readLS<GameEvent[]>(LS_KEYS.events, []);
  const idx = all.findIndex((e) => e.id === eventId);
  if (idx === -1) return undefined;
  if (!all[idx].challengeIds.includes(challengeId)) {
    all[idx] = { ...all[idx], challengeIds: [...all[idx].challengeIds, challengeId] };
    writeLS(LS_KEYS.events, all);
  }
  return all[idx];
}

/** Nächster relevanter Termin für den Countdown: reales Event oder nächster Geburtstag im Team. */
export function getNextHighlight(groupId: string): {
  date: Date;
  label: string;
  emoji: string;
  eventId?: string;
} | null {
  const now = new Date();
  const candidates: { date: Date; label: string; emoji: string; eventId?: string }[] = [];

  for (const e of listEvents(groupId)) {
    if (e.status === "finished") continue;
    candidates.push({ date: new Date(e.eventDate), label: e.title, emoji: e.emoji, eventId: e.id });
  }

  for (const member of listGroupMembers(groupId)) {
    if (!member.birthday) continue;
    const bday = new Date(member.birthday);
    let next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
    if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      next = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate());
    }
    const already = candidates.some(
      (c) => c.date.toDateString() === next.toDateString() && c.label.includes(member.name)
    );
    if (!already) {
      candidates.push({ date: next, label: `${member.name}s Geburtstag`, emoji: "🎂" });
    }
  }

  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  return candidates[0] ?? null;
}

// ---------------------------- Submissions & Voting ----------------------------

export function listSubmissions(eventId: string): Submission[] {
  const all = readLS<Submission[]>(LS_KEYS.submissions, []);
  return all.filter((s) => s.eventId === eventId);
}

export function listSubmissionsForUser(eventId: string, userId: string): Submission[] {
  return listSubmissions(eventId).filter((s) => s.userId === userId);
}

function saveAllSubmissions(list: Submission[]) {
  writeLS(LS_KEYS.submissions, list);
}

export function submitChallengeProof(input: {
  eventId: string;
  challengeId: string;
  userId: string;
  proofDataUrl?: string;
  note?: string;
}): Submission {
  const challenge = getAnyChallenge(input.challengeId);
  const all = readLS<Submission[]>(LS_KEYS.submissions, []);
  const submission: Submission = {
    id: uid("sub"),
    eventId: input.eventId,
    challengeId: input.challengeId,
    userId: input.userId,
    proofType: challenge?.proofType ?? "none",
    proofDataUrl: input.proofDataUrl,
    note: input.note,
    status: challenge?.proofType === "none" ? "approved" : "pending",
    pointsAwarded: challenge?.proofType === "none" ? challenge?.points ?? 0 : 0,
    votes: [],
    createdAt: new Date().toISOString(),
  };
  const updated = [...all, submission];
  saveAllSubmissions(updated);

  // Demo-Mitspieler stimmen automatisch ab, damit die lokale Abstimmung
  // auch solo direkt erlebbar ist.
  if (submission.status === "pending") {
    simulateBotVotes(submission.id);
  }
  return submission;
}

function simulateBotVotes(submissionId: string) {
  const event = (() => {
    const s = readLS<Submission[]>(LS_KEYS.submissions, []).find((x) => x.id === submissionId);
    return s ? getEvent(s.eventId) : undefined;
  })();
  if (!event) return;
  const members = listGroupMembers(event.groupId);
  const bots = members.filter((m) => m.id.startsWith("bot_"));
  bots.forEach((bot, i) => {
    setTimeout(() => {
      castVote(submissionId, bot.id, Math.random() > 0.12);
    }, 700 + i * 550);
  });
}

export function castVote(submissionId: string, voterId: string, approve: boolean): Submission | null {
  const all = readLS<Submission[]>(LS_KEYS.submissions, []);
  const idx = all.findIndex((s) => s.id === submissionId);
  if (idx === -1) return null;
  const sub = all[idx];
  if (sub.status !== "pending") return sub;
  const votes = sub.votes.filter((v) => v.voterId !== voterId);
  votes.push({ voterId, approve, createdAt: new Date().toISOString() });

  const event = getEvent(sub.eventId);
  const totalVoters = event ? listGroupMembers(event.groupId).length - 1 : votes.length;
  const approvals = votes.filter((v) => v.approve).length;
  const rejections = votes.filter((v) => !v.approve).length;
  const quorum = Math.max(1, Math.ceil(totalVoters / 2));

  let status: Submission["status"] = sub.status;
  let pointsAwarded = sub.pointsAwarded;
  if (approvals >= quorum) {
    status = "approved";
    const challenge = getAnyChallenge(sub.challengeId);
    pointsAwarded = challenge?.points ?? 0;
  } else if (rejections >= quorum) {
    status = "rejected";
    pointsAwarded = 0;
  }

  const updatedSub: Submission = { ...sub, votes, status, pointsAwarded };
  all[idx] = updatedSub;
  saveAllSubmissions(all);
  return updatedSub;
}

// ---------------------------- Ranking (Kickbase-Style) ----------------------------

export function computeRanking(groupId: string): RankingEntry[] {
  const members = listGroupMembers(groupId);
  const events = listEvents(groupId).map((e) => e.id);
  const submissions = readLS<Submission[]>(LS_KEYS.submissions, []).filter((s) =>
    events.includes(s.eventId)
  );

  const points: Record<string, number> = {};
  const completed: Record<string, number> = {};
  members.forEach((m) => {
    points[m.id] = 0;
    completed[m.id] = 0;
  });

  submissions
    .filter((s) => s.status === "approved")
    .forEach((s) => {
      points[s.userId] = (points[s.userId] ?? 0) + s.pointsAwarded;
      completed[s.userId] = (completed[s.userId] ?? 0) + 1;
    });

  const sorted = members
    .map((m) => ({
      userId: m.id,
      name: m.name,
      avatarEmoji: m.avatarEmoji,
      points: points[m.id] ?? 0,
      challengesCompleted: completed[m.id] ?? 0,
    }))
    .sort((a, b) => b.points - a.points);

  return sorted.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    previousRank: i + 1,
    trend: "same" as const,
  }));
}
