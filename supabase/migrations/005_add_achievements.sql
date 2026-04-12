-- Stores the timestamp at which each achievement was first unlocked per user.
-- The frontend computes which achievements are earned from trade data;
-- this table is the optional persistent record so unlock dates survive
-- localStorage clears or device switches.

create table if not exists public.user_achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  key         text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, key)
);

-- Users can only read/write their own rows
alter table public.user_achievements enable row level security;

create policy "Users can read own achievements"
  on public.user_achievements for select
  using (auth.uid() = user_id);

create policy "Users can insert own achievements"
  on public.user_achievements for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own achievements"
  on public.user_achievements for delete
  using (auth.uid() = user_id);

-- Fast lookup by user
create index if not exists user_achievements_user_id_idx
  on public.user_achievements (user_id);
