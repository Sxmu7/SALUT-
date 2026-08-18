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
  PartyPushState,
  PartyBingoConfig,
  BingoEventItem,
  BingoCardCell,
  BingoPlayerProgress,
  BingoSnapshot,
  BingoWinCondition,
} from "@/types";
import { CHALLENGES } from "@/lib/data/challenges";
import { isTodayBirthday, uid } from "@/lib/utils";
import { getSupabaseClient } from "./client";
import { ensureSupabaseUser } from "./auth";

// ---------------------------- Fehler-Helfer ----------------------------

/**
 * supabase-js gibt bei einem Query-Fehler NUR dann eine echte `Error`-
 * Instanz zurück, wenn man `.throwOnError()` verwendet. Der Rest dieser
 * Datei (wie der ursprüngliche Code) destrukturiert stattdessen
 * `{ data, error }` und wirft `error` selbst – das ist aber nur ein
 * PLAIN OBJECT (`JSON.parse()` der Fehlerantwort), kein `Error`. Jedes
 * `catch (err) { ... err instanceof Error ? err.message : "generischer
 * Fallback-Text" ... }` in der UI hat deshalb bisher IMMER den
 * generischen Fallback gezeigt und die echte Postgres/RLS-Fehlermeldung
 * verschluckt – auch bei den Fehlern, die in dieser Session gemeldet
 * wurden. Diese Funktion wandelt das PostgREST-Fehlerobjekt in eine
 * echte Error-Instanz mit lesbarer Message um, damit `instanceof Error`
 * überall dort, wo bereits sauber gefangen wird, endlich true ist und
 * der Nutzer den tatsächlichen Fehler sieht statt einer Nullmeldung.
 */
function raise(
  error: { message?: string; details?: string; hint?: string; code?: string } | null
): never {
  if (!error) throw new Error("Unbekannter Fehler.");
  const parts = [error.message || "Unbekannter Fehler."];
  if (error.hint) parts.push(`Hinweis: ${error.hint}`);
  if (error.code) parts.push(`(Code ${error.code})`);
  throw new Error(parts.join(" — "));
}

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
  const isNewProfile = current === null;
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
  if (error) raise(error);
  const profile = mapProfileRow(data);

  // Ein brandneues Profil ohne jede Gruppe würde die App sonst dauerhaft
  // im Lade-Zustand hängen lassen (Dashboard wartet auf eine erste
  // Gruppe) – im lokalen Demo-Modus übernimmt das lib/db.ts automatisch,
  // hier holen wir das bewusst nach. Fehlschläge hier sollen das
  // eigentliche Onboarding nicht blockieren, deshalb kein throw.
  if (isNewProfile) {
    try {
      const existingGroups = await listGroups();
      if (existingGroups.length === 0) {
        await createGroup("Meine Crew", "🎉");
      }
    } catch {
      // Nutzer landet dann auf der leeren "Freunde"-Seite und kann manuell
      // eine Gruppe erstellen/beitreten – besser als das Onboarding zu
      // blockieren.
    }
  }

  return profile;
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
  // Wichtig: bei einem echten Fehler (RLS, Netzwerk, fehlende Funktion...)
  // NICHT einfach [] zurückgeben – das sieht für die UI exakt so aus wie
  // "Nutzer hat wirklich keine Gruppe" und verschluckt den eigentlichen
  // Fehler komplett. Aufrufer, die das tolerieren können (z.B. best-effort
  // Hintergrundchecks), fangen das gezielt selbst ab.
  if (error) raise(error);
  if (!data) return [];
  const rows = data
    .map((row: { groups: Record<string, unknown> | null }) => row.groups)
    .filter((g: Record<string, unknown> | null): g is Record<string, unknown> => Boolean(g));
  return Promise.all(rows.map(mapGroupRow));
}

