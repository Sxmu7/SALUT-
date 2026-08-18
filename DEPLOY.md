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

## 5. (Optional) Automatische Push-Challenges im Party-Modus einrichten

Braucht Supabase (Schritt 4) und die [Supabase CLI](https://supabase.com/docs/guides/cli).
Läuft komplett serverseitig – funktioniert auch, wenn alle Teilnehmer die
PWA geschlossen haben. Ohne diese Schritte funktioniert die App ganz normal
weiter, nur der Schalter "🔔 Automatische Challenges" im Party-Modus bleibt
ohne Wirkung.

1. **VAPID-Schlüsselpaar erzeugen** (einmalig, lokal, keine Netzwerkverbindung
   nötig):
   ```bash
   npx web-push generate-vapid-keys
   ```
   Liefert einen `Public Key` und einen `Private Key`.

2. **`pg_cron` und `pg_net` aktivieren** – im Supabase Dashboard unter
   *Database → Extensions* beide suchen und aktivieren (oder per SQL-Editor:
   `create extension if not exists pg_cron; create extension if not exists pg_net;`).

3. **Edge Function deployen** (aus dem entpackten Projektordner):
   ```bash
   supabase login
   supabase link --project-ref <dein-project-ref>
   supabase functions deploy party-push-tick
   ```

4. **Secrets für die Edge Function setzen** (der Private Key darf NIEMALS
   ins Frontend/`.env.local`, nur hierhin):
   ```bash
   supabase secrets set \
     VAPID_PUBLIC_KEY=<Public Key aus Schritt 1> \
     VAPID_PRIVATE_KEY=<Private Key aus Schritt 1> \
     VAPID_SUBJECT=mailto:deine@email.de
   ```

5. **Cron-Zeitplan anlegen** – im SQL-Editor deines Supabase-Projekts (Werte
   aus `<project-ref>` und deinem `service_role`-Key einsetzen, siehe auch
   der auskommentierte Block am Ende von `supabase/schema.sql`):
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

6. **Client-Env-Var setzen** – in Vercel (und/oder `.env.local`):
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key aus Schritt 1>`, dann redeployen.

7. **Testen**: Party starten (Modi → Abend starten), im Event-Bildschirm den
   "🔔 Automatische Challenges"-Schalter aktivieren (Browser fragt nach der
   Notification-Berechtigung), Intervall wählen. Die erste Push-Challenge
   kommt beim nächsten Scheduler-Tick (max. 1 Minute, danach im gewählten
   Intervall). Fehlt eine Notification, zuerst `supabase functions logs
   party-push-tick` prüfen.

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
