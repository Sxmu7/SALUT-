# Salut! mit Supabase verbinden (optional)

Die App funktioniert direkt nach dem Deploy im lokalen Demo-Modus. Für echtes
Multi-Device-Play mit deiner ganzen Crew (mehrere Handys, echte Konten,
persistente Beweisfotos/-videos, echter täglicher Cron-Job) verbinde ein
Supabase-Projekt:

1. Erstelle ein kostenloses Projekt auf [supabase.com](https://supabase.com).
2. Öffne den **SQL-Editor** und führe `supabase/schema.sql` aus diesem
   Repository komplett aus. Das legt alle Tabellen (Profile, Gruppen,
   Events, Challenges, Beweise/Votes), Row-Level-Security-Policies und den
   Storage-Bucket `proofs` für Foto-/Videobeweise an.
3. Aktiviere unter **Authentication → Providers** z. B. "Email" (Magic Link)
   oder einen Social-Login deiner Wahl.
4. Kopiere aus **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` Key (geheim halten!) → `SUPABASE_SERVICE_ROLE_KEY`
5. Trage diese drei Variablen in **Vercel → Project Settings → Environment
   Variables** ein und setze optional `CRON_SECRET` (ein beliebiges Passwort)
   zur Absicherung der Cron-Route.
6. Redeploy auslösen. Der tägliche Cron-Job (`vercel.json`, 06:00 UTC) prüft
   ab jetzt serverseitig auf Geburtstage und legt automatisch Events an.

## Von Demo-Modus zu Supabase im Code

`src/lib/db.ts` bündelt alle Datenzugriffe (Profile, Gruppen, Events,
Submissions, Voting, Ranking) hinter klar benannten Funktionen. Die
Tabellenstruktur in `supabase/schema.sql` ist bewusst 1:1 auf diese
Funktionen gemappt – jede Funktion lässt sich einzeln von
`localStorage`-Zugriffen auf `@supabase/supabase-js`-Queries (Client aus
`src/lib/supabase/client.ts`) umstellen, ohne dass sich an den Aufrufstellen
in den Seiten/Components etwas ändert.
