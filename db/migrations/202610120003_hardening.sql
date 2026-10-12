-- Guard missing revision values, preserve originals against TRUNCATE, and
-- keep the topic labels of published articles visible after a directory hide.
revoke truncate on public.submission_private, public.posts from service_role;

create function public.prevent_original_truncate() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Original submissions are permanent. Truncation is forbidden.' using errcode = '23514';
end $$;
create trigger prevent_original_truncate before truncate on public.submission_private
  for each statement execute function public.prevent_original_truncate();
revoke all on function public.prevent_original_truncate() from public, anon, authenticated, service_role;

-- A hidden topic leaves the directory, while its published writing remains
-- available at existing links with its original topic label.
drop policy topics_public on public.topics;
create policy topics_public on public.topics for select to anon, authenticated using (
  is_active or exists (
    select 1 from public.posts p where p.topic_id = topics.id and p.status = 'published'
  )
);
create view public.public_story_topics with (security_invoker = true, security_barrier = true) as
  select id, slug, name, description, sort_order, is_active, is_sample
  from public.topics t
  where exists (select 1 from public.posts p where p.topic_id = t.id and p.status = 'published');
revoke all on public.public_story_topics from anon, authenticated;
grant select on public.public_story_topics to anon, authenticated, service_role;

create or replace function public.review_post(p_id uuid, p_expected_version integer, p_actor_id uuid, p_action text, p_changes jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare current_post public.posts%rowtype; next_post public.posts%rowtype;
  author_email_value text; writer_value uuid; writer_slug text;
begin
  if not exists (select 1 from public.reviewers where id = p_actor_id and is_active) then
    return jsonb_build_object('status','forbidden');
  end if;
  select * into current_post from public.posts where id = p_id for update;
  if not found then return jsonb_build_object('status','missing'); end if;
  if current_post.version is distinct from p_expected_version then
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
