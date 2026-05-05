-- Trading accounts table
create table if not exists trading_accounts (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  broker      text,
  credentials text,
  type        text not null default 'Futures',
  status      text not null default 'Eval',
  color       text not null default '#3b82f6',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table trading_accounts enable row level security;

create policy "Users manage own accounts"
  on trading_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