/** Nutzt die create_group()-RPC (siehe schema.sql) – ein direktes INSERT +
 * anschließendes .select() aus dem Client würde an der "groups"-SELECT-
 * Policy scheitern: Postgres behandelt die RETURNING-Zeile eines INSERT
 * wie ein SELECT, aber die Erstmitgliedschaft (die genau diese Policy
 * erfüllen würde) existiert im selben Moment noch nicht. Ergebnis wäre ein
 * irreführendes "0 rows"/"Gruppe konnte nicht erstellt werden", obwohl die
 * Gruppe technisch angelegt wurde. */
export async function createGroup(name: string, emoji: string): Promise<Group> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: name,
    p_emoji: emoji,
  });
  if (error) raise(error);
  return mapGroupRow(data as Record<string, unknown>);
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
  if (error) raise(error);
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
  if (error) raise(error);
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
  // Best-effort-Hintergrundcheck beim Dashboard-Öffnen – ein Fehler hier
  // (Netzwerk, RLS, ...) darf das Dashboard selbst nicht zum Absturz oder
  // zu einer unbehandelten Promise-Ablehnung bringen, deshalb bewusst
  // geschluckt statt wie sonst durchgereicht.
  const groups = await listGroups().catch(() => []);
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
    if (error) raise(error);
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
  if (error) raise(error);
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

// ---------------------------- Party-Push (Party-Modus) ----------------------------
// Nur im Supabase-Modus verfügbar – der lokale Demo-Modus hat keinen
// Server, der einen Scheduler/Push-Versand betreiben könnte. Die UI ruft
// diese Funktionen deshalb nur auf, wenn isRemoteMode() true ist.

function mapPartyPushStateRow(row: Record<string, unknown>): PartyPushState {
  return {
    eventId: row.event_id as string,
    pushEnabled: Boolean(row.push_enabled),
    intervalMinutes: row.interval_minutes as number,
    randomPick: Boolean(row.random_pick),
    noDuplicates: Boolean(row.no_duplicates),
    cycle: row.cycle as number,
    nextPushAt: (row.next_push_at as string | null) ?? null,
  };
}

export async function getPartyPushState(eventId: string): Promise<PartyPushState | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("party_push_state")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPartyPushStateRow(data);
}

/** Nutzt die set_party_push_config()-RPC (siehe schema.sql) – prüft dort
 * serverseitig die Gruppenmitgliedschaft, damit niemand für ein Event
 * einer fremden Gruppe Pushs (de)aktivieren kann. */
export async function setPartyPushConfig(
  eventId: string,
  config: {
    enabled: boolean;
    intervalMinutes?: number;
    random?: boolean;
    noDuplicates?: boolean;
  }
): Promise<PartyPushState> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data, error } = await supabase.rpc("set_party_push_config", {
    p_event_id: eventId,
    p_enabled: config.enabled,
    p_interval_minutes: config.intervalMinutes ?? 5,
    p_random: config.random ?? true,
    p_no_duplicates: config.noDuplicates ?? true,
  });
  if (error) raise(error);
  return mapPartyPushStateRow(data as Record<string, unknown>);
}

/** Legt die per subscribeToPush() erzeugte Browser-Subscription für den
 * aktuellen Nutzer ab (mehrere Geräte pro Nutzer sind erlaubt – jede
 * Subscription ist eine eigene Zeile, per `endpoint` eindeutig). */
export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await ensureSupabaseUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) raise(error);
}

// ---------------------------- Party-Bingo (Party-Modus) ----------------------------
// Nur im Supabase-Modus verfügbar – Kartenerzeugung und Gewinner-
// Ermittlung laufen ausschließlich serverseitig über die
// Security-Definer-Funktionen in schema.sql (siehe Kommentare dort). Die
// UI ruft diese Funktionen deshalb nur auf, wenn isRemoteMode() true ist.

function mapPartyBingoRow(row: Record<string, unknown>): PartyBingoConfig {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    status: row.status as "active" | "finished",
    gridSize: row.grid_size as number,
    freeCenter: Boolean(row.free_center),
    winCondition: row.win_condition as BingoWinCondition,
    requireConfirmations: row.require_confirmations as number,
    winnerUserId: (row.winner_user_id as string | null) ?? null,
    createdAt: row.created_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
  };
}

