-- Broker/login credentials should not be stored in Flyxa.
-- Account profiles remain useful for filtering and reporting, but secrets belong
-- in the broker/prop-firm platform or a proper secrets manager.
alter table public.trading_accounts
  drop column if exists credentials;
