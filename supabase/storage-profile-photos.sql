-- Supabase Storage - profile-photos bucket
--
-- PURPOSE:
--   Hosts durable global profile pictures for Antè users.
--   Do not store these in workout-photos: workout photos are subject to cleanup,
--   while profile photos are account-level assets used across every Bloc.
--
-- BUCKET:
--   Name:             profile-photos
--   Public:           true
--   File size limit:  5 MB
--   Allowed MIME:     image/jpeg, image/png, image/gif, image/webp
--
-- PATH CONVENTION:
--   {auth_user_id}/{Date.now()}.jpg
--
-- APP MODEL:
--   The public URL is stored once on ante_core.profiles.profile_photo_url.
--   Profile photo edits happen only from the main profile page entered via the
--   Bloc switcher. All Bloc/member surfaces render the same global URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'authenticated users can upload own profile photos'
  ) then
    create policy "authenticated users can upload own profile photos"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'profile-photos'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'service role can delete profile photos'
  ) then
    create policy "service role can delete profile photos"
    on storage.objects
    for delete
    to service_role
    using (bucket_id = 'profile-photos');
  end if;
end $$;
