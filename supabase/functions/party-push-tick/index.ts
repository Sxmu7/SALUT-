// Salut! – Party-Modus Push-Scheduler (Supabase Edge Function, Deno)
//
// Wird per pg_cron einmal pro Minute aufgerufen (siehe schema.sql,
// Abschnitt "Scheduler: pg_cron ruft die Edge Function jede Minute auf").
// Bewusst KEIN Browser-Timer: diese Funktion läuft serverseitig, völlig
// unabhängig davon, ob irgendein Teilnehmer die PWA gerade offen hat.
//
// Ablauf pro Aufruf:
//   1. claim_due_party_pushes() (SQL-RPC) claimt atomar alle Partys, deren
//      eigenes Intervall abgelaufen ist, und setzt sofort den nächsten
//      Zeitpunkt weiter - das verhindert doppelte Verarbeitung bei
//      überlappenden/parallelen Scheduler-Läufen.
//   2. Für jede geclaimte Party: pick_next_party_push_challenge() wählt
//      serverseitig eine noch nicht im aktuellen Zyklus verwendete
//      Challenge aus und markiert sie als verwendet.
//   3. Alle Mitglieder der zugehörigen Gruppe + ihre Push-Subscriptions
//      werden geladen und per Web Push benachrichtigt. Ein Fehlschlag bei
//      einem Gerät/einer Party bricht die anderen nicht ab (Promise.
//      allSettled + try/catch je Party). Ungültige Subscriptions (404/410
//      = vom Browser verworfen) werden aus der Datenbank entfernt.
//
// Secrets (per `supabase secrets set ...`, siehe DEPLOY.md):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:-Adresse)
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY sind in jeder Edge Function
// automatisch als Env-Var vorhanden, dafür ist kein eigenes Secret nötig.

import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (sollten automatisch gesetzt sein).");
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error(
    "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY nicht gesetzt. Siehe DEPLOY.md → " +
      "'supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...'"
  );
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface PartyPushState {
  event_id: string;
  push_enabled: boolean;
  interval_minutes: number;
  random_pick: boolean;
  no_duplicates: boolean;
  cycle: number;
  next_push_at: string | null;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async () => {
  const { data: due, error: claimError } = await supabase.rpc("claim_due_party_pushes");
  if (claimError) {
    console.error("claim_due_party_pushes fehlgeschlagen:", claimError);
    return json({ error: claimError.message }, 500);
  }

  const dueStates = (due ?? []) as PartyPushState[];
  const results = await Promise.all(
    dueStates.map(async (state) => {
      try {
        return { eventId: state.event_id, ...(await processParty(state.event_id)) };
      } catch (err) {
        // Eine kaputte Party (fehlende Gruppe, DB-Fehler, ...) darf die
        // Verarbeitung der anderen fälligen Partys nicht abbrechen.
        console.error("Party-Push fehlgeschlagen für", state.event_id, err);
        return { eventId: state.event_id, error: String(err) };
      }
    })
  );

  return json({ processed: results.length, results });
});

async function processParty(eventId: string) {
  const { data: challenge, error: pickError } = await supabase.rpc(
    "pick_next_party_push_challenge",
    { p_event_id: eventId }
  );
  if (pickError) throw pickError;
  if (!challenge) return { sent: 0, failed: 0, reason: "no_challenge_available" };

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("group_id")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event) return { sent: 0, failed: 0, reason: "event_not_found" };

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", event.group_id as string);
  if (membersError) throw membersError;

  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return { sent: 0, failed: 0, reason: "no_members" };

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (subsError) throw subsError;

  const subscriptions = (subs ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) return { sent: 0, failed: 0, reason: "no_subscriptions" };

  const payload = JSON.stringify({
    title: "🔥 Neue Challenge!",
    body: (challenge.title as string) || "Deine neue Party-Challenge wartet auf dich.",
    eventId,
    challengeId: challenge.id,
    url: `/events/${eventId}/challenges/${challenge.id}`,
  });

  const outcomes = await Promise.allSettled(
    subscriptions.map((sub) => sendToSubscription(sub, payload))
  );

  const sent = outcomes.filter((o) => o.status === "fulfilled").length;
  const failed = outcomes.length - sent;
  return { sent, failed, challengeId: challenge.id as string };
}

async function sendToSubscription(sub: PushSubscriptionRow, payload: string) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number } | null)?.statusCode;
    // 404/410 = der Browser hat die Subscription verworfen (App
    // deinstalliert, Berechtigung entzogen, ...) - dauerhaft ungültig,
    // deshalb aus der Datenbank entfernen statt bei jedem Tick erneut zu
    // fehlschlagen. Andere Fehlercodes (z.B. vorübergehende Netzwerkfehler
    // beim Push-Dienst) lassen die Subscription bewusst bestehen.
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
    throw err;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