export async function getPartyBingo(eventId: string): Promise<PartyBingoConfig | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("party_bingo")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) raise(error);
  if (!data) return null;
  return mapPartyBingoRow(data);
}

/** Nutzt die start_party_bingo()-RPC – prüft dort serverseitig die
 * Gruppenmitgliedschaft, kopiert den Ereignis-Katalog für diese eine
 * Runde und legt für jedes aktuelle Gruppenmitglied direkt eine Karte an.
 * Idempotent: läuft für das Event schon eine Runde, kommt die bestehende
 * zurück statt eine zweite anzulegen. */
export async function startPartyBingo(
  eventId: string,
  config: {
    gridSize?: number;
    freeCenter?: boolean;
    winCondition?: BingoWinCondition;
    requireConfirmations?: number;
  } = {}
): Promise<PartyBingoConfig> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data, error } = await supabase.rpc("start_party_bingo", {
    p_event_id: eventId,
    p_grid_size: config.gridSize ?? 5,
    p_free_center: config.freeCenter ?? true,
    p_win_condition: config.winCondition ?? "one_line",
    p_require_confirmations: config.requireConfirmations ?? 1,
  });
  if (error) raise(error);
  return mapPartyBingoRow(data as Record<string, unknown>);
}

async function fetchBingoEvents(bingoId: string): Promise<BingoEventItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("party_bingo_events")
    .select("id, event_text, icon, is_triggered")
    .eq("bingo_id", bingoId)
    .order("event_text", { ascending: true });
  if (error) raise(error);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    text: row.event_text as string,
    icon: row.icon as string,
    isTriggered: Boolean(row.is_triggered),
  }));
}

/** Holt (und legt bei Bedarf serverseitig an) die eigene Karte über die
 * get_my_bingo_card()-RPC, dann die zugehörigen Zellen inkl. verknüpftem
 * Ereignis (Ein-Ebenen-Embed party_bingo_cells -> party_bingo_events, wie
 * an anderer Stelle in dieser Datei schon für group_members -> groups
 * genutzt). */
async function fetchMyBingoCard(bingoId: string): Promise<BingoCardCell[]> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data: cardData, error: cardError } = await supabase.rpc("get_my_bingo_card", {
    p_bingo_id: bingoId,
  });
  if (cardError) raise(cardError);
  const card = cardData as Record<string, unknown>;

  const { data, error } = await supabase
    .from("party_bingo_cells")
    .select("position, is_free, party_bingo_events(id, event_text, icon, is_triggered)")
    .eq("card_id", card.id as string)
    .order("position", { ascending: true });
  if (error) raise(error);
  return (data ?? []).map((row: Record<string, unknown>) => {
    const ev = row.party_bingo_events as Record<string, unknown> | null;
    return {
      position: row.position as number,
      isFree: Boolean(row.is_free),
      eventId: ev ? (ev.id as string) : null,
      text: ev ? (ev.event_text as string) : null,
      icon: ev ? (ev.icon as string) : null,
      isTriggered: ev ? Boolean(ev.is_triggered) : false,
    };
  });
}

/** Fortschritt aller Mitspieler. Solange die Runde aktiv ist, liefert RLS
 * hier automatisch nur die eigene Karte zurück (siehe schema.sql) – die
 * UI zeigt "playersProgress" deshalb bewusst erst nach Spielende an,
 * ohne das hier extra prüfen zu müssen. */
