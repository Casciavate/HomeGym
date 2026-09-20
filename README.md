# Upright — home-gym tracker

A 2-day posture & strength training tracker: exercise library with form cues
and diagrams, phase-based programming, double-progression weight
suggestions, and a training log — backed by Supabase (Postgres + Auth +
Storage) instead of browser-only state.

## Stack

- [Vite](https://vitejs.dev/) + React
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Recharts](https://recharts.org/) for the volume/weight-trend charts
- [Supabase](https://supabase.com/) for auth (email magic link), Postgres, and photo storage

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL + anon key
npm run dev
```

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`. It creates the `sessions`,
   `pending_carry`, and `body_log` tables (all RLS-scoped to `auth.uid()`),
   plus a private `body-photos` Storage bucket with per-user folder policies.
3. In **Authentication -> URL Configuration**, add your local dev URL
   (`http://localhost:5173`) and your deployed URL to the allowed redirect
   URLs, so magic-link emails redirect back to the right place.
4. Copy the Project URL and `anon` public key from **Project Settings -> API**
   into `.env.local` (see `.env.example`).

### One-time seed migration

The first time a user signs in with an empty `sessions` table, the app
imports `supabase/seed-history.json`'s `history` array as their starting
log, so real training history captured before this migration isn't lost.
This only runs once per account (it checks whether `sessions` is empty).

## Data model

| Table            | Purpose                                                              |
|------------------|-----------------------------------------------------------------------|
| `sessions`       | One row per finished session (date, type A/B, phase, logs, volume). |
| `pending_carry`  | Exercises rolled over because a set was left unticked.               |
| `body_log`       | Check-ins: feel, notes, measurements, optional photo.                |

Photos are uploaded to the `body-photos` Storage bucket under
`<user_id>/<filename>`, and served via short-lived signed URLs (the bucket
is private, scoped per user).

The exercise library, form cues, diagrams, phase rules, and the
double-progression weight-suggestion logic (`suggestedWeight`, `newSets`,
`PROGRESSION_INCREMENT`, `PROGRESSION_REQUIRED`) are unchanged from the
original tracker — only the persistence layer was replaced.

## Deployment (Vercel)

1. Push this repo to GitHub.
2. In Vercel: **New Project** -> import the repo. Vercel auto-detects Vite.
3. Add two Environment Variables (Project Settings -> Environment Variables),
   matching `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Add the Vercel deployment URL to Supabase's **Authentication -> URL
   Configuration -> Redirect URLs**, or magic links won't redirect back
   into the app after sign-in.
5. Deploy.

## Build

```bash
npm run build
npm run preview
```
