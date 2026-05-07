-- Dedicated backup table for trade journal entries — independent of the user_store blob.
-- Named store_entries_backup to avoid conflict with the daily journal_entries table.
-- If user_store is ever wiped, trade entries can be recovered from here.
create table if not exists store_entries_backup (
  id          text        primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  date        text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);

alter table store_entries_backup enable row level security;

create policy "Users manage own store entries"
  on store_entries_backup
  for all
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists store_entries_backup_user_id_idx on store_entries_backup(user_id);
create index if not exists store_entries_backup_date_idx    on store_entries_backup(user_id, date desc);
