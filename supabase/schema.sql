-- VubaTrustTyping initial schema for Supabase PostgreSQL.
-- Run in Supabase Dashboard > SQL Editor. Review policies before production use.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  typing_level text not null default 'Beginner',
  consent_public_profile boolean not null default false,
  public_display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wpm numeric(6,2) not null check (wpm >= 0 and wpm <= 500),
  accuracy numeric(5,2) not null check (accuracy >= 0 and accuracy <= 100),
  test_mode text not null default 'practice' check (test_mode in ('practice','time','words','quote')),
  test_duration integer not null check (test_duration between 1 and 3600),
  created_at timestamptz not null default now()
);
create index if not exists test_results_user_created_idx on public.test_results(user_id, created_at desc);

create table if not exists public.race_lobbies (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  invite_code varchar(12) not null unique,
  status text not null default 'waiting' check (status in ('waiting','racing','finished','cancelled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.race_participants (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.race_lobbies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress_percent numeric(5,2) not null default 0 check (progress_percent between 0 and 100),
  wpm numeric(6,2) not null default 0 check (wpm >= 0 and wpm <= 500),
  accuracy numeric(5,2) not null default 100 check (accuracy between 0 and 100),
  finish_position integer,
  joined_at timestamptz not null default now(),
  unique (lobby_id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  title text not null default 'Message',
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);

create table if not exists public.top_performers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  advice_message text,
  custom_avatar_url text,
  rank_position integer not null check (rank_position between 1 and 3),
  consent_confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (rank_position)
);

-- Create a profile after signup. New users always receive the user role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Public leaderboard only reveals display names for users who explicitly opt in.
create or replace view public.public_leaderboard
as
select p.id as user_id,
       coalesce(nullif(p.public_display_name, ''), 'Learner') as display_name,
       max(t.wpm)::numeric(6,2) as best_wpm
from public.profiles p
join public.test_results t on t.user_id = p.id
where p.consent_public_profile = true
  and p.public_display_name is not null
  and p.public_display_name <> ''
group by p.id, p.public_display_name;

-- Enable RLS on all user-facing tables.
alter table public.profiles enable row level security;
alter table public.test_results enable row level security;
alter table public.race_lobbies enable row level security;
alter table public.race_participants enable row level security;
alter table public.notifications enable row level security;
alter table public.top_performers enable row level security;

-- Profiles: users can read/update their own profile, but cannot change their role.
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated
using (auth.uid() = id) with check (auth.uid() = id);
-- Prevent role escalation by column-level permissions: don't grant direct role updates.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, typing_level, consent_public_profile, public_display_name, updated_at) on public.profiles to authenticated;
grant select on public.profiles to authenticated;

-- Typing results: each user may insert and read only their own results.
drop policy if exists "Read own test results" on public.test_results;
create policy "Read own test results" on public.test_results for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own test results" on public.test_results;
create policy "Insert own test results" on public.test_results for insert to authenticated with check (auth.uid() = user_id);

-- Lobbies: authenticated users can create a lobby; host can manage it, members can read.
drop policy if exists "Create lobby as self" on public.race_lobbies;
create policy "Create lobby as self" on public.race_lobbies for insert to authenticated with check (auth.uid() = host_id);
drop policy if exists "Read lobbies" on public.race_lobbies;
create policy "Read lobbies" on public.race_lobbies for select to authenticated using (auth.uid() = host_id or exists (select 1 from public.race_participants rp where rp.lobby_id = race_lobbies.id and rp.user_id = auth.uid()));
drop policy if exists "Host updates lobby" on public.race_lobbies;
create policy "Host updates lobby" on public.race_lobbies for update to authenticated using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- Participants can read participants in lobbies they belong to; they can insert/update only themselves.
drop policy if exists "Read race participants in own lobby" on public.race_participants;
create policy "Read race participants in own lobby" on public.race_participants for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.race_participants rp where rp.lobby_id = race_participants.lobby_id and rp.user_id = auth.uid()));
drop policy if exists "Join race as self" on public.race_participants;
create policy "Join race as self" on public.race_participants for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own race progress" on public.race_participants;
create policy "Update own race progress" on public.race_participants for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notifications: users can read and mark their own messages as read.
drop policy if exists "Read own notifications" on public.notifications;
create policy "Read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Mark own notifications read" on public.notifications;
create policy "Mark own notifications read" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Sending admin messages should be implemented through a trusted server/Edge Function,
-- never by exposing a service-role key in the browser.

-- Top performer entries are managed by a trusted server/admin workflow.
-- Do not allow arbitrary public inserts or role changes from the browser.
grant select on public.public_leaderboard to anon, authenticated;

-- IMPORTANT: after your first Google sign-in, promote the intended admin manually:
-- update public.profiles set role = 'admin' where email = 'YOUR_ADMIN_EMAIL';
-- Run that statement from the Supabase SQL Editor only. Do not store an admin password in code.
