-- App Store privacy hardening: profile and workout photos must not be public
-- by possession of a durable URL. The API signs reads for an authenticated
-- current Bloc member after it has scoped the state response.
--
-- Run only after the matching API code is deployed and verified. This affects
-- existing assets immediately, so take the normal Supabase backup first.

update storage.buckets
set public = false
where id in ('profile-photos', 'workout-photos')
  and public is distinct from false;
