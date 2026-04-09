alter table public.trades
add column if not exists account_id text default '';
