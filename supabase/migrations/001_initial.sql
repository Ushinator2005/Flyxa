-- Trades table
create table public.trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  direction text not null check (direction in ('Long', 'Short')),
  entry_price numeric(12,4) not null,
  exit_price numeric(12,4) not null,
  sl_price numeric(12,4) not null,
  tp_price numeric(12,4) not null,
  exit_reason text check (exit_reason in ('TP', 'SL')),
  pnl numeric(12,2) not null,
  contract_size integer not null default 1,
  point_value numeric(10,2) not null default 1,
  trade_date date not null,
  trade_time time not null,
  trade_length_seconds integer,
  candle_count integer,
  timeframe_minutes integer,
  emotional_state text,
  confidence_level integer check (confidence_level between 1 and 10),
  pre_trade_notes text default '',
  post_trade_notes text default '',
  followed_plan boolean default true,
  session text default 'Other',
  created_at timestamptz default now()
);

alter table public.trades enable row level security;
create policy "Users can manage own trades" on public.trades
  for all using (auth.uid() = user_id);

-- Psychology logs table
create table public.psychology_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  mood text,
  pre_session_notes text default '',
  post_session_notes text default '',
  mindset_score integer check (mindset_score between 1 and 10),
  created_at timestamptz default now()
);

alter table public.psychology_logs enable row level security;
create policy "Users can manage own psychology logs" on public.psychology_logs
  for all using (auth.uid() = user_id);

-- Playbook entries table
create table public.playbook_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  setup_name text not null,
  description text default '',
  rules text default '',
  ideal_conditions text default '',
  screenshot_url text default '',
  created_at timestamptz default now()
);

alter table public.playbook_entries enable row level security;
create policy "Users can manage own playbook" on public.playbook_entries
  for all using (auth.uid() = user_id);

-- Journal entries table
create table public.journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  content text default '',
  screenshots text[] default '{}',
  created_at timestamptz default now()
);

alter table public.journal_entries enable row level security;
create policy "Users can manage own journal" on public.journal_entries
  for all using (auth.uid() = user_id);

-- Risk settings table
create table public.risk_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  daily_loss_limit numeric(12,2) default 500,
  max_trades_per_day integer default 10,
  max_contracts_per_trade integer default 5,
  account_size numeric(12,2) default 10000,
  risk_percentage numeric(5,2) default 1,
  updated_at timestamptz default now()
);

alter table public.risk_settings enable row level security;
create policy "Users can manage own risk settings" on public.risk_settings
  for all using (auth.uid() = user_id);
