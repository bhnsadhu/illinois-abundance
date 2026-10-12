-- Public reading and private submission records deliberately have separate storage.
-- Apply with Supabase migrations. PostgreSQL 15+ is required for invoker views.
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_sample boolean not null default false
);

create table public.writers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  bio text not null default '',
  avatar_url text,
  avatar_alt text,
  is_sample boolean not null default false
);

create table public.reviewers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'new' check (status in ('new','in_progress','published','declined','unpublished')),
  slug text unique check (slug is null or (char_length(slug) <= 160 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
  author_name text not null check (char_length(author_name) between 1 and 160),
  final_body text not null default '' check (char_length(final_body) <= 40000),
  headline text not null default '' check (char_length(headline) <= 240),
  short_version text not null default '' check (char_length(short_version) <= 1000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  topic_id uuid references public.topics(id) on delete restrict,
  byline text not null default '' check (char_length(byline) <= 160),
  writer_id uuid references public.writers(id) on delete restrict,
  cover_url text,
  cover_alt text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  is_sample boolean not null default false,
  search_document tsvector generated always as (
    setweight(to_tsvector('english', headline), 'A') ||
    setweight(to_tsvector('english', short_version), 'B') ||
    setweight(to_tsvector('english', final_body), 'C')
  ) stored,
  constraint published_posts_complete check (status <> 'published' or (
    slug is not null and length(trim(headline)) > 0 and length(trim(short_version)) > 0
    and length(trim(final_body)) > 0 and length(trim(byline)) > 0
    and topic_id is not null and writer_id is not null and published_at is not null
  )),
  constraint cover_requires_alt check (cover_url is null or length(trim(coalesce(cover_alt, ''))) > 0)
);
create index posts_published_at_idx on public.posts(published_at desc) where status = 'published';
create index posts_topic_idx on public.posts(topic_id, published_at desc);
create index posts_writer_idx on public.posts(writer_id);
create index posts_status_created_idx on public.posts(status, created_at desc);
create index posts_search_idx on public.posts using gin(search_document);

create table public.submission_private (
  post_id uuid primary key references public.posts(id) on delete cascade,
  author_email text not null check (author_email = lower(author_email)),
  original_body text not null check (char_length(original_body) between 1 and 20000),
  claimed_by uuid references public.reviewers(id) on delete set null,
  claimed_at timestamptz,
  decline_note text,
  is_sample boolean not null default false
);
create index submission_private_email_idx on public.submission_private(author_email);

create table public.writer_contacts (
  writer_id uuid primary key references public.writers(id) on delete cascade,
  email text not null unique check (email = lower(email))
);

create table public.email_verifications (
  id uuid primary key,
  email text not null check (email ~ '^[^[:space:]@]+@illinois\.edu$' and email = lower(email)),
  author_name text not null check (char_length(author_name) between 1 and 160),
  original_body text not null check (char_length(original_body) between 1 and 20000),
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  verified_at timestamptz,
  post_id uuid references public.posts(id),
  created_at timestamptz not null default now()
);
create index email_verifications_expiry_idx on public.email_verifications(expires_at) where verified_at is null;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null,
  rsvp_url text,
  recap_post_id uuid references public.posts(id) on delete set null,
  is_published boolean not null default true,
  is_sample boolean not null default false,
  check (ends_at is null or ends_at > starts_at)
);
create index events_starts_at_idx on public.events(starts_at);

create table public.learn_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_version text not null default '',
  body text not null,
  is_published boolean not null default true,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  body_name text not null,
  starts_at timestamptz not null,
  location text not null,
  agenda_url text,
  is_published boolean not null default true,
  is_sample boolean not null default false
);
create index meetings_starts_at_idx on public.meetings(starts_at);

-- No names, tracking profiles or IP addresses are stored for subscribers.
create table public.subscribers (
  email text primary key check (email = lower(email)),
  confirmed_at timestamptz,
  token text not null unique check (char_length(token) >= 32)
);

