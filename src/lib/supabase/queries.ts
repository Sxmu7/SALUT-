"use client";

/**
 * Async-Datenschicht gegen ein echtes Supabase-Projekt (supabase/schema.sql).
 * Spiegelt bewusst die Funktionsnamen/-signaturen von lib/db.ts (dem
 * localStorage-Demo-Modus) – siehe lib/data-layer.ts, das je nach
 * isSupabaseConfigured() zwischen beiden vermittelt.
 *
 * Wichtig, weil ohne echtes Supabase-Projekt in dieser Umgebung nicht live
 * gegenprüfbar: RLS-Policies und die beiden Security-Definer-Funktionen
 * (join_group_by_code, cast_vote) in schema.sql wurden bewusst so gebaut,
 * dass diese Queries mit den Policies zusammenpassen. Vor dem produktiven
 * Einsatz einmal mit einem echten Projekt durchklicken.
 */

import {
  Profile,
  Group,
  Challenge,
  GameEvent,
  Submission,
  RankingEntry,
  CategoryId,
} from "@/types";
import { CHALLENGES } from "@/lib/data/challenges";
import { isTodayBirthday, uid } from "@/lib/utils";
import { getSupabaseClient } from "./client";
import { ensureSupabaseUser } from "./auth";

// ---------------------------- Mapping-Helfer ----------------------------

function mapProfileRow(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    name: row.name as string,
    avatarEmoji: row.avatar_emoji as string,
    birthday: (row.birthday as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapChallengeRow(row: Record<string, unknown>): Challenge {
  return {
    id: row.id as string,
    categoryId: row.category_id as CategoryId,
    title: row.title as string,
    description: row.description as string,
    points: row.points as number,
    difficulty: row.difficulty as Challenge["difficulty"],
    proofType: row.proof_type as Challenge["proofType"],
    icon: row.icon as string,
    animation: row.animation as Challenge["animation"],
    isCustom: Boolean(row.is_custom),
    isBirthdayExclusive: Boolean(row.is_birthday_exclusive),
    source: row.source as Challenge["source"],
  };
}

async function mapGroupRow(row: Record<string, unknown>): Promise<Group> {
  const supabase = getSupabaseClient();
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", row.id as string);
  return {
    id: row.id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    inviteCode: row.invite_code as string,
    ownerId: row.owner_id as string,
    memberIds: (members ?? []).map((m: { user_id: string }) => m.user_id),
    createdAt: row.created_at as string,
  };
}

async function mapEventRow(row: Record<string, unknown>): Promise<GameEvent> {
  const supabase = getSupabaseClient();
  const { data: ecs } = await supabase
    .from("event_challenges")
    .select("challenge_id")
    .eq("event_id", row.id as string)
    .order("sort_order", { ascending: true });
  return {
    id: row.id as string,
    groupId: row.group_id as string,
    title: row.title as string,
    type: row.type as GameEvent["type"],
    emoji: row.emoji as string,
    eventDate: row.event_date as string,
    birthdayUserId: (row.birthday_user_id as string | undefined) ?? undefined,
    status: row.status as GameEvent["status"],
    challengeIds: (ecs ?? []).map((e: { challenge_id: string }) => e.challenge_id),
    createdAt: row.created_at as string,
  };
}

async function mapSubmissionRow(row: Record<string, unknown>): Promise<Submission> {
  const supabase = getSupabaseClient();
  const { data: voteRows } = await supabase
    .from("votes")
    .select("*")
    .eq("submission_id", row.id as string);
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    challengeId: row.challenge_id as string,
    userId: row.user_id as string,
    proofType: row.proof_type as Submission["proofType"],
    proofDataUrl: (row.proof_url as string | undefined) ?? undefined,
    note: (row.note as string | undefined) ?? undefined,
    status: row.status as Submission["status"],
    pointsAwarded: row.points_awarded as number,
    votes: (voteRows ?? []).map(
      (v: { voter_id: string; approve: boolean; created_at: string }) => ({
        voterId: v.voter_id,
        approve: v.approve,
        createdAt: v.created_at,
      })
    ),
    createdAt: row.created_at as string,
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ---------------------------- Profile ----------------------------

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const userId = await ensureSupabaseUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfileRow(data);
}

export async function createOrUpdateProfile(patch: Partial<Profile>): Promise<Profile> {
  const supabase = getSupabaseClient();
  const userId = await ensureSupabaseUser();
  const current = await getCurrentProfile();
  const next = {
    id: userId,
    name: patch.name ?? current?.name ?? "Spieler",
    avatar_emoji: patch.avatarEmoji ?? current?.avatarEmoji ?? "🥂",
    birthday: patch.birthday !== undefined ? patch.birthday : current?.birthday ?? null,
  };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(next)
    .select()
    .single();
  if (error) throw error;
  return mapProfileRow(data);
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return mapProfileRow(data);
}

// ---------------------------- Gruppen ----------------------------

export async function listGroups(): Promise<Group[]> {
  const supabase = getSupabaseClient();
  const userId = await ensureSupabaseUser();
  const { data, error } = await supabase
    .from("group_members")
    .select("groups(id, name, emoji, invite_code, owner_id, created_at)")
    .eq("user_id", userId);
  if (error || !data) return [];
  const rows = data
    .map((row: { groups: Record<string, unknown> | null }) => row.groups)
    .filter((g: Record<string, unknown> | null): g is Record<string, unknown> => Boolean(g));
  return Promise.all(rows.map(mapGroupRow));
}

export async function createGroup(name: string, emoji: string): Promise<Group> {
  const supabase = getSupabaseClient();
  const userId = await ensureSupabaseUser();
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const { data: group, error } = await supabase
    .from("groups")
    .insert({ name, emoji, invite_code: inviteCode, owner_id: userId })
    .select()
    .single();
  if (error) throw error;
  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: userId });
  if (memberError) throw memberError;
  return mapGroupRow(group);
}