async function fetchBingoPlayersProgress(
  bingoId: string,
  gridSize: number,
  winnerUserId: string | null
): Promise<BingoPlayerProgress[]> {
  const supabase = getSupabaseClient();

  const { data: cardRows, error: cardsError } = await supabase
    .from("party_bingo_cards")
    .select("id, user_id, profiles(name, avatar_emoji)")
    .eq("bingo_id", bingoId);
  if (cardsError) raise(cardsError);
  if (!cardRows || cardRows.length === 0) return [];

  const { data: cellRows, error: cellsError } = await supabase
    .from("party_bingo_cells")
    .select("card_id, is_free, party_bingo_events(is_triggered)")
    .eq("bingo_id", bingoId);
  if (cellsError) raise(cellsError);

  const completedByCard = new Map<string, number>();
  for (const cell of (cellRows ?? []) as Record<string, unknown>[]) {
    const cardId = cell.card_id as string;
    const ev = cell.party_bingo_events as Record<string, unknown> | null;
    const done = Boolean(cell.is_free) || Boolean(ev?.is_triggered);
    if (done) completedByCard.set(cardId, (completedByCard.get(cardId) ?? 0) + 1);
  }

  const totalCount = gridSize * gridSize;
  return (cardRows as Record<string, unknown>[]).map((row) => {
    const profile = row.profiles as Record<string, unknown> | null;
    return {
      userId: row.user_id as string,
      name: (profile?.name as string) ?? "Spieler",
      avatarEmoji: (profile?.avatar_emoji as string) ?? "🥂",
      completedCount: completedByCard.get(row.id as string) ?? 0,
      totalCount,
      isWinner: row.user_id === winnerUserId,
    };
  });
}

/** Kompletter Bingo-Zustand für ein Event in einem Aufruf – Grundlage für
 * usePartyBingo(). Gibt null zurück, wenn für dieses Event noch keine
 * Runde gestartet wurde. */
export async function getBingoSnapshot(eventId: string): Promise<BingoSnapshot | null> {
  const bingo = await getPartyBingo(eventId);
  if (!bingo) return null;
  const [events, myCard, playersProgress] = await Promise.all([
    fetchBingoEvents(bingo.id),
    fetchMyBingoCard(bingo.id),
    fetchBingoPlayersProgress(bingo.id, bingo.gridSize, bingo.winnerUserId),
  ]);
  return { bingo, events, myCard, playersProgress };
}

/** Nutzt die report_bingo_event()-RPC – meldet/bestätigt ein Ereignis.
 * Die Funktion prüft serverseitig Mitgliedschaft + Bestätigungsschwelle,
 * markiert das Feld bei Erreichen bei ALLEN Karten (über die abgeleitete
 * is_triggered-Spalte) und ermittelt einen etwaigen Gewinner – ein Client
 * bekommt hier nie die Möglichkeit, selbst einen Gewinner zu setzen. */
export async function reportBingoEvent(bingoEventId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("report_bingo_event", {
    p_bingo_event_id: bingoEventId,
  });
  if (error) raise(error);
}

/** Nutzt die finish_party_bingo()-RPC – schließt die Runde ab (mit oder
 * ohne Gewinner) und macht dadurch über RLS automatisch alle Karten für
 * den Reveal-Moment sichtbar. */
export async function finishPartyBingo(bingoId: string): Promise<PartyBingoConfig> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data, error } = await supabase.rpc("finish_party_bingo", { p_bingo_id: bingoId });
  if (error) raise(error);
  return mapPartyBingoRow(data as Record<string, unknown>);
}

/** Live-Updates für eine Bingo-Runde über Supabase Realtime – spiegelt
 * bewusst subscribeToSubmission(): bei JEDER Änderung wird der komplette
 * Snapshot neu geladen statt nur ein Teil-Patch angewendet, damit z.B. ein
 * gerade ermittelter Gewinner sofort korrekt in allen abgeleiteten Werten
 * (playersProgress etc.) ankommt. */
export function subscribeToBingo(
  eventId: string,
  bingoId: string,
  onChange: (snapshot: BingoSnapshot | null) => void
): () => void {
  const supabase = getSupabaseClient();
  const refresh = async () => {
    onChange(await getBingoSnapshot(eventId));
  };
  const channel = supabase
    .channel(`bingo-${bingoId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "party_bingo", filter: `id=eq.${bingoId}` },
      refresh
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "party_bingo_events", filter: `bingo_id=eq.${bingoId}` },
      refresh
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
