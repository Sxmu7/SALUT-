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
  CoworkerGroup,
  CoworkerChallenge,
} from "@/types";
import { CHALLENGES } from "@/lib/data/challenges";
import { isTodayBirthday, parseLocalDate, uid } from "@/lib/utils";
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

// Bewusst SYNCHRON und ohne eigenen Query mehr: früher hat diese Funktion
// pro Gruppe eine zusätzliche "group_members"-Abfrage nur für die
// User-IDs gemacht (klassisches N+1 – bei z.B. 3 Gruppen also 3
// zusätzliche, seriell mitgezählte Round-Trips beim Laden von "Freunde"
// bzw. beim Dashboard-Start). memberIds wird im Remote-Modus nirgendwo
// gelesen (nur lib/db.ts im lokalen Demo-Modus nutzt es) – volle Profile
// der Mitglieder kommen ohnehin separat über listGroupMembers(). Deshalb
// hier einfach leer lassen, statt Daten zu laden, die nie gebraucht werden.
function mapGroupRow(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    inviteCode: row.invite_code as string,
    ownerId: row.owner_id as string,
    memberIds: [],
    createdAt: row.created_at as string,
  };
}

async function mapEventRow(row: Record<string, unknown>): Promise<GameEvent> {
  const supabase = getSupabaseClient();
  const { data: ecs } = await supabase
    .from("event_challenges")
    .select("challenge_id, assigned_user_id")
    .eq("event_id", row.id as string)
    .order("sort_order", { ascending: true });
  const rows = (ecs ?? []) as { challenge_id: string; assigned_user_id: string | null }[];
  const challengeAssignments: Record<string, string> = {};
  for (const r of rows) {
    if (r.assigned_user_id) challengeAssignments[r.challenge_id] = r.assigned_user_id;
  }
  return {
    id: row.id as string,
    groupId: (row.group_id as string | null) ?? null,
    coworkerGroupId: (row.coworker_group_id as string | null) ?? null,
    title: row.title as string,
    type: row.type as GameEvent["type"],
    emoji: row.emoji as string,
    eventDate: row.event_date as string,
    birthdayUserId: (row.birthday_user_id as string | undefined) ?? undefined,
    status: row.status as GameEvent["status"],
    challengeIds: rows.map((e) => e.challenge_id),
    createdAt: row.created_at as string,
    turnModeEnabled: Boolean(row.turn_mode_enabled),
    turnOrder: (row.turn_order as string[] | null) ?? [],
    turnIndex: (row.turn_index as number | null) ?? 0,
    challengeAssignments,
    targetChallengeCount: (row.target_challenge_count as number | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    coworkerNextPushAt: (row.coworker_next_push_at as string | null) ?? null,
  };
}

function mapCoworkerGroupRow(row: Record<string, unknown>): CoworkerGroup {
  return {
    id: row.id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    inviteCode: row.invite_code as string,
    ownerId: row.owner_id as string,
    createdAt: row.created_at as string,
  };
}

function mapCoworkerChallengeRow(row: Record<string, unknown>): CoworkerChallenge {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    points: row.points as number,
    difficulty: row.difficulty as CoworkerChallenge["difficulty"],
    proofType: row.proof_type as CoworkerChallenge["proofType"],
    icon: row.icon as string,
    animation: row.animation as CoworkerChallenge["animation"],
    isCustom: Boolean(row.is_custom),
    source: row.source as CoworkerChallenge["source"],
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
  return rows.map(mapGroupRow);
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

/** Nutzt die leave_group()-RPC (siehe schema.sql) – der Ersteller kann so
 * nicht "einfach verlassen", solange noch andere Mitglieder da sind (die
 * Funktion wirft dann einen klaren Fehler statt die Gruppe ownerlos zu
 * hinterlassen). */
export async function leaveGroup(groupId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });
  if (error) raise(error);
}

/** Nutzt die kick_group_member()-RPC – prüft serverseitig, dass nur der
 * Ersteller entfernen darf und dass niemand den Ersteller selbst
 * rauswirft. */
export async function kickGroupMember(groupId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("kick_group_member", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) raise(error);
}

/** Nutzt die delete_group()-RPC – löscht per ON DELETE CASCADE auch alle
 * Events/Submissions/Votes/Push-/Bingo-Daten dieser Gruppe mit. */
export async function deleteGroup(groupId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("delete_group", { p_group_id: groupId });
  if (error) raise(error);
}

