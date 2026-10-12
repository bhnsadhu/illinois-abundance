-- Storage tables are supplied by Supabase, not by the application.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('covers','covers',false,5242880,array['image/jpeg','image/png','image/webp','image/avif'])
      on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
        allowed_mime_types=excluded.allowed_mime_types;
  end if;
end $$;
-- All cover reads and writes use the service role. The /covers route checks
-- public_posts before serving a published cover, so draft covers stay private.
-- No client storage policy is created.