create table public.digest_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'sending' check (status in ('sending','sent','failed')),
  post_ids uuid[] not null default '{}',
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0)
);

create table public.post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  view_day date not null default current_date,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  primary key (post_id, view_day, visitor_hash)
);

create table public.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_started_at timestamptz not null,
  requests integer not null check (requests > 0)
);

-- Membership is always checked in the current list, not mutable user metadata.
create function public.is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.reviewers r
    where r.is_active and r.email = lower(auth.jwt()->>'email')
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['topics','writers','reviewers','posts','submission_private','writer_contacts',
    'email_verifications','events','learn_pages','meetings','subscribers','digest_log','post_views','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Clients never write tables directly. All mutations are checked server-side.
grant select on public.posts, public.topics, public.writers, public.events, public.learn_pages, public.meetings to anon, authenticated;
grant select on public.submission_private, public.reviewers, public.writer_contacts to authenticated;

create policy posts_public on public.posts for select to anon, authenticated using (status = 'published');
create policy posts_review on public.posts for select to authenticated using ((select public.is_reviewer()));
create policy topics_public on public.topics for select to anon, authenticated using (is_active);
create policy topics_review on public.topics for select to authenticated using ((select public.is_reviewer()));
create policy writers_public on public.writers for select to anon, authenticated using (true);
create policy events_public on public.events for select to anon, authenticated using (is_published);
create policy learn_public on public.learn_pages for select to anon, authenticated using (is_published);
create policy meetings_public on public.meetings for select to anon, authenticated using (is_published);
create policy private_review on public.submission_private for select to authenticated using ((select public.is_reviewer()));
create policy reviewers_review on public.reviewers for select to authenticated using ((select public.is_reviewer()));
create policy writer_contacts_review on public.writer_contacts for select to authenticated using ((select public.is_reviewer()));

create view public.public_posts with (security_invoker = true, security_barrier = true) as
  select id, slug, author_name, final_body, headline, short_version, sources, topic_id,
    byline, writer_id, cover_url, cover_alt, published_at, updated_at, created_at, is_sample, search_document
  from public.posts where status = 'published';
create view public.public_topics with (security_invoker = true, security_barrier = true) as
  select id, slug, name, description, sort_order, is_active, is_sample from public.topics where is_active;
create view public.public_writers with (security_invoker = true, security_barrier = true) as
  select id, slug, name, bio, avatar_url, avatar_alt, is_sample from public.writers;
create view public.public_events with (security_invoker = true, security_barrier = true) as
  select id, slug, title, description, starts_at, ends_at, location, rsvp_url, recap_post_id, is_published, is_sample
  from public.events where is_published;
create view public.public_learn_pages with (security_invoker = true, security_barrier = true) as
  select id, slug, title, short_version, body, created_at, updated_at, is_published, is_sample from public.learn_pages where is_published;
create view public.public_meetings with (security_invoker = true, security_barrier = true) as
  select id, body_name, starts_at, location, agenda_url, is_published, is_sample from public.meetings where is_published;
revoke all on public.public_posts, public.public_topics, public.public_writers, public.public_events,
  public.public_learn_pages, public.public_meetings from anon, authenticated;
grant select on public.public_posts, public.public_topics, public.public_writers, public.public_events,
  public.public_learn_pages, public.public_meetings to anon, authenticated, service_role;

create function public.preserve_original() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if not old.is_sample then raise exception 'Original submissions are permanent. Unpublish instead.' using errcode = '23514'; end if;
    return old;
  end if;
  if new.original_body is distinct from old.original_body or new.author_email is distinct from old.author_email
    or new.post_id is distinct from old.post_id or new.is_sample is distinct from old.is_sample then
    raise exception 'Original submissions are immutable.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger preserve_original before update or delete on public.submission_private
  for each row execute function public.preserve_original();

create function public.preserve_post_origin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_sample is distinct from old.is_sample or new.created_at is distinct from old.created_at then
    raise exception 'Submission origin cannot be changed.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger preserve_post_origin before update on public.posts for each row execute function public.preserve_post_origin();

-- The single upsert is atomic across all application instances.
create function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare accepted integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'Invalid rate limit'; end if;
  insert into public.rate_limits as existing(key, window_started_at, requests)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_started_at = case when existing.window_started_at + make_interval(secs => p_window_seconds) <= now() then now() else existing.window_started_at end,
    requests = case when existing.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1 else existing.requests + 1 end
  where existing.window_started_at + make_interval(secs => p_window_seconds) <= now() or existing.requests < p_limit
  returning requests into accepted;
  return accepted is not null;
end $$;

create function public.start_verification(p_id uuid, p_email text, p_author_name text, p_original_body text, p_code_hash text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare challenge uuid;
begin
  insert into public.email_verifications as existing(id,email,author_name,original_body,code_hash,expires_at)
  values (p_id,lower(trim(p_email)),trim(p_author_name),p_original_body,p_code_hash,now() + interval '10 minutes')
  on conflict (id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0
    where existing.verified_at is null and existing.email = excluded.email
      and existing.author_name = excluded.author_name and existing.original_body = excluded.original_body
  returning id into challenge;
  if challenge is null then raise exception 'This submission cannot be changed or verified again.' using errcode = '23514'; end if;
  return challenge;
end $$;

create function public.verify_submission(p_id uuid, p_code_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare challenge public.email_verifications%rowtype; new_post_id uuid;
begin
  select * into challenge from public.email_verifications where id = p_id for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if challenge.verified_at is not null then return jsonb_build_object('status','already_verified','post_id',challenge.post_id); end if;
  if challenge.expires_at <= now() then return jsonb_build_object('status','expired'); end if;
  if challenge.attempts >= 5 then return jsonb_build_object('status','locked'); end if;
  if challenge.code_hash is distinct from p_code_hash then
    update public.email_verifications set attempts = attempts + 1 where id = p_id;
    return jsonb_build_object('status','mismatch');
  end if;
  insert into public.posts(author_name, final_body, byline)
    values (challenge.author_name, challenge.original_body, challenge.author_name) returning id into new_post_id;
  insert into public.submission_private(post_id,author_email,original_body)
    values (new_post_id,challenge.email,challenge.original_body);
  update public.email_verifications set verified_at = now(), post_id = new_post_id where id = p_id;
  return jsonb_build_object('status','verified','post_id',new_post_id);
end $$;

create function public.review_post(p_id uuid, p_expected_version integer, p_actor_id uuid, p_action text, p_changes jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare current_post public.posts%rowtype; next_post public.posts%rowtype;
  author_email_value text; writer_value uuid; writer_slug text;
begin
  if not exists (select 1 from public.reviewers where id = p_actor_id and is_active) then
    return jsonb_build_object('status','forbidden');
  end if;
  select * into current_post from public.posts where id = p_id for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if current_post.version <> p_expected_version then
    return jsonb_build_object('status','conflict','version',current_post.version);
  end if;
  if p_action is null or p_action not in ('claim','release','save','publish','decline','unpublish') then raise exception 'Unknown review action'; end if;
  next_post := current_post;
  if p_action in ('save','publish') then
    if p_changes ? 'headline' then next_post.headline := p_changes->>'headline'; end if;
    if p_changes ? 'short_version' then next_post.short_version := p_changes->>'short_version'; end if;
    if p_changes ? 'final_body' then next_post.final_body := p_changes->>'final_body'; end if;
    if p_changes ? 'byline' then next_post.byline := p_changes->>'byline'; end if;
    if p_changes ? 'slug' then next_post.slug := nullif(p_changes->>'slug',''); end if;
    if p_changes ? 'topic_id' then next_post.topic_id := nullif(p_changes->>'topic_id','')::uuid; end if;
    if p_changes ? 'writer_id' then next_post.writer_id := nullif(p_changes->>'writer_id','')::uuid; end if;
    if p_changes ? 'cover_url' then next_post.cover_url := nullif(p_changes->>'cover_url',''); end if;
    if p_changes ? 'cover_alt' then next_post.cover_alt := nullif(p_changes->>'cover_alt',''); end if;
    if p_changes ? 'sources' then next_post.sources := p_changes->'sources'; end if;
    next_post.updated_at := now();
  end if;
  if p_action = 'claim' then
    update public.submission_private set claimed_by = p_actor_id, claimed_at = now() where post_id = p_id;
    if current_post.status = 'new' then next_post.status := 'in_progress'; end if;
  elsif p_action = 'release' then
    update public.submission_private set claimed_by = null, claimed_at = null where post_id = p_id;
  elsif p_action = 'decline' then
    next_post.status := 'declined';
    update public.submission_private set decline_note = nullif(p_changes->>'decline_note','') where post_id = p_id;
  elsif p_action = 'unpublish' then
    next_post.status := 'unpublished';
  elsif p_action = 'publish' then
    if not exists (select 1 from public.topics where id = next_post.topic_id and is_active) then
      raise exception 'Choose an active topic before publishing.' using errcode = '23514';
    end if;
    if next_post.writer_id is null then
      select author_email into author_email_value from public.submission_private where post_id = p_id;
      if author_email_value is not null then perform pg_advisory_xact_lock(hashtextextended(author_email_value,0)); end if;
      select writer_id into writer_value from public.writer_contacts where email = author_email_value;
      if writer_value is null then
        writer_value := gen_random_uuid();
        writer_slug := trim(both '-' from regexp_replace(lower(next_post.byline), '[^a-z0-9]+', '-', 'g'));
        writer_slug := coalesce(nullif(writer_slug,''),'writer') || '-' || substr(writer_value::text,1,8);
        insert into public.writers(id,slug,name) values(writer_value,writer_slug,next_post.byline);
        if author_email_value is not null then
          insert into public.writer_contacts(writer_id,email) values(writer_value,author_email_value)
          on conflict(email) do nothing;
          select writer_id into writer_value from public.writer_contacts where email = author_email_value;
        end if;
      end if;
      next_post.writer_id := writer_value;
    end if;
    next_post.status := 'published';
    next_post.published_at := coalesce(current_post.published_at,now());
  end if;
  update public.posts set status=next_post.status,slug=next_post.slug,final_body=next_post.final_body,
    headline=next_post.headline,short_version=next_post.short_version,sources=next_post.sources,
    topic_id=next_post.topic_id,byline=next_post.byline,writer_id=next_post.writer_id,
    cover_url=next_post.cover_url,cover_alt=next_post.cover_alt,published_at=next_post.published_at,
    updated_at=next_post.updated_at,version=current_post.version+1 where id=p_id;
  return jsonb_build_object('status','ok','post_id',p_id,'version',current_post.version+1);
end $$;

create function public.delete_sample_content() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.events where is_sample;
  delete from public.meetings where is_sample;
  delete from public.learn_pages where is_sample;
  delete from public.posts where is_sample;
  delete from public.writers w where is_sample and not exists(select 1 from public.posts p where p.writer_id=w.id);
end $$;

-- PostgreSQL otherwise grants PUBLIC execute on newly created functions.
revoke all on function public.is_reviewer() from public, anon, authenticated;
grant execute on function public.is_reviewer() to authenticated, service_role;
revoke all on function public.preserve_original(), public.preserve_post_origin(),
  public.consume_rate_limit(text,integer,integer),public.start_verification(uuid,text,text,text,text),
  public.verify_submission(uuid,text),public.review_post(uuid,integer,uuid,text,jsonb),public.delete_sample_content()
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.start_verification(uuid,text,text,text,text),
  public.verify_submission(uuid,text),public.review_post(uuid,integer,uuid,text,jsonb),public.delete_sample_content() to service_role;
alter default privileges in schema public revoke execute on functions from public;
