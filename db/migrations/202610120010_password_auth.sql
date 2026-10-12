-- Passwords are salted and hashed by the server; never store plaintext.
alter table public.reviewers add column password_hash text
  check (password_hash is null or password_hash ~ '^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$');
-- Historical authenticated-role grants must not expose password hashes.
revoke select on public.reviewers from authenticated;
grant select(id,email,name,is_active,created_at) on public.reviewers to authenticated;

-- Invalidate sessions atomically with credential/identity/access changes.
create function public.revoke_reviewer_sessions() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    delete from public.reviewer_sessions where email = old.email;
    delete from public.login_tokens where email = old.email;
    return old;
  end if;
  if old.email is distinct from new.email or old.password_hash is distinct from new.password_hash
    or old.is_active is distinct from new.is_active then
    delete from public.reviewer_sessions where email in (old.email,new.email);
    delete from public.login_tokens where email in (old.email,new.email);
  end if;
  return new;
end $$;
create trigger reviewer_credentials_changed after update or delete on public.reviewers
  for each row execute function public.revoke_reviewer_sessions();

-- Recheck credentials under a row lock after the server's slow verification.
create function public.create_password_session(p_reviewer_id uuid, p_email text, p_password_hash text, p_session_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare reviewer public.reviewers%rowtype;
begin
  select * into reviewer from public.reviewers where id = p_reviewer_id for update;
  if not found or not reviewer.is_active or reviewer.password_hash is null
    or reviewer.email is distinct from p_email or reviewer.password_hash is distinct from p_password_hash then
    return jsonb_build_object('status','invalid');
  end if;
  insert into public.reviewer_sessions(token_hash,email) values(p_session_hash,reviewer.email);
  return jsonb_build_object('status','ok');
end $$;

create function public.change_reviewer_password(p_reviewer_id uuid, p_current_session_hash text, p_current_hash text, p_new_hash text, p_session_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare reviewer public.reviewers%rowtype;
begin
  select * into reviewer from public.reviewers where id = p_reviewer_id for update;
  if not found or not reviewer.is_active or reviewer.password_hash is null
    or reviewer.password_hash is distinct from p_current_hash
    or not exists(select 1 from public.reviewer_sessions where token_hash = p_current_session_hash and email = reviewer.email and expires_at > now()) then
    return jsonb_build_object('status','invalid');
  end if;
  update public.reviewers set password_hash = p_new_hash where id = reviewer.id;
  -- The trigger revokes every old session; keep only this freshly rotated one.
  insert into public.reviewer_sessions(token_hash,email) values(p_session_hash,reviewer.email);
  return jsonb_build_object('status','ok');
end $$;

-- Retire outstanding magic links, including callbacks on an older deployment.
delete from public.login_tokens;
create or replace function public.consume_login(p_token_hash text, p_session_hash text, p_admin_email text default null) returns jsonb
language sql security invoker set search_path = '' as $$ select jsonb_build_object('status','invalid') $$;
revoke all on function public.revoke_reviewer_sessions(), public.create_password_session(uuid,text,text,text),
  public.change_reviewer_password(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.revoke_reviewer_sessions(), public.create_password_session(uuid,text,text,text),
  public.change_reviewer_password(uuid,text,text,text,text) to service_role;