/** Nutzt die join_group_by_code()-RPC (siehe schema.sql) – ein direkter
 * SELECT auf "groups" würde an der RLS-Policy scheitern, solange man noch
 * kein Mitglied ist. */
export async function joinGroupByCode(code: string): Promise<Group | null> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data, error } = await supabase.rpc("join_group_by_code", {
    p_invite_code: code.trim(),
  });
  if (error || !data) return null;
  return mapGroupRow(data as Record<string, unknown>);
}

export async function listGroupMembers(groupId: string): Promise<Profile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("profiles(*)")
    .eq("group_id", groupId);
  if (error || !data) return [];
  return data
    .map((row: { profiles: Record<string, unknown> | null }) => row.profiles)
    .filter((p: Record<string, unknown> | null): p is Record<string, unknown> => Boolean(p))
    .map(mapProfileRow);
}

// ---------------------------- Challenges ----------------------------
// Das feste Grundset bleibt bewusst eine statische, identische Konstante
// auf jedem Client (kein DB-Roundtrip nötig) – nur nutzerangelegte/KI-
// generierte Challenges leben in der "challenges"-Tabelle. Das feste Set
// wurde zusätzlich per Seed in die Tabelle geschrieben (siehe schema.sql),
// weil event_challenges + cast_vote() per Foreign Key/Lookup echte Zeilen
// brauchen – die App liest es hier trotzdem aus der lokalen Konstante,
// um einen Query zu sparen.

export async function listAllChallenges(): Promise<Challenge[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .eq("is_custom", true);
  const custom = error || !data ? [] : data.map(mapChallengeRow);
  return [...CHALLENGES, ...custom];
}

export async function getAnyChallenge(id: string): Promise<Challenge | undefined> {
  const fixed = CHALLENGES.find((c) => c.id === id);
  if (fixed) return fixed;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (error || !data) return undefined;
  return mapChallengeRow(data);
}

export async function addCustomChallenges(newOnes: Challenge[]): Promise<Challenge[]> {
  const supabase = getSupabaseClient();
  const userId = await ensureSupabaseUser();
  const rows = newOnes.map((c) => ({
    id: c.id,
    category_id: c.categoryId,
    title: c.title,
    description: c.description,
    points: c.points,
    difficulty: c.difficulty,
    proof_type: c.proofType,
    icon: c.icon,
    animation: c.animation,
    is_custom: true,
    created_by: userId,
    source: c.source ?? "manual",
  }));
  const { error } = await supabase.from("challenges").insert(rows);
  if (error) throw error;
  return listAllChallenges();
}

// ---------------------------- Events ----------------------------

export async function listEvents(groupId: string): Promise<GameEvent[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("group_id", groupId)
    .order("event_date", { ascending: true });
  if (error || !data) return [];
  return Promise.all(data.map(mapEventRow));
}

export async function getEvent(id: string): Promise<GameEvent | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error || !data) return undefined;
  return mapEventRow(data);
}

