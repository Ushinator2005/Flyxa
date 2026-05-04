-- Goals table
create table public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text default '',
  category text not null,
  color text not null,
  horizon text default '',
  steps jsonb default '[]'::jsonb,
  status text default 'Active' check (status in ('Active', 'Paused', 'Achieved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.goals enable row level security;
create policy "Users can manage own goals" on public.goals
  for all using (auth.uid() = user_id);

-- Fix exit_reason constraint to allow breakeven trades ('BE')
alter table public.trades drop constraint if exists trades_exit_reason_check;
alter table public.trades add constraint trades_exit_reason_check
  check (exit_reason in ('TP', 'SL', 'BE'));
