import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Täglicher Cron-Job (siehe vercel.json -> crons), der prüft, ob heute
 * jemand Geburtstag hat, und automatisch ein Geburtstags-Event mit
 * kuratierten Challenges für die jeweilige Gruppe anlegt.
 *
 * Hinweis: Diese Route greift auf ein echtes Supabase-Projekt zu (siehe
 * supabase/schema.sql) und benötigt SUPABASE_SERVICE_ROLE_KEY als Server-Env.
 * Solange kein Supabase verbunden ist, läuft die App im lokalen Demo-Modus
 * und prüft Geburtstage stattdessen direkt im Browser beim Öffnen des
 * Dashboards (siehe src/lib/db.ts -> ensureBirthdayEvents).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({
      ok: true,
      mode: "demo",
      message:
        "Kein Supabase verbunden – Geburtstage werden im Demo-Modus clientseitig geprüft.",
    });
  }

  const supabase = createClient(url, serviceKey);
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  // Findet alle Profile, deren Geburtstag (MM-DD) heute ist.
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, name, birthday")
    .not("birthday", "is", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const birthdayProfiles = (profiles ?? []).filter((p) => {
    if (!p.birthday) return false;
    const d = new Date(p.birthday);
    return String(d.getMonth() + 1).padStart(2, "0") === mm && String(d.getDate()).padStart(2, "0") === dd;
  });

  let created = 0;
  for (const profile of birthdayProfiles) {
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", profile.id);

    for (const m of memberships ?? []) {
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("group_id", m.group_id)
        .eq("birthday_user_id", profile.id)
        .eq("type", "birthday")
        .gte("event_date", `${today.getFullYear()}-01-01`)
        .maybeSingle();

      if (existing) continue;

      await supabase.from("events").insert({
        group_id: m.group_id,
        title: `${profile.name}s Geburtstags-Party`,
        type: "birthday",
        emoji: "🎂",
        event_date: today.toISOString(),
        birthday_user_id: profile.id,
        status: "live",
      });
      created += 1;
    }
  }

  return NextResponse.json({ ok: true, mode: "supabase", checked: birthdayProfiles.length, created });
}
