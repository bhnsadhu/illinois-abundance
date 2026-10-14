-- Public presentation content only; never store credentials or private submissions here.
create table public.site_content (
  section text primary key check (section in ('branding','navigation','home','about','stories','events','write','search','reader','access','learn','showUp','newsletter','visibility')),
  content jsonb not null check (jsonb_typeof(content)='object' and octet_length(content::text)<=100000),
  version integer not null default 1 check (version>0),
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
revoke all on public.site_content from public,anon,authenticated;
grant select on public.site_content to anon,authenticated;
grant all on public.site_content to service_role;
create policy site_content_public on public.site_content for select to anon,authenticated using (true);
create view public.public_site_content with (security_invoker=true,security_barrier=true) as select section,content,version from public.site_content;
grant select on public.public_site_content to anon,authenticated,service_role;

create function public.save_site_content(p_section text,p_values jsonb,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved_version integer;
begin
  if p_expected_version=0 then
    insert into public.site_content(section,content) values(p_section,p_values) on conflict(section) do nothing returning version into saved_version;
  else
    update public.site_content set content=p_values,version=version+1,updated_at=now()
      where section=p_section and version=p_expected_version returning version into saved_version;
  end if;
  if saved_version is null then return jsonb_build_object('status','conflict'); end if;
  return jsonb_build_object('status','ok','version',saved_version);
end $$;
revoke all on function public.save_site_content(text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_site_content(text,jsonb,integer) to service_role;

alter table public.topics add column image_url text,add column image_alt text;
alter table public.events add column image_url text,add column image_alt text;
create or replace view public.public_topics with (security_invoker=true,security_barrier=true) as
 select id,slug,name,description,sort_order,is_active,is_sample,image_url,image_alt from public.topics where is_active;
create or replace view public.public_story_topics with (security_invoker=true,security_barrier=true) as
 select id,slug,name,description,sort_order,is_active,is_sample,image_url,image_alt from public.topics
 where is_active or exists(select 1 from public.posts where topic_id=topics.id and status='published');
create or replace view public.public_events with (security_invoker=true,security_barrier=true) as
 select id,slug,title,description,starts_at,ends_at,location,rsvp_url,recap_post_id,is_published,is_sample,image_url,image_alt from public.events where is_published;
