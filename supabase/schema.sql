-- Kintore Memo: Phase 2 schema for Supabase (Postgres).
-- Run the whole file once in Supabase Dashboard > SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);
-- Profile photo: a small (<= ~50 KB) JPEG data URL made in the browser.
alter table public.profiles add column if not exists avatar text;
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check
  check (avatar is null or (avatar like 'data:image/jpeg;base64,%' and char_length(avatar) <= 60000));

-- Invite codes are private to their owner (separate table so friends can't read them).
create table if not exists public.invite_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
);

-- One row per friend pair. user_a < user_b keeps pairs unique.
create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_b_idx on public.friendships (user_b);

-- Workouts a user chose to share with friends. `data` holds a denormalized snapshot
-- ({entries:[{name,kind,part,sets,prs}]}) so friends need no access to exercise lists.
create table if not exists public.shared_workouts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  title text not null default '' check (char_length(title) <= 100),
  note text not null default '' check (char_length(note) <= 2000),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shared_workouts_user_date_idx on public.shared_workouts (user_id, date desc);
create index if not exists shared_workouts_date_idx on public.shared_workouts (date desc);

-- Teams-style reactions: a user can add several different emoji to one workout.
create table if not exists public.reactions (
  workout_id uuid not null references public.shared_workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null default '👍',
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id, emoji)
);
-- Upgrade path for databases created with the older one-like-per-user layout.
alter table public.reactions add column if not exists emoji text not null default '👍';
alter table public.reactions drop constraint if exists reactions_pkey;
alter table public.reactions add primary key (workout_id, user_id, emoji);
alter table public.reactions drop constraint if exists reactions_emoji_check;
alter table public.reactions add constraint reactions_emoji_check check (emoji in ('👍', '❤️', '😂', '😮', '😢', '💪', '🔥'));

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.shared_workouts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists comments_workout_idx on public.comments (workout_id, created_at);

-- ---------- helpers ----------
create or replace function public.is_friend(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where (user_a = least(auth.uid(), other) and user_b = greatest(auth.uid(), other))
  );
$$;

-- Can the current user see this shared workout? (own or a friend's)
create or replace function public.can_see_workout(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.shared_workouts w
    where w.id = wid and (w.user_id = auth.uid() or public.is_friend(w.user_id))
  );
$$;

-- ---------- RPCs (the only way to create profiles / friendships) ----------
create or replace function public.create_profile(p_username text, p_display_name text default '')
returns public.profiles language plpgsql security definer set search_path = public as $$
declare r public.profiles;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.profiles (id, username, display_name)
  values (auth.uid(), lower(p_username), coalesce(p_display_name, ''))
  returning * into r;
  insert into public.invite_codes (user_id) values (r.id);
  return r;
exception
  when unique_violation then raise exception 'That username is already taken';
  when check_violation then raise exception 'Username must be 3-20 characters: a-z, 0-9, _';
end $$;

create or replace function public.add_friend_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare friend uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select user_id into friend from public.invite_codes where code = trim(p_code);
  if friend is null then raise exception 'Invalid invite code'; end if;
  if friend = auth.uid() then raise exception 'That is your own code'; end if;
  insert into public.friendships (user_a, user_b)
  values (least(auth.uid(), friend), greatest(auth.uid(), friend))
  on conflict do nothing;
  return friend;
end $$;

create or replace function public.regenerate_invite_code()
returns text language plpgsql security definer set search_path = public as $$
declare c text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
begin
  update public.invite_codes set code = c where user_id = auth.uid();
  if not found then raise exception 'Create a profile first'; end if;
  return c;
end $$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.friendships enable row level security;
alter table public.shared_workouts enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_friend(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists invite_select on public.invite_codes;
create policy invite_select on public.invite_codes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships for select to authenticated
  using (auth.uid() in (user_a, user_b));
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

drop policy if exists shared_select on public.shared_workouts;
create policy shared_select on public.shared_workouts for select to authenticated
  using (user_id = auth.uid() or public.is_friend(user_id));
drop policy if exists shared_insert on public.shared_workouts;
create policy shared_insert on public.shared_workouts for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists shared_update on public.shared_workouts;
create policy shared_update on public.shared_workouts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists shared_delete on public.shared_workouts;
create policy shared_delete on public.shared_workouts for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select to authenticated
  using (public.can_see_workout(workout_id));
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_workout(workout_id));
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select to authenticated
  using (public.can_see_workout(workout_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_workout(workout_id));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.shared_workouts w where w.id = workout_id and w.user_id = auth.uid()));

-- ---------- privileges ----------
revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.invite_codes to authenticated;
grant select, delete on public.friendships to authenticated;
grant select, insert, update, delete on public.shared_workouts to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant select, insert, delete on public.comments to authenticated;
revoke all on function public.create_profile(text, text) from public, anon;
revoke all on function public.add_friend_by_code(text) from public, anon;
revoke all on function public.regenerate_invite_code() from public, anon;
grant execute on function public.create_profile(text, text) to authenticated;
grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.can_see_workout(uuid) to authenticated;
