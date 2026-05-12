-- Add explicit WITH CHECK clause to the trades RLS policy.
-- Previously only USING was specified; PostgreSQL implicitly reuses it for
-- writes, but an explicit WITH CHECK makes the intent unambiguous and is
-- considered best practice for policies that allow INSERT/UPDATE.
alter policy "Users can manage own trades"
  on public.trades
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
