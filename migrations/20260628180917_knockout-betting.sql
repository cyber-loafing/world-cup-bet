do $$
begin
  create type public.advance_method as enum ('regular', 'extra_time', 'penalties');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.knockout_script_question_key as enum (
    'reaches_extra_time',
    'reaches_penalties',
    'decided_in_90',
    'winner_clean_sheet',
    'both_teams_score_90',
    'late_goal_after_75',
    'red_card',
    'penalty_goal'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.matches
  add column if not exists knockout_script_question_key public.knockout_script_question_key,
  add column if not exists knockout_script_answer boolean;

alter table public.predictions
  add column if not exists predicted_advance_method public.advance_method,
  add column if not exists knockout_script_answer boolean;

alter table public.settlements
  add column if not exists advance_method_points int not null default 0,
  add column if not exists knockout_script_points int not null default 0;

create table if not exists public.champion_picks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  champion_team text not null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists champion_picks_touch_updated_at on public.champion_picks;
create trigger champion_picks_touch_updated_at
before update on public.champion_picks
for each row execute function public.touch_updated_at();

create or replace function public.prevent_locked_champion_pick_update()
returns trigger
language plpgsql
as $$
begin
  if old.locked_at is not null and auth.role() <> 'service_role' then
    raise exception 'Champion pick is locked';
  end if;
  return new;
end;
$$;

drop trigger if exists champion_picks_prevent_locked_update on public.champion_picks;
create trigger champion_picks_prevent_locked_update
before update on public.champion_picks
for each row execute function public.prevent_locked_champion_pick_update();

alter table public.champion_picks enable row level security;

drop policy if exists "authenticated players can read champion picks" on public.champion_picks;
create policy "authenticated players can read champion picks"
on public.champion_picks for select
to authenticated
using (public.is_app_player());

drop policy if exists "players insert own champion pick" on public.champion_picks;
create policy "players insert own champion pick"
on public.champion_picks for insert
to authenticated
with check (player_id in (select id from public.players where user_id = auth.uid()));

drop policy if exists "players update own unlocked champion pick" on public.champion_picks;
create policy "players update own unlocked champion pick"
on public.champion_picks for update
to authenticated
using (player_id in (select id from public.players where user_id = auth.uid()) and locked_at is null)
with check (player_id in (select id from public.players where user_id = auth.uid()));

create index if not exists champion_picks_player_id_idx on public.champion_picks (player_id);
create index if not exists matches_knockout_script_question_key_idx on public.matches (knockout_script_question_key);
