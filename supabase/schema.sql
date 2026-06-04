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

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
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
drop policy if exists "settings: own rows" on public.settings;
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

drop policy if exists "replies: own rows" on public.replies;
create policy "replies: own rows" on public.replies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists replies_user_created_idx
  on public.replies (user_id, created_at desc);

-- Annotate each reply with the credit tier + cost it consumed (for the usage dashboard).
alter table public.replies add column if not exists tier    text;
alter table public.replies add column if not exists credits  int not null default 0;

-- ── credits (one row per user) ───────────────────────────────────────────────
-- Authoritative credit balance. SECURITY: clients can only SELECT their row —
-- there is intentionally NO insert/update/delete policy, so a user can never
-- grant themselves credits. The billing gateway writes here via the service role.
create table if not exists public.credits (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  plan          text not null default 'trial',   -- 'trial' | 'pro'
  balance       int  not null default 200,
  monthly_grant int  not null default 200,
  period_end    timestamptz not null default (now() + interval '14 days'),
  updated_at    timestamptz not null default now()
);
alter table public.credits enable row level security;

drop policy if exists "credits: select own" on public.credits;
create policy "credits: select own" on public.credits
  for select using (auth.uid() = user_id);

-- Atomic credit spend. Callable by the signed-in user for THEIR OWN row only
-- (auth.uid()). It can only DECREMENT the balance (clamped at 0) — never raise
-- it — so a client can't grant itself credits. The app calls this per reply.
create or replace function public.spend_credits(amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  if amount is null or amount <= 0 then
    select balance into new_balance from public.credits where user_id = auth.uid();
    return new_balance;
  end if;
  update public.credits
     set balance = greatest(0, balance - amount), updated_at = now()
   where user_id = auth.uid()
   returning balance into new_balance;
  return new_balance;
end;
$$;
revoke execute on function public.spend_credits(int) from anon, public;
grant execute on function public.spend_credits(int) to authenticated;

-- ── billing (Razorpay) ───────────────────────────────────────────────────────
-- Idempotency log so a retried webhook never double-credits. No RLS policies →
-- only the service role (the webhook) can touch it.
create table if not exists public.billing_events (
  id         text primary key,   -- razorpay payment / link id
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;

-- Credit-granting helpers. Called ONLY by the webhook (service role); revoked
-- from clients so no one can grant themselves credits via the Data API.
create or replace function public.apply_topup(uid uuid, add_credits int)
returns void language sql security definer set search_path = public as $$
  update public.credits set balance = balance + add_credits, updated_at = now()
   where user_id = uid;
$$;

create or replace function public.apply_plan(uid uuid, p text, grant_credits int, days int)
returns void language sql security definer set search_path = public as $$
  insert into public.credits (user_id, plan, balance, monthly_grant, period_end, updated_at)
  values (uid, p, grant_credits, grant_credits, now() + (days || ' days')::interval, now())
  on conflict (user_id) do update
    set plan = excluded.plan, balance = excluded.balance,
        monthly_grant = excluded.monthly_grant, period_end = excluded.period_end,
        updated_at = now();
$$;
revoke execute on function public.apply_topup(uuid, int) from anon, authenticated, public;
revoke execute on function public.apply_plan(uuid, text, int, int) from anon, authenticated, public;

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
  -- Grant the 14-day trial credit allowance.
  insert into public.credits (user_id, plan, balance, monthly_grant, period_end)
  values (new.id, 'trial', 200, 200, now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger function only — not callable from the Data API.
revoke execute on function public.handle_new_user() from anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── waitlist (pre-launch landing page) ───────────────────────────────────────
-- Anyone can JOIN (insert), but visitors cannot READ the list (no select policy),
-- so emails stay private. A security-definer count function exposes only the
-- total for social proof.
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  use_case   text,
  referrer   text,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;

drop policy if exists "waitlist: anyone can join" on public.waitlist;
create policy "waitlist: anyone can join" on public.waitlist
  for insert to anon, authenticated with check (true);

-- Total signups only (no rows exposed) — for the "N on the waitlist" counter.
create or replace function public.waitlist_count()
returns int language sql security definer set search_path = public stable as $$
  select count(*)::int from public.waitlist;
$$;
grant execute on function public.waitlist_count() to anon, authenticated;
