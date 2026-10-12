-- These roles cannot log in. Only the trusted server connection can assume them.
-- Neon does not permit BYPASSRLS; private operations use the table owner instead.
do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I nologin', role_name);
    end if;
  end loop;
  execute format('grant anon, authenticated, service_role to %I', current_user);
end $$;

create schema if not exists auth;
revoke create on schema public from public;
revoke all on schema auth from public;
grant usage on schema auth, public to anon, authenticated, service_role;

-- Claims are set only by trusted server SQL. There is no browser database API
-- and no database password is ever exposed to readers or reviewers.
create or replace function auth.jwt() returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;
create or replace function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(auth.jwt()->>'sub', '')::uuid;
$$;
revoke all on function auth.jwt(), auth.uid() from public;
grant execute on function auth.jwt(), auth.uid() to authenticated, service_role;
