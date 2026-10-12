-- One opaque, daily hash per published piece. The server never stores raw IPs,
-- user agents, reader accounts, or cross-day tracking identifiers.
create function public.record_post_view(p_post_id uuid,p_visitor_hash text) returns void
language sql security invoker set search_path = '' as $$
  insert into public.post_views(post_id,view_day,visitor_hash)
  select id,(now() at time zone 'UTC')::date,p_visitor_hash
  from public.posts where id=p_post_id and status='published'
  on conflict do nothing;
$$;
revoke all on function public.record_post_view(uuid,text) from public,anon,authenticated;
grant execute on function public.record_post_view(uuid,text) to service_role;
