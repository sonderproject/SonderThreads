-- Minimal stand-ins for Supabase's auth schema and roles, so RLS policies
-- can be tested on plain Postgres. Run in an empty local test database only.
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $f$;
grant usage on schema auth to authenticated;
grant usage on schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
