-- MindFlow — Supabase schema (run in the SQL Editor).
-- Per-user data with Row Level Security: each user can only see/modify their own rows.

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── settings (one row per user) ──────────────────────────────────────────────
create table if not exists public.settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

-- `for all` covers SELECT/INSERT/UPDATE/DELETE (UPDATE needs SELECT visibility).
create policy "settings: own rows" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── replies (reply history) ──────────────────────────────────────────────────
create table if not exists public.replies (
  id         text primary key,           -- client session id
  user_id    uuid not null references auth.users(id) on delete cascade,
  app        text,
  transcript text,
  reply      text,
  created_at timestamptz not null default now()
);
alter table public.replies enable row level security;

create policy "replies: own rows" on public.replies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists replies_user_created_idx
  on public.replies (user_id, created_at desc);

-- ── auto-create a profile row on signup ──────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger function only — not callable from the Data API.
revoke execute on function public.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
