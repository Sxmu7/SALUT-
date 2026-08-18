# Salut! mit Supabase verbinden (optional)

Die App funktioniert direkt nach dem Deploy im lokalen Demo-Modus – kein
Supabase nötig zum Ausprobieren. Für echtes Multi-Device-Play mit deiner
ganzen Crew (mehrere Handys, echte Konten, persistente Beweisfotos/-videos,
Live-Abstimmung über Geräte hinweg, echter täglicher Cron-Job) verbinde ein
Supabase-Projekt:

1. Erstelle ein kostenloses Projekt auf [supabase.com](https://supabase.com).
2. Öffne den **SQL-Editor** und führe `supabase/schema.sql` aus diesem
   Repository komplett aus. Das legt an:
   - alle Tabellen (Profile, Gruppen, Events, Challenges, Beweise/Votes)
     samt Row-Level-Security-Policies,
   - den Storage-Bucket `proofs` für Foto-/Videobeweise,
   - zwei Datenbankfunktionen (`join_group_by_code`, `cast_vote`), die
     Gruppenbeitritt per Code und die Abstimmungs-/Punktelogik serverseitig
     und race-sicher abwickeln,
   - einen Seed mit dem festen Grundset an ~36 Challenges, damit die
     eingebauten Challenges als echte Zeilen existieren (die App braucht
     das für Fremdschlüssel und die Punktevergabe beim Abstimmen).

   Das Skript ist idempotent (`if not exists` / `on conflict do nothing`) –
   erneutes Ausführen nach einem Update ist sicher.

3. Aktiviere unter **Authentication → Providers → Anonymous Sign-Ins**
   diese Option. Salut! ist als Party-App bewusst ohne Login-Zwang gebaut:
   jedes Gerät bekommt beim ersten Öffnen automatisch eine anonyme Supabase-
   Session, an die Profil/Punkte/Gruppen gebunden werden – kein Passwort,
   keine E-Mail-Bestätigung nötig. Ohne diesen Schalter schlägt die
   Anmeldung mit einer klaren Fehlermeldung fehl.
4. Kopiere aus **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` Key (geheim halten!) → `SUPABASE_SERVICE_ROLE_KEY`
5. Trage diese drei Variablen in **Vercel → Project Settings → Environment
   Variables** ein (lokal: `.env.example` nach `.env.local` kopieren und
   befüllen) und setze optional `CRON_SECRET` (ein beliebiges Passwort) zur
   Absicherung der Cron-Route.
6. Redeploy auslösen. Der tägliche Cron-Job (`vercel.json`, 06:00 UTC) prüft
   ab jetzt serverseitig auf Geburtstage und legt automatisch Events an –
   unabhängig davon, ob gerade jemand die App geöffnet hat.

## Wichtig: nicht live gegengetestet

Die Supabase-Anbindung wurde ohne Zugriff auf ein echtes Supabase-Projekt
gebaut (die Entwicklungsumgebung hat kein Netzwerk zu externen Diensten wie
Supabase). Schema, RLS-Policies und Queries wurden sorgfältig aufeinander
abgestimmt, aber bitte einmal mit einem echten Projekt durchklicken, bevor
du dich auf einer echten Party darauf verlässt: Gruppe erstellen, mit einem
zweiten Gerät/Browser-Profil per Code beitreten, eine Challenge würfeln,
Beweis einreichen, von beiden Geräten abstimmen, Ranking auf beiden Geräten
vergleichen.

## Architektur: wie der Umschalter funktioniert

`src/lib/data-layer.ts` ist die einzige Stelle, gegen die Hooks/Seiten
sprechen. Sie prüft `isSupabaseConfigured()` (aus
`src/lib/supabase/client.ts`, true sobald die beiden `NEXT_PUBLIC_SUPABASE_*`
-Variablen gesetzt sind) und leitet jeden Aufruf entweder an

- `src/lib/db.ts` – lokaler Demo-Modus, synchron auf localStorage, oder
- `src/lib/supabase/queries.ts` – echte Supabase-Queries, inkl. anonymer
  Auth-Bootstrap (`src/lib/supabase/auth.ts`) und Realtime-Subscriptions
  für Live-Abstimmung

weiter. Beide Implementierungen haben absichtlich identische Funktions-
signaturen, nur async statt sync. Wer die App um ein Feature erweitert,
sollte beide Seiten im Blick behalten (oder zumindest wissen, dass der
Demo-Modus die Referenzimplementierung ist, an der sich Supabase orientiert).

## Bekannte Limitierung, die auch mit Supabase bleibt

Eine frisch erstellte Gruppe mit nur einem Mitglied kann eine eingereichte
Challenge nicht bestätigen (0 mögliche Stimmen, aber 1 nötig) – das ist
Produktlogik in `cast_vote()`/`castVote()`, nicht ein Backend-Problem, und
in beiden Modi identisch. Sobald mindestens ein zweites Crew-Mitglied
beigetreten ist, funktioniert die Abstimmung normal.
