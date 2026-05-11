-- Central persisted app state used by the frontend Zustand store.
-- This table backs flyxa_data (journal/trade workspace state) and app_settings
-- (preferences, account picker settings, confluence options).
create table if not exists public.user_store (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  flyxa_data   jsonb       not null default '{"state":{},"version":1}'::jsonb,
  app_settings jsonb       not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.user_store enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_store'
      and policyname = 'Users manage own app store'
  ) then
    create policy "Users manage own app store"
      on public.user_store
      for all
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end
$$;

create index if not exists user_store_updated_at_idx on public.user_store(updated_at desc);
