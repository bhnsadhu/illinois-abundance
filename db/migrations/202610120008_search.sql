-- Search uses the same invoker view and anonymous RLS as every public page.
-- The existing GIN index covers headline, short version and edited body only.
create function public.search_public_posts(p_query text, p_limit integer default 13, p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(found) - 'search_document' - 'created_at'), '[]'::jsonb)
  from (
    select p.* from public.public_posts p
    where char_length(trim(p_query)) between 1 and 200
      and p.search_document @@ websearch_to_tsquery('english'::regconfig, left(p_query, 200))
    order by ts_rank_cd(p.search_document, websearch_to_tsquery('english'::regconfig, left(p_query, 200))) desc,
      p.published_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 13), 1), 50)
    offset least(greatest(coalesce(p_offset, 0), 0), 100000)
  ) found;
$$;
revoke all on function public.search_public_posts(text,integer,integer) from public, authenticated, service_role;
grant execute on function public.search_public_posts(text,integer,integer) to anon;
