# Salut! – Selbst zu GitHub & Vercel deployen

Das Projekt liegt fertig gebaut, getestet (`npm run build` ✅) und mit
Git-Historie im ZIP. So bringst du es online:

## 1. Entpacken & lokal prüfen (optional)

```bash
unzip salut-app.zip -d salut
cd salut
npm install
npm run dev   # http://localhost:3000
```

## 2. Zu GitHub pushen

```bash
cd salut
gh repo create salut --private --source=. --remote=origin   # falls du gh nutzt
# ODER manuell:
git remote add origin https://github.com/<dein-user>/salut.git
git branch -M main
git push -u origin main
```

Das ZIP enthält bereits einen Git-Commit ("Initial commit: Salut!
Trinkspiel-App …"), du musst also nur noch ein leeres GitHub-Repo anlegen
und pushen.

## 3. Auf Vercel deployen

1. Auf [vercel.com/new](https://vercel.com/new) einloggen und **"Import Git
   Repository"** wählen, dann dein `salut`-Repo auswählen.
2. Vercel erkennt Next.js automatisch (Framework Preset: Next.js). Keine
   Build-Settings nötig.
3. Auf **Deploy** klicken – fertig. Die App läuft direkt im **lokalen
   Demo-Modus** (localStorage, 4 simulierte Crew-Mitglieder), du brauchst
   für den ersten Test kein Supabase.

## 4. (Optional) Supabase für echtes Multi-Device-Play verbinden

Ohne Supabase läuft jedes Gerät mit seinen eigenen lokalen Daten (kein
Teilen von Gruppen zwischen Handys). Mit Supabase verbunden wird daraus ein
echtes Multi-Device-Backend: eigene Konten (anonym, ohne Login-Zwang),
geteilte Gruppen/Events/Ranking, Beweisfotos im Storage statt im Browser,
Live-Abstimmung per Realtime, und der tägliche Geburtstags-Cron läuft
serverseitig statt nur beim Öffnen der App.

Siehe `SETUP.md` im Projekt für die volle Anleitung – kurz zusammengefasst:

1. Supabase-Projekt anlegen, `supabase/schema.sql` im SQL-Editor ausführen
   (Tabellen, RLS-Policies, zwei Datenbankfunktionen, Seed der festen
   Challenges).
2. Unter Authentication → Providers → **Anonymous Sign-Ins** aktivieren.
3. In Vercel → Project Settings → Environment Variables setzen (siehe auch
   `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (für den täglichen Geburtstags-Cron)
   - optional `CRON_SECRET`
4. Redeploy anstoßen.

Die Anbindung wurde in einer Umgebung ohne Netzwerkzugriff auf Supabase
gebaut und konnte daher nicht live gegen ein echtes Projekt getestet
werden – bitte einmal mit zwei Geräten/Browser-Profilen durchklicken, bevor
darauf eine echte Party läuft (Details dazu ebenfalls in `SETUP.md`).

## 5. (Optional) Push-Benachrichtigungen einrichten

Braucht Supabase (Schritt 4) und die [Supabase CLI](https://supabase.com/docs/guides/cli).
Es gibt vier unabhängige Push-Funktionen, die sich dieselben VAPID-Secrets
teilen:

- **🗳️ Abstimmungs-Benachrichtigungen** (`notify-vote-request`): sobald
  jemand eine Challenge samt Beweis einreicht, bekommen alle anderen
  Gruppen-/Team-Mitglieder mit aktiviertem Schalter sofort eine Push-
  Benachrichtigung ("Mia hat eingereicht!") und können direkt zum
  Abstimmen springen – auch bei geschlossener PWA. Funktioniert für BEIDE
  Modi (Trinkspiel und Kollegen-Modus, erkennt automatisch anhand des
  Events, welcher Katalog/Mitgliederkreis gilt). Wird DIREKT vom Client
  ausgelöst, braucht deshalb **kein** `pg_cron`/`pg_net`.
- **🎉 Challenge gemeistert** (`notify-challenge-completed`, QuizDuell-
  Style): sobald irgendjemandes Challenge genehmigt wird (per Abstimmung
  oder sofort bei Challenges ohne Beweis), bekommen alle anderen
  Mitglieder eine Push ("Mia hat's geschafft!"). Im Reihum-Modus bekommt
  die Person, die jetzt dran ist, zusätzlich eine eigene "Du bist
  dran!"-Nachricht. Funktioniert ebenfalls für beide Modi. DIREKT vom
  Client ausgelöst, **kein** `pg_cron`/`pg_net` nötig.
- **🔔 Automatische Challenges im Party-Modus** (`party-push-tick`):
  schickt im Party-Modus automatisch neue Challenges im gewählten Takt,
  komplett serverseitig per Scheduler. Braucht zusätzlich `pg_cron`/
  `pg_net` (Schritt 2 + 5 unten).
- **💼 Automatische Challenges im Kollegen-Modus** (`coworker-push-tick`):
  das Herzstück des Kollegen-Modus (nicht optional wie beim Party-Modus,
  sondern der Kernmechanismus) – schickt Mo-Fr 09:00-12:30 & 14:00-17:00
  (Europe/Berlin) automatisch alle 5 Minuten eine neue, alkoholfreie
  Arbeitsalltag-Challenge, wer zuerst annimmt muss sie machen. Wartet dabei
  automatisch, solange eine bereits angenommene Challenge noch auf ihre
  Abstimmung wartet (kein Zuspammen). Ebenfalls `pg_cron`/`pg_net` nötig,
  EIGENER Cron-Eintrag neben `party-push-tick` (Schritt 2 + 5 unten). Ohne
  diesen Schritt bleibt der Kollegen-Modus nutzbar (Gruppen erstellen,
  beitreten), aber es kommen nie automatisch Challenges rein.

Ohne diese Schritte funktioniert die App ganz normal weiter, nur die
Push-Schalter bleiben ohne Wirkung (der Kollegen-Modus bleibt ohne
`coworker-push-tick` komplett ohne automatische Challenges).

1. **VAPID-Schlüsselpaar erzeugen** (einmalig, lokal, keine Netzwerkverbindung
   nötig):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Liefert einen `Public Key` und einen `Private Key`.

2. **Nur für "Automatische Challenges": `pg_cron` und `pg_net` aktivieren**
   – im Supabase Dashboard unter *Database → Extensions* beide suchen und
   aktivieren (oder per SQL-Editor:
   `create extension if not exists pg_cron; create extension if not exists pg_net;`).
   Für die Abstimmungs-Benachrichtigungen kann dieser Schritt übersprungen
   werden.

3. **Alle vier Edge Functions deployen** (aus dem entpackten Projektordner):
   ```bash
   supabase login
   supabase link --project-ref <dein-project-ref>
   supabase functions deploy notify-vote-request
   supabase functions deploy notify-challenge-completed
   supabase functions deploy party-push-tick
   supabase functions deploy coworker-push-tick
   ```
   (Nur einzelne gewünscht? Einfach nur die passenden Zeilen ausführen –
   alle vier sind unabhängig voneinander. Nur Kollegen-Modus? Dann reichen
   `notify-vote-request`, `notify-challenge-completed` und
   `coworker-push-tick` – `party-push-tick` kann entfallen.)

4. **Secrets für die Edge Functions setzen** (gelten für beide Funktionen,
   der Private Key darf NIEMALS ins Frontend/`.env.local`, nur hierhin):
   ```bash
   supabase secrets set \
     VAPID_PUBLIC_KEY=<Public Key aus Schritt 1> \
     VAPID_PRIVATE_KEY=<Private Key aus Schritt 1> \
     VAPID_SUBJECT=mailto:deine@email.de
   ```

5. **Nur für "Automatische Challenges": Cron-Zeitplan(e) anlegen** – im
   SQL-Editor deines Supabase-Projekts (Werte aus `<project-ref>` und
   deinem `service_role`-Key einsetzen, siehe auch die auskommentierten
   Blöcke am Ende von `supabase/schema.sql`). Party-Modus:
   ```sql
   select cron.schedule(
     'party-push-tick',
     '* * * * *',
     $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/party-push-tick',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <service-role-key>',
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```
   Kollegen-Modus (EIGENER, zusätzlicher Cron-Eintrag – beide können
   parallel laufen):
   ```sql
   select cron.schedule(
     'coworker-push-tick',
     '* * * * *',
     $$
     select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/coworker-push-tick',
       headers := jsonb_build_object(
         'Authorization', 'Bearer <service-role-key>',
         'Content-Type', 'application/json'
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

6. **Client-Env-Var setzen** – in Vercel (und/oder `.env.local`):
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key aus Schritt 1>`, dann redeployen.
   Gilt für alle drei Push-Funktionen.

7. **Testen**:
   - Abstimmungs- & Challenge-Benachrichtigungen: ein beliebiges Event
     öffnen, "🔔 Live-Benachrichtigungen" aktivieren (Browser fragt nach
     der Notification-Berechtigung), auf einem ANDEREN Gerät/Profil eine
     Challenge einreichen (Push sollte sofort ankommen) und danach
     genehmigen lassen (zweite Push "hat's geschafft!" sollte folgen).
     Fehlt sie, `supabase functions logs notify-vote-request` bzw.
     `supabase functions logs notify-challenge-completed` prüfen.
   - iPhone/Safari: Push funktioniert dort nur, wenn die PWA vorher über
     den Teilen-Button → "Zum Home-Bildschirm" installiert wurde (iOS
     16.4+) – die App zeigt sonst automatisch einen entsprechenden
     Hinweis statt des Schalters.
   - Reihum-Modus: im Event-Bildschirm "🔄 Reihum-Modus" aktivieren, auf
     einem zweiten Gerät/Profil sollte bei genehmigter Challenge eine
     "Du bist dran!"-Push ankommen statt der generischen Meldung.
   - Automatische Challenges (Party-Modus): Party starten (Modi → Abend
     starten), im Event-Bildschirm den "🔔 Automatische Challenges"-
     Schalter aktivieren, Intervall wählen. Die erste Push-Challenge kommt
     beim nächsten Scheduler-Tick (max. 1 Minute, danach im gewählten
     Intervall). Fehlt eine Notification, `supabase functions logs
     party-push-tick` prüfen.
   - Automatische Challenges (Kollegen-Modus): Dashboard → "💼 Kollegen-
     Modus" → Team erstellen/beitreten → öffnet automatisch den Feed. Läuft
     `coworker-push-tick` per Cron UND ist gerade Arbeitszeit (Mo-Fr,
     09:00-12:30 oder 14:00-17:00, Europe/Berlin), kommt die erste
     Challenge beim nächsten Tick (max. 1 Minute). Außerhalb der
     Arbeitszeit passiert bewusst nichts – zum schnellen Testen notfalls
     kurz `next_coworker_push_time()`/die Arbeitszeitfenster in
     `supabase/schema.sql` anpassen oder einfach während der echten
     Arbeitszeit testen. Fehlt eine Notification trotz laufendem Cron,
     `supabase functions logs coworker-push-tick` prüfen. Wer zuerst im
     Feed auf eine offene Challenge tippt, bekommt sie zugewiesen – ein
     zweiter Tipp auf dieselbe Challenge (z.B. zweites Testgerät) muss mit
     "Zu spät" abgelehnt werden.

Auch dieser Teil konnte aus derselben netzwerklosen Umgebung heraus nicht
live gegen einen echten Push-Dienst getestet werden – Edge-Function-Code
und SQL wurden sorgfältig gegen die Web-Push-/pg_cron-Dokumentation gebaut,
aber ein erster Testlauf mit echtem Gerät vor einer echten Party ist
Pflicht, kein "nice to have".

## Warum kein Auto-Deploy durch mich?

Der verbundene Vercel-Account (Team "Sxmu's projects") hat aktuell keine
Berechtigung, neue Projekte per API anzulegen (403 „You don't have
permission to create a project"). Das lässt sich in den Vercel-
Teameinstellungen unter **Team Members and Roles** anpassen, oder du
deployst wie oben beschrieben direkt über die Vercel-Weboberfläche /
GitHub-Import – das funktioniert unabhängig von dieser Berechtigung.
