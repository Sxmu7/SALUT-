# Salut! 🥂 – Die Trinkspiel App

Animierte, iPhone-optimierte Web-App fürs nächste Vorglühen: Trinkchallenges
mit Foto-/Videobeweis, lokale Gruppen-Abstimmung, ein Kickbase-artiges
Punktesystem und automatische Geburtstags-Events.

## Tech-Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** – Apple-Style Dark-UI, Glassmorphism
- **Framer Motion** – Seitenübergänge, Card-Animationen, Countdown-Flip, Konfetti
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) – vorbereitet für echtes Multi-Device-Backend
- **Vercel Cron** – täglicher Geburtstags-Check (`vercel.json`)

## Wie die App läuft

Die App startet automatisch im **lokalen Demo-Modus** (localStorage), solange
kein Supabase-Projekt verbunden ist. Dadurch funktioniert die Vercel-URL
sofort nach dem Deploy – inklusive Punktesystem, Ranking, Challenges,
Foto-/Video-Upload und simulierter Gruppen-Abstimmung mit vier Demo-Freunden.

Für echtes Multi-Device-/Multi-User-Play (mehrere echte Personen, gemeinsamer
Datenstand, echte Push-Cron-Automatik) folge `SETUP.md`, um ein Supabase-
Projekt anzubinden.

## Entwicklung

```bash
npm install
npm run dev
```

## Struktur

- `src/app` – Seiten (Landingpage, Onboarding, Dashboard, Challenges, Events, Ranking, Profil, Gruppen)
- `src/components` – UI-Bausteine (Buttons, Cards, Countdown, Challenge-Karten, Leaderboard, Landing)
- `src/lib/data` – feste Challenge- & Kategorien-Datenbank (Kickbase-Style Punkte)
- `src/lib/db.ts` – Datenschicht (aktuell localStorage-Demo-Modus)
- `src/lib/parseChallenges.ts` – einfacher Parser für Dokument-Upload eigener Challenges
- `supabase/schema.sql` – vollständiges Produktions-Schema inkl. RLS-Policies für Supabase
- `src/app/api/cron/birthdays` – Server-Route für den täglichen Geburtstags-Cron (Supabase-Modus)