/** Live-Updates für die eigenen Gruppen/Mitgliedschaften. Reagiert
 * bewusst breit (keine Filterung auf eine einzelne Gruppen-ID) auf JEDE
 * Änderung an group_members/groups und löst dann einfach einen kompletten
 * Refetch beim Aufrufer aus (spiegelt subscribeToSubmission) – RLS sorgt
 * weiterhin dafür, dass beim Refetch nur die eigenen Gruppen ankommen.
 * Damit sehen andere Mitglieder Beitritte/Austritte/Löschungen live,
 * ohne dass die App manuell neu geladen werden muss.
 *
 * WICHTIG: supabase.channel(topic) gibt bei GLEICHEM Topic-String den
 * bereits bestehenden (und meist schon .subscribe()'ten) Channel zurück,
 * statt einen neuen zu erzeugen (siehe RealtimeClient.channel() im SDK).
 * Diese Funktion wird aber von mehreren Stellen GLEICHZEITIG aufgerufen
 * (useGroups(), usePrimaryGroup(), und pro Gruppenkarte in groups/page.tsx
 * je ein eigenes Abo) – mit einem festen Namen wie früher "groups-sync"
 * bekommt jeder Aufruf ab dem zweiten denselben, schon abonnierten
 * Channel zurück, und .on(...) danach wirft zur Laufzeit "cannot add
 * postgres_changes callbacks ... after subscribe()". Ein pro Aufruf
 * eindeutiger Topic-Name (uid()) gibt jedem Aufrufer garantiert seinen
 * eigenen Channel. */
export function subscribeToGroups(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`groups-sync-${uid()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "groups" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------- Kollegen-Gruppen (Co-Worker-Modus) ----------------------------
// 1:1 dieselben Muster wie bei den Trinkspiel-Gruppen oben, nur auf
// coworker_groups/coworker_group_members statt groups/group_members – nur
// im Supabase-Modus verfügbar (siehe requireRemoteMode() in data-layer.ts),
// deshalb gibt es hier bewusst kein lokales Pendant in lib/db.ts.

export async function listCoworkerGroups(): Promise<CoworkerGroup[]> {
  const supabase = getSupabaseClient();
  const userId = await ensureSupabaseUser();
  const { data, error } = await supabase
    .from("coworker_group_members")
    .select("coworker_groups(id, name, emoji, invite_code, owner_id, created_at)")
    .eq("user_id", userId);
  if (error) raise(error);
  if (!data) return [];
  const rows = data
    .map((row: { coworker_groups: Record<string, unknown> | null }) => row.coworker_groups)
    .filter((g: Record<string, unknown> | null): g is Record<string, unknown> => Boolean(g));
  return rows.map(mapCoworkerGroupRow);
}

export async function createCoworkerGroup(name: string, emoji: string): Promise<CoworkerGroup> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data, error } = await supabase.rpc("create_coworker_group", {
    p_name: name,
    p_emoji: emoji,
  });
  if (error) raise(error);
  return mapCoworkerGroupRow(data as Record<string, unknown>);
}

export async function joinCoworkerGroupByCode(code: string): Promise<CoworkerGroup | null> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { data, error } = await supabase.rpc("join_coworker_group_by_code", {
    p_invite_code: code.trim(),
  });
  if (error || !data) return null;
  return mapCoworkerGroupRow(data as Record<string, unknown>);
}

export async function listCoworkerGroupMembers(groupId: string): Promise<Profile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("coworker_group_members")
    .select("profiles(*)")
    .eq("group_id", groupId);
  if (error || !data) return [];
  return data
    .map((row: { profiles: Record<string, unknown> | null }) => row.profiles)
    .filter((p: Record<string, unknown> | null): p is Record<string, unknown> => Boolean(p))
    .map(mapProfileRow);
}

export async function leaveCoworkerGroup(groupId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("leave_coworker_group", { p_group_id: groupId });
  if (error) raise(error);
}

export async function kickCoworkerGroupMember(groupId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("kick_coworker_group_member", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) raise(error);
}

export async function deleteCoworkerGroup(groupId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("delete_coworker_group", { p_group_id: groupId });
  if (error) raise(error);
}

/** Live-Updates für Kollegen-Gruppen/Mitgliedschaften – siehe
 * subscribeToGroups() oben für die ausführliche Erklärung des
 * eindeutigen Topic-Namens. */
export function subscribeToCoworkerGroups(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`coworker-groups-sync-${uid()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "coworker_group_members" },
      onChange
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "coworker_groups" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ---------------------------- Kollegen-Challenges (Co-Worker-Modus) ----------------------------

export async function listCoworkerChallenges(): Promise<CoworkerChallenge[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("coworker_challenges").select("*");
  if (error || !data) return [];
  return data.map(mapCoworkerChallengeRow);
}

export async function getAnyCoworkerChallenge(id: string): Promise<CoworkerChallenge | undefined> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("coworker_challenges")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return undefined;
  return mapCoworkerChallengeRow(data);
}

