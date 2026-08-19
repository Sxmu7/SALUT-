"use client";

/**
 * Einheitliche, asynchrone Datenschicht für die App. Nutzt Supabase, sobald
 * NEXT_PUBLIC_SUPABASE_URL/-ANON_KEY gesetzt sind (siehe .env.example),
 * sonst weiterhin den lokalen Demo-Modus (localStorage, lib/db.ts) –
 * unverändert wie bisher, damit die App ganz ohne Konfiguration exakt so
 * funktioniert wie vorher.
 *
 * Hooks/Seiten sollten ab jetzt nur noch gegen dieses Modul sprechen statt
 * direkt gegen lib/db.ts oder lib/supabase/queries.ts.
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
  BingoSnapshot,
  BingoWinCondition,
} from "@/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import * as local from "@/lib/db";
import * as remote from "@/lib/supabase/queries";
import { LS_KEYS, writeLS } from "@/lib/storage";

// Absichtlich nicht "use..." genannt: react-hooks/rules-of-hooks würde
// jeden Namen mit diesem Präfix als React-Hook behandeln, obwohl das hier
// eine ganz normale Funktion ist.
function isRemoteMode(): boolean {
  return isSupabaseConfigured();
}

export { isRemoteMode };

// "Onboarding gesehen" ist bewusst ein rein lokales Geräte-Flag, unabhängig
// vom Backend – ob JEMAND auf diesem Handy die Einführung schon gesehen
// hat, muss nicht zwischen Geräten synchron sein.
export async function isOnboarded(): Promise<boolean> {
  return local.isOnboarded();
}

export async function getCurrentProfile(): Promise<Profile | null> {
  return isRemoteMode() ? remote.getCurrentProfile() : local.getCurrentProfile();
}

export async function createOrUpdateProfile(patch: Partial<Profile>): Promise<Profile> {
  const profile = isRemoteMode()
    ? await remote.createOrUpdateProfile(patch)
    : local.createOrUpdateProfile(patch);
  writeLS(LS_KEYS.onboarded, true);
  return profile;
}

export async function listGroups(): Promise<Group[]> {
  return isRemoteMode() ? remote.listGroups() : local.listGroups();
}

export async function createGroup(name: string, emoji: string): Promise<Group> {
  return isRemoteMode() ? remote.createGroup(name, emoji) : local.createGroup(name, emoji);
}

export async function joinGroupByCode(code: string): Promise<Group | null> {
  return isRemoteMode() ? remote.joinGroupByCode(code) : local.joinGroupByCode(code);
}

export async function listGroupMembers(groupId: string): Promise<Profile[]> {
  return isRemoteMode() ? remote.listGroupMembers(groupId) : local.listGroupMembers(groupId);
}

export async function leaveGroup(groupId: string): Promise<void> {
  return isRemoteMode() ? remote.leaveGroup(groupId) : local.leaveGroup(groupId);
}

export async function kickGroupMember(groupId: string, userId: string): Promise<void> {
  return isRemoteMode()
    ? remote.kickGroupMember(groupId, userId)
    : local.kickGroupMember(groupId, userId);
}

export async function deleteGroup(groupId: string): Promise<void> {
  return isRemoteMode() ? remote.deleteGroup(groupId) : local.deleteGroup(groupId);
}

/** Live-Updates für Gruppen/Mitgliedschaften (Beitritte, Austritte,
 * Löschungen anderer Mitglieder). Im Demo-Modus No-Op, da dort ohnehin
 * nur ein Gerät existiert. */
export function subscribeToGroups(onChange: () => void): () => void {
  if (!isRemoteMode()) return () => {};
  return remote.subscribeToGroups(onChange);
}

export async function listAllChallenges(): Promise<Challenge[]> {
  return isRemoteMode() ? remote.listAllChallenges() : local.listAllChallenges();
}

export async function getAnyChallenge(id: string): Promise<Challenge | undefined> {
  return isRemoteMode() ? remote.getAnyChallenge(id) : local.getAnyChallenge(id);
}

export async function addCustomChallenges(newOnes: Challenge[]): Promise<Challenge[]> {
  return isRemoteMode() ? remote.addCustomChallenges(newOnes) : local.addCustomChallenges(newOnes);
}

export async function listEvents(groupId: string): Promise<GameEvent[]> {
  return isRemoteMode() ? remote.listEvents(groupId) : local.listEvents(groupId);
}

export async function getEvent(id: string): Promise<GameEvent | undefined> {
  return isRemoteMode() ? remote.getEvent(id) : local.getEvent(id);
}

