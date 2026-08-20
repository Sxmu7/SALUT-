// Salut! – Kollegen-Modus (Co-Worker) Push-Scheduler (Supabase Edge Function, Deno)
//
// Wird per pg_cron einmal pro Minute aufgerufen (siehe schema.sql, Abschnitt
// "Scheduler: pg_cron ruft die Edge Function jede Minute auf" – der
// Kollegen-Modus hat dort einen EIGENEN Cron-Eintrag "coworker-push-tick",
// unabhängig von "party-push-tick"). Anders als im Party-Modus (dort ein
// optionaler Zusatz-Toggle) IST der automatische 5-Minuten-Push hier der
// Kernmechanismus: alle 5 Minuten innerhalb der Arbeitszeit (Mo-Fr
// 09:00-12:30 & 14:00-17:00, Europe/Berlin) kommt eine neue Challenge rein,
// wer zuerst annimmt, muss sie machen.
//
// Ablauf pro Aufruf:
//   1. claim_due_coworker_pushes() (SQL-RPC) claimt atomar alle Kollegen-
//      Events, deren next_push_at fällig ist, und plant sofort den
//      nächsten gültigen Arbeitszeit-Slot ein (next_coworker_push_time()) –
//      verhindert doppelte Verarbeitung bei überlappenden Scheduler-Läufen.
//   2. Für jedes geclaimte Event: pick_next_coworker_push_challenge() prüft
//      selbst (a) ob "jetzt" wirklich innerhalb der Arbeitszeit liegt, und
//      (b) ob eine bereits angenommene Challenge noch auf ihre Abstimmung
//      wartet (Voting-Gate: "Spieler 1 lädt hoch, der Rest bestätigt
//      ja/nein, ERST DANACH geht's weiter") – in beiden Fällen kommt kein
//      neuer Push. Sonst wählt sie eine neue Challenge aus dem separaten
//      coworker_challenges-Katalog.
//   3. Alle Mitglieder der zugehörigen Kollegen-Gruppe + ihre Push-
//      Subscriptions werden geladen und per Web Push benachrichtigt. Ein
//      Fehlschlag bei einem Gerät/Event bricht die anderen nicht ab.
//      Ungültige Subscriptions (404/410) werden aus der Datenbank entfernt.
//
// Secrets: dieselben VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// wie party-push-tick (siehe DEPLOY.md, Abschnitt 5) – kein separates Setup.

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
      "'supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...' " +
      "(dieselben Secrets wie für party-push-tick, kein separates Setup nötig)."
  );
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface CoworkerEventRow {
  id: string;
  coworker_group_id: string;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async () => {
  const { data: due, error: claimError } = await supabase.rpc("claim_due_coworker_pushes");
  if (claimError) {
    console.error("claim_due_coworker_pushes fehlgeschlagen:", claimError);
    return json({ error: claimError.message }, 500);
  }

  const dueEvents = (due ?? []) as CoworkerEventRow[];
  const results = await Promise.all(
    dueEvents.map(async (event) => {
      try {
        return { eventId: event.id, ...(await processCoworkerEvent(event.id)) };
      } catch (err) {
        // Ein kaputtes Event (fehlende Gruppe, DB-Fehler, ...) darf die
        // Verarbeitung der anderen fälligen Events nicht abbrechen.
        console.error("Kollegen-Push fehlgeschlagen für", event.id, err);
        return { eventId: event.id, error: String(err) };
      }
    })
  );

  return json({ processed: results.length, results });
});

async function processCoworkerEvent(eventId: string) {
  const { data: challenge, error: pickError } = await supabase.rpc(
    "pick_next_coworker_push_challenge",
    { p_event_id: eventId }
  );
  if (pickError) throw pickError;
  if (!challenge) {
    // null bedeutet je nach Situation: außerhalb der Arbeitszeit, kein
    // Katalogeintrag mehr übrig, oder (am häufigsten) eine bereits
    // angenommene Challenge wartet noch auf ihre Abstimmung.
    return { sent: 0, failed: 0, reason: "no_challenge_available_or_gated" };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("coworker_group_id")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!event?.coworker_group_id) return { sent: 0, failed: 0, reason: "event_not_found" };

  const { data: members, error: membersError } = await supabase
    .from("coworker_group_members")
    .select("user_id")
    .eq("group_id", event.coworker_group_id as string);
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
    title: "💼 Neue Kollegen-Challenge!",
    body: (challenge.title as string) || "Eine neue Challenge wartet – wer schnappt sie sich?",
    eventId,
    challengeId: challenge.id,
    url: `/coworker/events/${eventId}/challenges/${challenge.id}`,
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