// ---------------------------- Kollegen-Events (Co-Worker-Modus) ----------------------------
// Der 5-Minuten-Push-Rhythmus selbst läuft komplett serverseitig (pg_cron +
// Edge Function coworker-push-tick, siehe schema.sql) – hier nur das
// Erstellen/Laden des Events + das Annehmen ("claimen") einer Challenge.

export async function listCoworkerEvents(coworkerGroupId: string): Promise<GameEvent[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("coworker_group_id", coworkerGroupId)
    .order("event_date", { ascending: true });
  if (error || !data) return [];
  return Promise.all(data.map(mapEventRow));
}

/** Analog zu getOrCreateQuickEvent() im Trinkspiel-Pfad: pro Kollegen-Gruppe
 * gibt es effektiv einen dauerhaften "Feed" statt einzelner Abende – ein
 * bereits laufendes (nicht beendetes) Event wird wiederverwendet, sonst
 * wird eins direkt mit status "live" angelegt (kein "upcoming"-Zwischen-
 * schritt, der Kollegen-Modus ist immer sofort aktiv). coworker_next_push_at
 * bleibt beim Insert absichtlich null – claim_due_coworker_pushes() (siehe
 * schema.sql) behandelt null wie "sofort fällig" und plant beim ersten
 * Scheduler-Tick den nächsten gültigen Arbeitszeit-Slot selbst ein. */
export async function getOrCreateCoworkerEvent(coworkerGroupId: string): Promise<GameEvent> {
  const existing = await listCoworkerEvents(coworkerGroupId);
  const live = existing.find((e) => e.status !== "finished");
  if (live) return live;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      coworker_group_id: coworkerGroupId,
      title: "Arbeitstag",
      type: "coworker",
      emoji: "💼",
      event_date: new Date().toISOString(),
      status: "live",
    })
    .select()
    .single();
  if (error) raise(error);
  return mapEventRow(data);
}

/** Nutzt die claim_coworker_challenge()-RPC (siehe schema.sql) – "wer
 * zuerst tippt, kriegt sie": atomares UPDATE ... WHERE assigned_user_id IS
 * NULL auf Server-Seite, damit bei zwei fast gleichzeitigen Tippern nur
 * genau eine Person gewinnt. Wirft bei bereits vergebenen/nicht
 * existierenden Challenges (siehe already_claimed_or_not_found in
 * schema.sql) – die UI sollte das abfangen und "schon vergeben" anzeigen. */
export async function claimCoworkerChallenge(eventId: string, challengeId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await ensureSupabaseUser();
  const { error } = await supabase.rpc("claim_coworker_challenge", {
    p_event_id: eventId,
    p_challenge_id: challengeId,
  });
  if (error) raise(error);
}

/** Live-Updates für den Kollegen-Feed eines Events: neue automatisch
 * verschickte Challenges (event_challenges INSERT) + wer welche Challenge
 * geclaimt hat (event_challenges UPDATE) – siehe Realtime-Publikation in
 * schema.sql. */
