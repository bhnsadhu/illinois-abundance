-- Subscribers retain only their email, confirmation time and opaque token.
create function public.prepare_subscription(p_email text, p_token text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare subscriber public.subscribers%rowtype;
begin
  if p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid subscription token' using errcode='23514'; end if;
  insert into public.subscribers as existing(email,token) values(lower(trim(p_email)),p_token)
    on conflict(email) do update set email=existing.email returning * into subscriber;
  return jsonb_build_object('confirmed',subscriber.confirmed_at is not null,'token',subscriber.token);
end $$;

create function public.confirm_subscription(p_token text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.subscribers set confirmed_at=coalesce(confirmed_at,now()) where token=p_token;
  return found;
end $$;

alter table public.digest_log
  add column window_start timestamptz,
  add column window_end timestamptz,
  add column dedup_date date,
  add column content_hash text,
  add column snapshot jsonb,
  add column lease_token uuid,
  add column lease_until timestamptz,
  add column skipped_count integer not null default 0,
  add column uncertain_count integer not null default 0;
create unique index digest_content_window_idx on public.digest_log(dedup_date,content_hash);

create table public.digest_deliveries (
  digest_id uuid not null references public.digest_log(id) on delete cascade,
  email text not null,
  subscriber_token text not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','skipped','uncertain')),
  first_attempt_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  primary key(digest_id,email)
);
alter table public.digest_deliveries enable row level security;
revoke all on public.digest_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.digest_deliveries to service_role;

create function public.refresh_digest_progress(p_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare totals record;
begin
  select count(*)::integer as total,
    count(*) filter(where status='sent')::integer as sent,
    count(*) filter(where status='failed')::integer as failed,
    count(*) filter(where status='skipped')::integer as skipped,
    count(*) filter(where status='uncertain')::integer as uncertain,
    count(*) filter(where status in ('pending','sending'))::integer as pending
    into totals from public.digest_deliveries where digest_id=p_id;
  update public.digest_log set recipient_count=totals.total,sent_count=totals.sent,
    failed_count=totals.failed,skipped_count=totals.skipped,uncertain_count=totals.uncertain,
    status=case when totals.pending>0 then 'sending' when totals.failed+totals.uncertain>0 then 'failed' else 'sent' end,
    sent_at=case when totals.pending+totals.failed+totals.uncertain=0 then coalesce(sent_at,now()) else null end
    where id=p_id;
end $$;

create function public.start_digest(p_window_start timestamptz,p_window_end timestamptz,p_content_hash text,p_snapshot jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare digest_id uuid;
begin
  if p_window_start is null or p_window_end is null or p_window_end<=p_window_start
    or p_content_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_snapshot)<>'object' then
    raise exception 'Invalid digest snapshot' using errcode='23514';
  end if;
  insert into public.digest_log(window_start,window_end,dedup_date,content_hash,snapshot,post_ids)
    values(p_window_start,p_window_end,(p_window_end at time zone 'UTC')::date,p_content_hash,p_snapshot,
      array(select (value->>'id')::uuid from jsonb_array_elements(p_snapshot->'posts')))
    on conflict(dedup_date,content_hash) do nothing returning id into digest_id;
  if digest_id is null then
    select id into digest_id from public.digest_log
      where dedup_date=(p_window_end at time zone 'UTC')::date and content_hash=p_content_hash;
    return digest_id;
  end if;
  insert into public.digest_deliveries(digest_id,email,subscriber_token)
    select digest_id,email,token from public.subscribers where confirmed_at is not null;
  perform public.refresh_digest_progress(digest_id);
  return digest_id;
end $$;

-- A lease serializes manual batches, including overlapping browser requests.
-- The lease exceeds the route's maximum runtime. Stable provider keys protect
-- a crash after delivery but before the successful-send marker is written.
create function public.claim_digest_batch(p_id uuid,p_worker uuid,p_limit integer default 8) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare digest public.digest_log%rowtype; recipients jsonb;
begin
  select * into digest from public.digest_log where id=p_id for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if digest.lease_until>now() then return jsonb_build_object('status','busy'); end if;
  if digest.status='sent' then return jsonb_build_object('status','complete'); end if;
  update public.digest_log set lease_token=p_worker,lease_until=now()+interval '2 minutes' where id=p_id;
  update public.digest_deliveries set status='failed' where digest_id=p_id and status='sending';
  update public.digest_deliveries d set status='skipped' where digest_id=p_id and status in ('pending','failed')
    and not exists(select 1 from public.subscribers s where s.email=d.email and s.token=d.subscriber_token and s.confirmed_at is not null);
  -- Resend idempotency keys last 24 hours. An ambiguous older attempt is held
  -- for manual review rather than risking a second email after key expiry.
  update public.digest_deliveries set status='uncertain' where digest_id=p_id and status='failed'
    and first_attempt_at<=now()-interval '23 hours';
  with candidates as (
    select email from public.digest_deliveries where digest_id=p_id and status in ('pending','failed')
      order by first_attempt_at nulls first,email limit greatest(1,least(p_limit,8)) for update
  ), claimed as (
    update public.digest_deliveries d set status='sending',first_attempt_at=coalesce(first_attempt_at,now())
      from candidates c where d.digest_id=p_id and d.email=c.email returning d.email,d.subscriber_token
  ) select coalesce(jsonb_agg(jsonb_build_object('email',email,'token',subscriber_token)),'[]'::jsonb) into recipients from claimed;
  perform public.refresh_digest_progress(p_id);
  return jsonb_build_object('status','ready','recipients',recipients);
end $$;

create function public.finish_digest_delivery(p_id uuid,p_worker uuid,p_email text,p_status text,p_provider_id text default null) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if p_status not in ('sent','failed','skipped') then raise exception 'Invalid delivery status' using errcode='23514'; end if;
  perform 1 from public.digest_log where id=p_id and lease_token=p_worker for update;
  if not found then return false; end if;
  update public.digest_deliveries set status=p_status,provider_id=case when p_status='sent' then p_provider_id else null end,
    sent_at=case when p_status='sent' then now() else null end
    where digest_id=p_id and email=p_email and status='sending';
  if not found then return false; end if;
  perform public.refresh_digest_progress(p_id);
  return true;
end $$;

create function public.release_digest_batch(p_id uuid,p_worker uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.digest_log where id=p_id and lease_token=p_worker for update;
  if not found then return; end if;
  update public.digest_deliveries set status='failed' where digest_id=p_id and status='sending';
  update public.digest_log set lease_token=null,lease_until=null where id=p_id;
  perform public.refresh_digest_progress(p_id);
end $$;

revoke all on function public.prepare_subscription(text,text),public.confirm_subscription(text),
  public.refresh_digest_progress(uuid),public.start_digest(timestamptz,timestamptz,text,jsonb),
  public.claim_digest_batch(uuid,uuid,integer),public.finish_digest_delivery(uuid,uuid,text,text,text),
  public.release_digest_batch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_subscription(text,text),public.confirm_subscription(text),
  public.refresh_digest_progress(uuid),public.start_digest(timestamptz,timestamptz,text,jsonb),
  public.claim_digest_batch(uuid,uuid,integer),public.finish_digest_delivery(uuid,uuid,text,text,text),
  public.release_digest_batch(uuid,uuid) to service_role;
