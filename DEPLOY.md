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

Siehe `SETUP.md` im Projekt – kurz zusammengefasst:

1. Supabase-Projekt anlegen, `supabase/schema.sql` im SQL-Editor ausführen.
2. In Vercel → Project Settings → Environment Variables setzen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (für den täglichen Geburtstags-Cron)
   - optional `CRON_SECRET`
3. Redeploy anstoßen.

## Warum kein Auto-Deploy durch mich?

Der verbundene Vercel-Account (Team "Sxmu's projects") hat aktuell keine
Berechtigung, neue Projekte per API anzulegen (403 „You don't have
permission to create a project"). Das lässt sich in den Vercel-
Teameinstellungen unter **Team Members and Roles** anpassen, oder du
deployst wie oben beschrieben direkt über die Vercel-Weboberfläche /
GitHub-Import – das funktioniert unabhängig von dieser Berechtigung.