export function subscribeToEventChallenges(eventId: string, onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`event-challenges-${eventId}-${uid()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "event_challenges", filter: `event_id=eq.${eventId}` },
      onChange
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
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
    // Reihum-Modus: die frisch aufgedeckte Challenge geht an die Person,
    // die laut turnIndex gerade dran ist – unabhängig davon, wer
    // tatsächlich gewürfelt hat (siehe DiceRoller.tsx/TurnModePanel.tsx).
    const assignedUserId =
      event.turnModeEnabled && event.turnOrder.length > 0
        ? event.turnOrder[event.turnIndex]
        : null;
    const { error } = await supabase.from("event_challenges").insert({
      event_id: eventId,
      challenge_id: challengeId,
      sort_order: event.challengeIds.length,
      assigned_user_id: assignedUserId,
    });
    if (error) raise(error);
  }
  return getEvent(eventId);
}

// ---------------------------- Reihum-Modus & Abend-Ziel ----------------------------
// Events haben keine generische UPDATE-Policy (wie der Rest des Schemas
// bewusst nur Security-Definer-RPCs für Schreibzugriffe, siehe
// schema.sql) – deshalb hier drei kleine RPCs statt direkter .update().

export async function setTurnMode(eventId: string, enabled: boolean): Promise<GameEvent | undefined> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("set_turn_mode", {
    p_event_id: eventId,
    p_enabled: enabled,
  });
  if (error) raise(error);
  return getEvent(eventId);
}

export async function setEventTarget(
  eventId: string,
  target: number | null
): Promise<GameEvent | undefined> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("set_event_target", {
    p_event_id: eventId,
    p_target: target,
  });
  if (error) raise(error);
  return getEvent(eventId);
}

export async function endEvent(eventId: string): Promise<GameEvent | undefined> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("end_event", { p_event_id: eventId });
  if (error) raise(error);
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

  // Beide Abfragen sind unabhängig voneinander (Events der Gruppe vs.
  // Geburtstage der Mitglieder) – parallel statt nacheinander laden
  // spart einen kompletten Round-Trip beim Dashboard-Start.
  const [events, members] = await Promise.all([listEvents(groupId), listGroupMembers(groupId)]);
  for (const e of events) {
    if (e.status === "finished") continue;
    candidates.push({ date: new Date(e.eventDate), label: e.title, emoji: e.emoji, eventId: e.id });
  }

  for (const member of members) {
    if (!member.birthday) continue;
    const bday = parseLocalDate(member.birthday);
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
  // Kollegen-Events (type "coworker") haben ihren Challenge-Katalog in der
  // komplett getrennten Tabelle coworker_challenges statt challenges – ohne
  // diese Weiche würde getAnyChallenge() hier nichts finden und proofType/
  // points fälschlich auf "none"/0 zurückfallen (siehe getAnyCoworkerChallenge
  // unten).
  const event = await getEvent(input.eventId);
  const challenge =
    event?.type === "coworker"
      ? await getAnyCoworkerChallenge(input.challengeId)
      : await getAnyChallenge(input.challengeId);

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
  const created = await mapSubmissionRow(data);

  // Andere Mitglieder per Push benachrichtigen, dass eine neue Einreichung
  // auf ihre Stimme wartet ("Wartet auf deine Stimme" auf der Event-Seite,
  // siehe PendingVotes.tsx) - nur nötig, wenn wirklich abgestimmt werden
  // muss (proofType "none" ist sofort "approved", ohne dass jemand
  // abstimmt). Bewusst nicht awaited/blockierend: die Einreichung selbst
  // ist fertig und soll nicht auf den Push-Versand warten.
  if (created.status === "pending") {
    notifyVoteRequest(created.id);
  } else if (created.status === "approved") {
    // proofType "none" wird sofort ohne Abstimmung genehmigt und läuft
    // deshalb nie durch cast_vote() – Reihum-Weiterschaltung/Abend-Ziel
    // (finalize_submission_approval(), siehe schema.sql) muss hier separat
    // angestoßen werden, UND zwar fertig sein, BEVOR die Push-Benachrichtigung
    // rausgeht (sonst könnte die Push-Funktion noch den alten turn_index
    // lesen und der falschen Person "du bist dran" schicken). Die ganze
    // Kette hier ist bewusst nicht awaited: submitChallengeProof() selbst
    // soll nicht auf Reihum-Update + Push warten.
    const supabase2 = getSupabaseClient();
    supabase2
      .rpc("finalize_submission_approval", { p_submission_id: created.id })
      .then(() => notifyChallengeCompleted(created.id));
  }

  return created;
}

/**
 * Eine Challenge bewusst ablehnen, statt einen Beweis einzureichen – legt
 * direkt eine Submission mit status "rejected" an (kein Beweis, keine
 * Abstimmung nötig). Der `note`-Wert "declined_by_user" unterscheidet das
 * in der UI von einer durch die Gruppen-Abstimmung abgelehnten Submission
 * (siehe events/[id]/challenges/[challengeId]/page.tsx). Erneutes Würfeln/
 * Einreichen bleibt danach möglich – es gibt bewusst keine Unique-
 * Constraint auf (event_id, challenge_id, user_id).
 */
export async function declineChallenge(input: {
  eventId: string;
  challengeId: string;
  userId: string;
}): Promise<Submission> {
  const supabase = getSupabaseClient();
  const challenge = await getAnyChallenge(input.challengeId);
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      event_id: input.eventId,
      challenge_id: input.challengeId,
      user_id: input.userId,
      proof_type: challenge?.proofType ?? "none",
      note: "declined_by_user",
      status: "rejected",
      points_awarded: 0,
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
  const submission = await mapSubmissionRow(data as Record<string, unknown>);

  // Reihum-Weiterschaltung + evtl. Auto-Abendende laufen bereits serverseitig
  // innerhalb von cast_vote() (siehe finalize_submission_approval() in
  // schema.sql) – hier nur noch die QuizDuell-Style Push an die Gruppe.
  // Bewusst nicht awaited/blockierend: das Voten selbst ist fertig.
  if (submission.status === "approved") {
    notifyChallengeCompleted(submission.id);
  }

  return submission;
}

/**
 * "QuizDuell-Style": alle anderen Gruppenmitglieder per Push informieren,
 * dass gerade jemand eine Challenge gemeistert hat (siehe
 * notify-challenge-completed Edge Function) – unabhängig davon, ob per
 * Abstimmung oder automatisch (proofType "none") genehmigt. Wie
 * notifyVoteRequest() bewusst fehlertolerant: ein Push-Fehlschlag darf den
 * eigentlichen Spielfluss nie blockieren.
 */
export async function notifyChallengeCompleted(submissionId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke("notify-challenge-completed", {
      body: { submissionId },
    });
    if (error) console.warn("notify-challenge-completed fehlgeschlagen:", error);
  } catch (err) {
    console.warn("notify-challenge-completed fehlgeschlagen:", err);
  }
}

/** Live-Updates für eine Submission (Status + neue Stimmen) über Supabase
 * Realtime – ersetzt das 800ms-Polling aus dem lokalen Demo-Modus. */
export function subscribeToSubmission(
  submissionId: string,
  onChange: (submission: Submission) => void
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    // uid()-Suffix: siehe ausführlichen Kommentar bei subscribeToGroups()
    // weiter oben - verhindert einen kollidierenden, schon abonnierten
    // Channel, falls dieselbe Submission-ID (theoretisch) von mehr als
    // einer Stelle gleichzeitig abonniert wird.
    .channel(`submission-${submissionId}-${uid()}`)
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

/**
 * Live-Updates für ALLE Submissions eines Events – das ist die eigentliche
 * "Sync mit anderen Spielern zur Abstimmung": ohne das würde eine neu
 * eingereichte Challenge eines Mitspielers erst nach manuellem Neuladen
 * bei den anderen auftauchen, die dann darüber abstimmen sollen. Reagiert
 * auf neue Submissions (event_id-gefiltert) UND auf neue/geänderte Votes
 * (Tabelle "votes" hat kein event_id, deshalb hier ungefiltert – ein
 * Refetch bei JEDER Stimme irgendeines Events ist minimal ineffizient,
 * aber unkritisch und deutlich einfacher als ein Join-Filter).
 */
export function subscribeToEventSubmissions(
  eventId: string,
  onChange: (submissions: Submission[]) => void
): () => void {
  const supabase = getSupabaseClient();
  const refetch = async () => {
    onChange(await listSubmissions(eventId));
  };
  const channel = supabase
    // uid()-Suffix: siehe subscribeToGroups() weiter oben.
    .channel(`event-submissions-${eventId}-${uid()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "submissions", filter: `event_id=eq.${eventId}` },
      refetch
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, refetch)
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