export async function createEvent(input: {
  groupId: string;
  title: string;
  emoji: string;
  type: GameEvent["type"];
  eventDate: string;
  birthdayUserId?: string;
}): Promise<GameEvent> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const status: GameEvent["status"] =
    new Date(input.eventDate).toDateString() === now.toDateString()
      ? "live"
      : new Date(input.eventDate) < now
      ? "finished"
      : "upcoming";
  const { data, error } = await supabase
    .from("events")
    .insert({
      group_id: input.groupId,
      title: input.title,
      type: input.type,
      emoji: input.emoji,
      event_date: input.eventDate,
      birthday_user_id: input.birthdayUserId ?? null,
      status,
    })
    .select()
    .single();
  if (error) throw error;
  return mapEventRow(data);
}

/**
 * Client-seitiger Fallback, falls der tägliche Vercel-Cron (siehe
 * src/app/api/cron/birthdays/route.ts) noch nicht eingerichtet ist –
 * prüft beim Öffnen des Dashboards. Der Cron ist der eigentlich robuste
 * Weg (läuft auch ohne dass jemand die App öffnet); das hier ist bewusst
 * redundant dazu, nicht als Ersatz gedacht.
 */
export async function ensureBirthdayEvents(): Promise<GameEvent[]> {
  const groups = await listGroups();
  const created: GameEvent[] = [];
  const thisYear = new Date().getFullYear();

  for (const group of groups) {
    const members = await listGroupMembers(group.id);
    for (const member of members) {
      if (!member.birthday || !isTodayBirthday(member.birthday)) continue;
      const events = await listEvents(group.id);
      const existing = events.find(
        (e) =>
          e.type === "birthday" &&
          e.birthdayUserId === member.id &&
          new Date(e.eventDate).getFullYear() === thisYear
      );
      if (existing) continue;
      const event = await createEvent({
        groupId: group.id,
        title: `${member.name}s Geburtstags-Abend`,
        emoji: "🎂",
        type: "birthday",
        eventDate: new Date().toISOString(),
        birthdayUserId: member.id,
      });
      created.push(event);
    }
  }
  return created;
}

export async function pickChallengeForEvent(
  eventId: string,
  categoryId: CategoryId
): Promise<Challenge | null> {
  const event = await getEvent(eventId);
  if (!event) return null;
  const submissions = await listSubmissions(eventId);
  const played = new Set(submissions.map((s) => s.challengeId));
  const isBirthday = event.type === "birthday";
  const eligible = (c: Challenge) => !played.has(c.id) && (isBirthday || !c.isBirthdayExclusive);

  const all = await listAllChallenges();
  const inCategory = all.filter((c) => c.categoryId === categoryId && eligible(c));
  if (inCategory.length > 0) {
    return inCategory[Math.floor(Math.random() * inCategory.length)];
  }
  const anyLeft = all.filter(eligible);
  if (anyLeft.length === 0) return null;
  return anyLeft[Math.floor(Math.random() * anyLeft.length)];
}

export async function getOrCreateQuickEvent(groupId: string): Promise<GameEvent> {
  const events = await listEvents(groupId);
  const todayEvents = events.filter(
    (e) =>
      e.status !== "finished" &&
      new Date(e.eventDate).toDateString() === new Date().toDateString()
  );
  if (todayEvents.length > 0) return todayEvents[0];
  return createEvent({
    groupId,
    title: "Spontane Runde",
    emoji: "🥂",
    type: "party",
    eventDate: new Date().toISOString(),
  });
}

export async function addChallengeToEvent(
  eventId: string,
  challengeId: string
): Promise<GameEvent | undefined> {
  const supabase = getSupabaseClient();
  const event = await getEvent(eventId);
  if (!event) return undefined;
  if (!event.challengeIds.includes(challengeId)) {
    const { error } = await supabase.from("event_challenges").insert({
      event_id: eventId,
      challenge_id: challengeId,
      sort_order: event.challengeIds.length,
    });
    if (error) throw error;
  }
  return getEvent(eventId);
}

