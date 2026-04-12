alter table public.trades
add column if not exists confluences text[] default '{}';