export async function ensureBirthdayEvents(): Promise<GameEvent[]> {
  return isRemoteMode() ? remote.ensureBirthdayEvents() : local.ensureBirthdayEvents();
}

export async function pickChallengeForEvent(
  eventId: string,
  categoryId: CategoryId
): Promise<Challenge | null> {
  return isRemoteMode()
    ? remote.pickChallengeForEvent(eventId, categoryId)
    : local.pickChallengeForEvent(eventId, categoryId);
}

export async function getOrCreateQuickEvent(groupId: string): Promise<GameEvent> {
  return isRemoteMode() ? remote.getOrCreateQuickEvent(groupId) : local.getOrCreateQuickEvent(groupId);
}

export async function addChallengeToEvent(
  eventId: string,
  challengeId: string
): Promise<GameEvent | undefined> {
  return isRemoteMode()
    ? remote.addChallengeToEvent(eventId, challengeId)
    : local.addChallengeToEvent(eventId, challengeId);
}

export async function getNextHighlight(groupId: string): Promise<{
  date: Date;
  label: string;
  emoji: string;
  eventId?: string;
} | null> {
  return isRemoteMode() ? remote.getNextHighlight(groupId) : local.getNextHighlight(groupId);
}

export async function listSubmissions(eventId: string): Promise<Submission[]> {
  return isRemoteMode() ? remote.listSubmissions(eventId) : local.listSubmissions(eventId);
}

export async function listSubmissionsForUser(
  eventId: string,
  userId: string
): Promise<Submission[]> {
  return isRemoteMode()
    ? remote.listSubmissionsForUser(eventId, userId)
    : local.listSubmissionsForUser(eventId, userId);
}

export async function submitChallengeProof(input: {
  eventId: string;
  challengeId: string;
  userId: string;
  proofDataUrl?: string;
  note?: string;
}): Promise<Submission> {
  return isRemoteMode() ? remote.submitChallengeProof(input) : local.submitChallengeProof(input);
}

/** Challenge bewusst ablehnen statt einreichen (siehe queries.ts/db.ts) –
 * legt direkt eine "rejected"-Submission ohne Abstimmung an. */
export async function declineChallenge(input: {
  eventId: string;
  challengeId: string;
  userId: string;
}): Promise<Submission> {
  return isRemoteMode() ? remote.declineChallenge(input) : local.declineChallenge(input);
}

export async function castVote(
  submissionId: string,
  voterId: string,
  approve: boolean
): Promise<Submission | null> {
  return isRemoteMode()
    ? remote.castVote(submissionId, voterId, approve)
    : local.castVote(submissionId, voterId, approve);
}

export async function computeRanking(groupId: string): Promise<RankingEntry[]> {
  return isRemoteMode() ? remote.computeRanking(groupId) : local.computeRanking(groupId);
}

// ---------------------------- Reihum-Modus & Abend-Ziel ----------------------------
// Funktioniert bewusst in BEIDEN Modi (lokal + Supabase), anders als
// Party-Push/Bingo weiter unten – Reihum-Modus und "Abend beenden" sind
// auch ganz ohne Backend sinnvoll.

export async function setTurnMode(eventId: string, enabled: boolean): Promise<GameEvent | undefined> {
  return isRemoteMode() ? remote.setTurnMode(eventId, enabled) : local.setTurnMode(eventId, enabled);
}

export async function setEventTarget(
  eventId: string,
  target: number | null
): Promise<GameEvent | undefined> {
  return isRemoteMode()
    ? remote.setEventTarget(eventId, target)
    : local.setEventTarget(eventId, target);
}

export async function endEvent(eventId: string): Promise<GameEvent | undefined> {
  return isRemoteMode() ? remote.endEvent(eventId) : local.endEvent(eventId);
}

// ---------------------------- Push-Benachrichtigung bei abgeschlossener Challenge ----------------------------
// "QuizDuell-Style": sobald irgendjemandes Challenge genehmigt wird,
// bekommen alle anderen Gruppenmitglieder mit aktiver Push-Subscription
// eine Benachrichtigung (siehe notify-challenge-completed Edge Function).
// Nutzt dieselbe push_subscriptions-Tabelle/denselben Umschalter wie
// notifyVoteRequest oben – kein separates Opt-in nötig.

export async function notifyChallengeCompleted(submissionId: string): Promise<void> {
  if (!isRemoteMode()) return;
  return remote.notifyChallengeCompleted(submissionId);
}

/**
 * Live-Updates für eine Submission über Supabase Realtime. Im Demo-Modus
 * gibt es kein Realtime – Aufrufer bekommen dort eine No-Op-Unsubscribe-
 * Funktion zurück (und pollen selbst weiter, siehe die Challenge-Seite).
 */
