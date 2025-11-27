# Supabase configuration

Follow these steps to get the app talking to Supabase. These instructions assume you have an existing Supabase project.

## 1) Environment variables
Create a `.env.local` file in `coupleplay-web/`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

- `SUPABASE_SERVICE_ROLE_KEY` is required because the room creation API runs server-side and needs insert permissions. Keep it secret; do not ship it to the client.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` must have row-level security (RLS) policies configured to permit the client operations you allow.

## 2) Database schema
Create three tables: `rooms`, `players`, and `questions`.

Where to run this SQL:
- Supabase Dashboard → SQL Editor → new query → paste → Run.
- Or `supabase db remote commit` / `supabase db push` if you are using the Supabase CLI and migrations. Dashboard is the quickest if you’re unsure.

```sql
-- rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('random-questions', 'idea-matching')),
  hide_questions boolean not null default false,
  stage text not null default 'collect' check (stage in ('collect', 'answer', 'review')),
  current_question_id uuid null references public.questions(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- players
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null,
  role text not null check (role in ('host', 'guest')),
  stage_one_done boolean default false,
  stage_two_done boolean default false,
  created_at timestamptz not null default now()
);

-- questions (also used for ideas in the idea-matching game)
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author_id uuid not null references public.players(id) on delete cascade,
  text text not null,
  answering_player_id uuid null references public.players(id) on delete set null,
  answer_text text null,
  writer_done boolean default false,
  reader_done boolean default false,
  created_at timestamptz not null default now()
);
```

## 3) Row Level Security (RLS)
Enable RLS on all three tables, then add policies that align with your gameplay rules. Use the same place as above (SQL Editor or CLI). Order matters: enable RLS first, then add policies.

```sql
alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.questions enable row level security;

-- Example policies (adjust as needed)
create policy "anon select own room" on public.rooms
  for select using (true);

create policy "anon insert room" on public.rooms
  for insert with check (true);

create policy "anon select players by room" on public.players
  for select using (exists (select 1 from public.rooms r where r.id = room_id));

create policy "anon insert player" on public.players
  for insert with check (exists (select 1 from public.rooms r where r.id = room_id));

create policy "anon select questions by room" on public.questions
  for select using (exists (select 1 from public.rooms r where r.id = room_id));

create policy "anon insert question" on public.questions
  for insert with check (exists (select 1 from public.rooms r where r.id = room_id));
```

Tighten these policies before production (e.g., validate membership in the room via JWT claims, restrict updates to owners, and limit deletes).

## 4) Service role usage
Server routes (`/api/rooms`) use `SUPABASE_SERVICE_ROLE_KEY` for inserts. Avoid exposing this key to the browser; keep it only on the server or in Vercel project env vars marked as “encrypted” and not available to the client.

## 5) Local checks
1. `npm install`
2. `npm run dev`
3. Hit `POST /api/rooms` with JSON `{ "hostName": "Alex", "game": "random-questions", "hideQuestions": true }` and confirm a room/player record appears in Supabase.

If the request fails with “Supabase is not configured”, double-check your env vars and restart `npm run dev` after setting them.
