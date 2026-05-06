-- Create public storage bucket for trade screenshots
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  true,
  20971520, -- 20 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set public = true;

-- Allow authenticated users to upload their own screenshots
create policy "Users upload own screenshots"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own screenshots
create policy "Users update own screenshots"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own screenshots
create policy "Users delete own screenshots"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'trade-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access (bucket is public)
create policy "Public read screenshots"
  on storage.objects for select
  to public
  using (bucket_id = 'trade-screenshots');
