create extension if not exists "pgcrypto";

create type player_code as enum ('player_a', 'player_b');
create type match_stage as enum ('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final');
create type match_status as enum ('scheduled', 'live', 'finished', 'postponed', 'cancelled');
create type pick_result as enum ('home', 'draw', 'away');
create type fun_question_key as enum ('total_goals_3_plus', 'both_teams_score', 'first_half_goal', 'red_card', 'penalty_goal');

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code player_code not null unique,
  display_name text not null,
  avatar_color text not null default '#0f8a5f',
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  api_football_fixture_id bigint unique,
  match_number int not null unique,
  stage match_stage not null,
  group_name text,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  venue text,
  status match_status not null default 'scheduled',
  home_score_90 int,
  away_score_90 int,
  home_score_extra int,
  away_score_extra int,
  home_penalty_score int,
  away_penalty_score int,
  winner_team text,
  fun_question_key fun_question_key not null default 'both_teams_score',
  fun_question_answer boolean,
  red_cards int,
  penalty_goals int,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  pick_result pick_result not null,
  predicted_home_score int not null check (predicted_home_score >= 0),
  predicted_away_score int not null check (predicted_away_score >= 0),
  fun_answer boolean not null,
  predicted_winner_team text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  points int not null default 0,
  result_points int not null default 0,
  score_points int not null default 0,
  fun_points int not null default 0,
  advance_points int not null default 0,
  exact_score_bonus int not null default 0,
  net_amount numeric(8, 2) not null default 0,
  streak_badge boolean not null default false,
  settled_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists matches_touch_updated_at on matches;
create trigger matches_touch_updated_at
before update on matches
for each row execute function touch_updated_at();

drop trigger if exists predictions_touch_updated_at on predictions;
create trigger predictions_touch_updated_at
before update on predictions
for each row execute function touch_updated_at();

create or replace function prevent_locked_prediction_update()
returns trigger
language plpgsql
as $$
begin
  if old.locked_at is not null and auth.role() <> 'service_role' then
    raise exception 'Prediction is locked';
  end if;
  return new;
end;
$$;

drop trigger if exists predictions_prevent_locked_update on predictions;
create trigger predictions_prevent_locked_update
before update on predictions
for each row execute function prevent_locked_prediction_update();

alter table players enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table settlements enable row level security;
alter table sync_runs enable row level security;

create or replace function is_app_player()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from players where user_id = auth.uid());
$$;

drop policy if exists "authenticated players can read players" on players;
create policy "authenticated players can read players"
on players for select
to authenticated
using (is_app_player());

drop policy if exists "authenticated players can read matches" on matches;
create policy "authenticated players can read matches"
on matches for select
to authenticated
using (is_app_player());

drop policy if exists "authenticated players can read predictions" on predictions;
create policy "authenticated players can read predictions"
on predictions for select
to authenticated
using (is_app_player());

drop policy if exists "players insert own predictions" on predictions;
create policy "players insert own predictions"
on predictions for insert
to authenticated
with check (player_id in (select id from players where user_id = auth.uid()));

drop policy if exists "players update own unlocked predictions" on predictions;
create policy "players update own unlocked predictions"
on predictions for update
to authenticated
using (player_id in (select id from players where user_id = auth.uid()) and locked_at is null)
with check (player_id in (select id from players where user_id = auth.uid()));

drop policy if exists "authenticated players can read settlements" on settlements;
create policy "authenticated players can read settlements"
on settlements for select
to authenticated
using (is_app_player());

drop policy if exists "authenticated players can read sync runs" on sync_runs;
create policy "authenticated players can read sync runs"
on sync_runs for select
to authenticated
using (is_app_player());

create index if not exists matches_kickoff_at_idx on matches (kickoff_at);
create index if not exists predictions_match_id_idx on predictions (match_id);
create index if not exists settlements_match_id_idx on settlements (match_id);
