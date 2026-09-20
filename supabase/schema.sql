-- Supabase schema for the Upright home-gym tracker.
-- Run in the Supabase SQL editor, or hand this file to Claude Code / the Supabase CLI.
--
-- Design note: `logs` / `carry_logs` are stored as JSONB in the exact shape the app
-- already produces (e.g. {"latpulldown":[{"done":true,"weight":"20","reps":"10"}, ...]}),
-- so seed-history.json can be imported almost as-is and the app's existing rendering
-- logic (SessionExerciseRow, charts, progression calc) barely has to change.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date timestamptz not null,
  session_type text not null check (session_type in ('A','B')),
  phase integer not null default 0,
  logs jsonb not null default '{}'::jsonb,
  carry_logs jsonb not null default '{}'::jsonb,
  volume integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_date_idx on public.sessions (user_id, session_date);

-- Exercises rolled forward but not yet completed; shown at the top of the next session.
create table if not exists public.pending_carry (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ex_id text not null,
  session_type text not null check (session_type in ('A','B')),
  from_date timestamptz not null,
  sets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Body-log check-ins. photo_ref is the free-text "IMG_9260, 4 Jul" pointer used today;
-- photo_path is optional, for a copy uploaded to Supabase Storage instead.
create table if not exists public.body_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date timestamptz not null default now(),
  feel text,
  note text,
  measurements text,
  photo_ref text,
  photo_path text,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;
alter table public.pending_carry enable row level security;
alter table public.body_log enable row level security;

create policy "select own sessions" on public.sessions for select using (auth.uid() = user_id);
create policy "insert own sessions" on public.sessions for insert with check (auth.uid() = user_id);
create policy "update own sessions" on public.sessions for update using (auth.uid() = user_id);
create policy "delete own sessions" on public.sessions for delete using (auth.uid() = user_id);

create policy "select own carry" on public.pending_carry for select using (auth.uid() = user_id);
create policy "insert own carry" on public.pending_carry for insert with check (auth.uid() = user_id);
create policy "update own carry" on public.pending_carry for update using (auth.uid() = user_id);
create policy "delete own carry" on public.pending_carry for delete using (auth.uid() = user_id);

create policy "select own body log" on public.body_log for select using (auth.uid() = user_id);
create policy "insert own body log" on public.body_log for insert with check (auth.uid() = user_id);
create policy "update own body log" on public.body_log for update using (auth.uid() = user_id);
create policy "delete own body log" on public.body_log for delete using (auth.uid() = user_id);

-- Storage bucket for body-log progress photos. Each user's files live under a
-- path prefixed with their own auth.uid(), e.g. `<user_id>/1737400000-photo.jpg`,
-- so RLS on storage.objects can scope access using the first path segment.
insert into storage.buckets (id, name, public)
values ('body-photos', 'body-photos', false)
on conflict (id) do nothing;

create policy "select own body photos" on storage.objects for select
  using (bucket_id = 'body-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "insert own body photos" on storage.objects for insert
  with check (bucket_id = 'body-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "update own body photos" on storage.objects for update
  using (bucket_id = 'body-photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "delete own body photos" on storage.objects for delete
  using (bucket_id = 'body-photos' and auth.uid()::text = (storage.foldername(name))[1]);
