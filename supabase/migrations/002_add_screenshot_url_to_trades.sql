alter table public.trades
add column if not exists screenshot_url text default '';
