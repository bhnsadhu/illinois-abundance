-- Passwordless reviewer authentication. Raw login and session tokens never
-- enter PostgreSQL; the application passes purpose-separated HMAC hashes.
create table public.login_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  email text not null check (email = lower(email)),
  expires_at timestamptz not null default now() + interval '15 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index login_tokens_expiry_idx on public.login_tokens(expires_at);

create table public.reviewer_sessions (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  email text not null check (email = lower(email)),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index reviewer_sessions_expiry_idx on public.reviewer_sessions(expires_at);
create index reviewer_sessions_email_idx on public.reviewer_sessions(email);

alter table public.login_tokens enable row level security;
alter table public.reviewer_sessions enable row level security;
revoke all on public.login_tokens, public.reviewer_sessions from public, anon, authenticated;
grant select,insert,update,delete on public.login_tokens, public.reviewer_sessions to service_role;

create function public.consume_login(p_token_hash text, p_session_hash text, p_admin_email text default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare login public.login_tokens%rowtype;
begin
  select * into login from public.login_tokens where token_hash = p_token_hash for update;
  if not found or login.consumed_at is not null or login.expires_at <= now() then
    return jsonb_build_object('status','invalid');
  end if;
  update public.login_tokens set consumed_at = now() where id = login.id;
  if not exists (select 1 from public.reviewers where email = login.email and is_active)
    and login.email is distinct from nullif(lower(trim(p_admin_email)), '') then
    return jsonb_build_object('status','forbidden');
  end if;
  insert into public.reviewer_sessions(token_hash,email) values (p_session_hash,login.email);
  return jsonb_build_object('status','ok');
end $$;
revoke all on function public.consume_login(text,text,text) from public, anon, authenticated;
grant execute on function public.consume_login(text,text,text) to service_role;