export function subscribeToSubmission(
  submissionId: string,
  onChange: (submission: Submission) => void
): () => void {
  if (!isRemoteMode()) return () => {};
  return remote.subscribeToSubmission(submissionId, onChange);
}

/** Live-Updates für alle Submissions eines Events (neue Einreichungen +
 * Stimmen) – im Demo-Modus No-Op, da dort ohnehin nur Bots mitstimmen
 * (kein zweites echtes Gerät, das live etwas einreichen könnte). */
export function subscribeToEventSubmissions(
  eventId: string,
  onChange: (submissions: Submission[]) => void
): () => void {
  if (!isRemoteMode()) return () => {};
  return remote.subscribeToEventSubmissions(eventId, onChange);
}

// ---------------------------- Party-Push (Party-Modus) ----------------------------
// Automatische Challenges per Push laufen komplett serverseitig (Supabase
// Edge Function + pg_cron, siehe supabase/functions/party-push-tick) und
// brauchen deshalb ein echtes Supabase-Projekt. Im lokalen Demo-Modus gibt
// es dafür keinen Server – die UI blendet den entsprechenden Schalter dort
// aus (siehe isRemoteMode()-Check in events/[id]/page.tsx), diese
// Funktionen werfen also im Normalfall dort nie.

function requireRemoteMode(feature: string): void {
  if (!isRemoteMode()) {
    throw new Error(
      `${feature} steht nur im Supabase-Modus zur Verfügung (siehe SETUP.md).`
    );
  }
}

export async function getPartyPushState(eventId: string): Promise<PartyPushState | null> {
  requireRemoteMode("Automatische Push-Challenges");
  return remote.getPartyPushState(eventId);
}

export async function setPartyPushConfig(
  eventId: string,
  config: { enabled: boolean; intervalMinutes?: number; random?: boolean; noDuplicates?: boolean }
): Promise<PartyPushState> {
  requireRemoteMode("Automatische Push-Challenges");
  return remote.setPartyPushConfig(eventId, config);
}

export async function savePushSubscription(sub: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  requireRemoteMode("Automatische Push-Challenges");
  return remote.savePushSubscription(sub);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  requireRemoteMode("Benachrichtigungen");
  return remote.deletePushSubscription(endpoint);
}

// ---------------------------- Push-Benachrichtigung bei neuer Einreichung ----------------------------
// Wird automatisch von submitChallengeProof() im Supabase-Modus ausgelöst
// (siehe queries.ts) - hier nur der Vollständigkeit halber als Re-Export,
// falls eine Seite sie mal manuell auslösen möchte (z.B. Retry-Button).

export async function notifyVoteRequest(submissionId: string): Promise<void> {
  if (!isRemoteMode()) return;
  return remote.notifyVoteRequest(submissionId);
}

// ---------------------------- Party-Bingo (Party-Modus) ----------------------------
// Kartenerzeugung und Gewinner-Ermittlung laufen serverseitig (siehe
// schema.sql) und brauchen deshalb ein echtes Supabase-Projekt – im
// lokalen Demo-Modus blendet die UI Party-Bingo entsprechend aus (siehe
// isRemoteMode()-Check in events/[id]/page.tsx).

export async function getBingoSnapshot(eventId: string): Promise<BingoSnapshot | null> {
  requireRemoteMode("Party-Bingo");
  return remote.getBingoSnapshot(eventId);
}

export async function startPartyBingo(
  eventId: string,
  config?: {
    gridSize?: number;
    freeCenter?: boolean;
    winCondition?: BingoWinCondition;
    requireConfirmations?: number;
  }
): Promise<PartyBingoConfig> {
  requireRemoteMode("Party-Bingo");
  return remote.startPartyBingo(eventId, config);
}

export async function reportBingoEvent(bingoEventId: string): Promise<void> {
  requireRemoteMode("Party-Bingo");
  return remote.reportBingoEvent(bingoEventId);
}

export async function finishPartyBingo(bingoId: string): Promise<PartyBingoConfig> {
  requireRemoteMode("Party-Bingo");
  return remote.finishPartyBingo(bingoId);
}

/** Live-Updates für eine laufende Bingo-Runde. Im Demo-Modus (kein
 * Realtime, kein Server) gibt es No-Op-Unsubscribe zurück – die UI wird
 * dort ohnehin gar nicht gerendert. */
export function subscribeToBingo(
  eventId: string,
  bingoId: string,
  onChange: (snapshot: BingoSnapshot | null) => void
): () => void {
  if (!isRemoteMode()) return () => {};
  return remote.subscribeToBingo(eventId, bingoId, onChange);
}