export async function getNextHighlight(groupId: string): Promise<{
  date: Date;
  label: string;
  emoji: string;
  eventId?: string;
} | null> {
  const now = new Date();
  const candidates: { date: Date; label: string; emoji: string; eventId?: string }[] = [];

  const events = await listEvents(groupId);
  for (const e of events) {
    if (e.status === "finished") continue;
    candidates.push({ date: new Date(e.eventDate), label: e.title, emoji: e.emoji, eventId: e.id });
  }

  const members = await listGroupMembers(groupId);
  for (const member of members) {
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

export async function listSubmissions(eventId: string): Promise<Submission[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("submissions").select("*").eq("event_id", eventId);
  if (error || !data) return [];
  return Promise.all(data.map(mapSubmissionRow));
}

export async function listSubmissionsForUser(
  eventId: string,
  userId: string
): Promise<Submission[]> {
  const all = await listSubmissions(eventId);
  return all.filter((s) => s.userId === userId);
}

export async function submitChallengeProof(input: {
  eventId: string;
  challengeId: string;
  userId: string;
  proofDataUrl?: string;
  note?: string;
}): Promise<Submission> {
  const supabase = getSupabaseClient();
  const challenge = await getAnyChallenge(input.challengeId);

  // Beweise landen im Supabase-Storage-Bucket "proofs" statt als Base64 in
  // der Datenbank – das ist auch der Grund, warum der lokale Demo-Modus an
  // sein localStorage-Quota stoßen kann (siehe bekannte Limitierung),
  // dieser Pfad hier aber nicht.
  let proofUrl: string | undefined;
  if (input.proofDataUrl) {
    try {
      const blob = dataUrlToBlob(input.proofDataUrl);
      const ext = blob.type.includes("video") ? "webm" : "jpg";
      const path = `${input.eventId}/${input.userId}-${uid("proof")}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("proofs")
        .upload(path, blob, { contentType: blob.type, upsert: true });
      if (!uploadError) {
        proofUrl = supabase.storage.from("proofs").getPublicUrl(path).data.publicUrl;
      }
    } catch {
      // Upload-Fehler blockiert die Einreichung nicht – lieber ohne Beweis-
      // URL einreichen (Gruppe sieht dann "kein Bild") als den ganzen Flow
      // abzubrechen.
    }
  }

  const status: Submission["status"] = challenge?.proofType === "none" ? "approved" : "pending";
  const pointsAwarded = status === "approved" ? challenge?.points ?? 0 : 0;

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      event_id: input.eventId,
      challenge_id: input.challengeId,
      user_id: input.userId,
      proof_type: challenge?.proofType ?? "none",
      proof_url: proofUrl,
      note: input.note,
      status,
      points_awarded: pointsAwarded,
    })
    .select()
    .single();
  if (error) throw error;
  return mapSubmissionRow(data);
}

/** Nutzt die cast_vote()-RPC (siehe schema.sql) – Stimme + Quorum-Check +
 * Status-Update laufen dort atomar, damit gleichzeitige Stimmen von
 * mehreren Handys nicht zu einem falschen Endstatus führen können. */
export async function castVote(
  submissionId: string,
  _voterId: string,
  approve: boolean
): Promise<Submission | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("cast_vote", {
    p_submission_id: submissionId,
    p_approve: approve,
  });
  if (error || !data) return null;
  return mapSubmissionRow(data as Record<string, unknown>);
}

/** Live-Updates für eine Submission (Status + neue Stimmen) über Supabase
 * Realtime – ersetzt das 800ms-Polling aus dem lokalen Demo-Modus. */
export function subscribeToSubmission(
  submissionId: string,
  onChange: (submission: Submission) => void
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`submission-${submissionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "submissions", filter: `id=eq.${submissionId}` },
      async () => {
        const supabase2 = getSupabaseClient();
        const { data } = await supabase2
          .from("submissions")
          .select("*")
          .eq("id", submissionId)
          .maybeSingle();
        if (data) onChange(await mapSubmissionRow(data));
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes", filter: `submission_id=eq.${submissionId}` },
      async () => {
        const supabase2 = getSupabaseClient();
        const { data } = await supabase2
          .from("submissions")
          .select("*")
          .eq("id", submissionId)
          .maybeSingle();
        if (data) onChange(await mapSubmissionRow(data));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------- Ranking ----------------------------

export async function computeRanking(groupId: string): Promise<RankingEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("group_rankings")
    .select("*")
    .eq("group_id", groupId)
    .order("points", { ascending: false });
  if (error || !data) return [];
  return data.map((row: Record<string, unknown>, i: number) => ({
    userId: row.user_id as string,
    name: row.name as string,
    avatarEmoji: row.avatar_emoji as string,
    points: row.points as number,
    challengesCompleted: row.challenges_completed as number,
    rank: i + 1,
    previousRank: i + 1,
    trend: "same" as const,
  }));
}
