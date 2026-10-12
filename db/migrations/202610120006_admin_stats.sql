-- Aggregate private counters only through the trusted admin server path.
create function public.get_admin_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'published_count', (select count(*) from public.posts where status = 'published'),
    'submission_count', (select count(*) from public.submission_private where not is_sample),
    'median_publish_hours', (
      select percentile_cont(0.5) within group (
        order by extract(epoch from (p.published_at - p.created_at)) / 3600.0
      )
      from public.posts p join public.submission_private s on s.post_id = p.id
      where p.published_at is not null and not p.is_sample and not s.is_sample
    ),
    'active_writer_count', (
      select count(distinct writer_id) from public.posts where status = 'published'
    ),
    'subscriber_count', (select count(*) from public.subscribers where confirmed_at is not null),
    'top_posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ranked.id, 'slug', ranked.slug, 'headline', ranked.headline, 'views', ranked.views
      ) order by ranked.views desc, ranked.published_at desc, ranked.id)
      from (
        select p.id, p.slug, p.headline, p.published_at, count(v.post_id) as views
        from public.posts p left join public.post_views v on v.post_id = p.id
        where p.status = 'published'
        group by p.id
        order by views desc, p.published_at desc, p.id
        limit 10
      ) ranked
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.get_admin_stats() from public, anon, authenticated;
grant execute on function public.get_admin_stats() to service_role;