/** Push-Benachrichtigungen auf diesem Gerät wieder abmelden (z.B. wenn der
 * Nutzer den "Abstimmungs-Benachrichtigungen"-Schalter ausschaltet). Die
 * RLS-Policy erlaubt ohnehin nur das Löschen der eigenen Zeilen, der
 * endpoint-Filter grenzt zusätzlich auf genau dieses Gerät ein. */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) raise(error);
}

/**
 * Löst die "Jemand hat eine Challenge eingereicht – bitte abstimmen"-Push-
 * Benachrichtigung aus (Edge Function notify-vote-request, siehe dort).
 * Bewusst best-effort: kein Wurf bei Fehlern (fehlende Edge Function,
 * fehlende VAPID-Secrets, Netzwerkfehler, ...) – das Einreichen selbst
 * darf davon nicht abhängen, die Push-Benachrichtigung ist ein "nice to
 * have" obendrauf, kein kritischer Teil des Abstimmungs-Flows (der
 * funktioniert über die PendingVotes-UI/Realtime-Sync ohnehin auch ohne
 * Push).
 */
export async function notifyVoteRequest(submissionId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.functions.invoke("notify-vote-request", { body: { submissionId } });
  } catch (err) {
    console.warn("notifyVoteRequest fehlgeschlagen (nicht kritisch):", err);
  }
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
    // uid()-Suffix: siehe subscribeToGroups() weiter oben.
    .channel(`bingo-${bingoId}-${uid()}`)
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
