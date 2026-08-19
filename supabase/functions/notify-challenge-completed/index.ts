// Salut! – "Jemand hat eine Challenge gemeistert" (QuizDuell-Style)
// (Supabase Edge Function, Deno)
//
// Wird DIREKT vom Client aufgerufen, sobald eine Submission genehmigt wird
// (egal ob per Abstimmung über cast_vote() oder sofort bei proofType="none"
// – siehe castVote()/submitChallengeProof() in lib/supabase/queries.ts).
// Anders als notify-vote-request geht diese Push an ALLE anderen
// Gruppenmitglieder, nicht nur an die, die noch abstimmen müssen – das
// Prinzip ist wie bei QuizDuell: "dein Gegner war gerade dran".
//
// Reihum-Modus (turn_mode_enabled): die Person, die jetzt laut turn_index
// dran ist, bekommt eine eigene, umformulierte Nachricht ("Du bist dran!")
// statt der generischen "X hat's geschafft"-Meldung.
//
// Sicherheit: die Funktion prüft per JWT, dass der Aufrufer Mitglied
// derselben Gruppe wie das Event ist (nicht zwingend der Einreichende
// selbst, anders als bei notify-vote-request – hier kann sowohl der
// abstimmende Mitspieler als auch der Einreichende selbst der Auslöser
// sein). Nutzt dieselben VAPID-Secrets wie party-push-tick/
// notify-vote-request (siehe DEPLOY.md, Abschnitt 5), kein separates Setup.

import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY fehlen (sollten automatisch gesetzt sein)."
  );
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error(
    "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY nicht gesetzt. Siehe DEPLOY.md → " +
      "'supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...' " +
      "(dieselben Secrets wie für party-push-tick/notify-vote-request, kein separates Setup nötig)."
  );
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { submissionId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const submissionId = body.submissionId;
  if (!submissionId) return json({ error: "submissionId_missing" }, 400);

  // Aufrufer-Identität per JWT prüfen.
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL as string, ANON_KEY as string, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await callerClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data: submission, error: subError } = await supabase
    .from("submissions")
    .select("id, event_id, challenge_id, user_id, status, points_awarded")
    .eq("id", submissionId)
    .maybeSingle();
  if (subError) return json({ error: subError.message }, 500);
  if (!submission) return json({ error: "submission_not_found" }, 404);
  if (submission.status !== "approved") {
    return json({ sent: 0, reason: "not_approved" });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("group_id, turn_mode_enabled, turn_order, turn_index")
    .eq("id", submission.event_id)
    .maybeSingle();
  if (eventError) return json({ error: eventError.message }, 500);
  if (!event) return json({ error: "event_not_found" }, 404);

  // Aufrufer muss Mitglied derselben Gruppe sein – anders als bei
  // notify-vote-request nicht zwingend der Einreichende selbst (kann auch
  // der Mitspieler sein, dessen Stimme die Genehmigung ausgelöst hat).
  const { data: callerMembership } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", event.group_id as string)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerMembership) return json({ error: "forbidden" }, 403);

  const [{ data: challenge }, { data: submitter }] = await Promise.all([
    supabase
      .from("challenges")
      .select("title, icon")
      .eq("id", submission.challenge_id)
      .maybeSingle(),
    supabase.from("profiles").select("name").eq("id", submission.user_id).maybeSingle(),
  ]);

  const { data: members, error: membersError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", event.group_id as string)
    .neq("user_id", submission.user_id);
  if (membersError) return json({ error: membersError.message }, 500);

  const otherUserIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (otherUserIds.length === 0) return json({ sent: 0, failed: 0, reason: "no_other_members" });

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", otherUserIds);
  if (subsError) return json({ error: subsError.message }, 500);

  const subscriptions = (subs ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) return json({ sent: 0, failed: 0, reason: "no_subscriptions" });

  const submitterName = (submitter?.name as string | undefined) ?? "Jemand";
  const challengeTitle = (challenge?.title as string | undefined) ?? "eine Challenge";
  const challengeIcon = (challenge?.icon as string | undefined) ?? "🎉";
  const points = (submission.points_awarded as number | undefined) ?? 0;

  const turnOrder = (event.turn_order as string[] | null) ?? [];
  const turnIndex = (event.turn_index as number | null) ?? 0;
  const nextTurnUserId =
    (event.turn_mode_enabled as boolean) && turnOrder.length > 0 ? turnOrder[turnIndex] : null;

  function payloadFor(userId: string): string {
    if (nextTurnUserId && userId === nextTurnUserId) {
      return JSON.stringify({
        title: "🎲 Du bist dran!",
        body: `${submitterName} hat ${challengeIcon} ${challengeTitle} gemeistert – jetzt bist du an der Reihe.`,
        eventId: submission.event_id,
        url: `/events/${submission.event_id}`,
      });
    }
    return JSON.stringify({
      title: `🎉 ${submitterName} hat's geschafft!`,
      body: `${challengeIcon} ${challengeTitle} · +${points} Punkte`,
      eventId: submission.event_id,
      url: `/events/${submission.event_id}`,
    });
  }

  const outcomes = await Promise.allSettled(
    subscriptions.map((sub) => sendToSubscription(sub, payloadFor(sub.user_id)))
  );
  const sent = outcomes.filter((o) => o.status === "fulfilled").length;
  const failed = outcomes.length - sent;

  return json({ sent, failed });
});

async function sendToSubscription(sub: PushSubscriptionRow, payload: string) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number } | null)?.statusCode;
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
