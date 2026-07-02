-- Read RPC for ante_core.bloc_members.
-- Returns active (left_at IS NULL) canonical member rows for all legacy-keyed blocs.
-- Reads from the private ante_core schema; never exposes the schema directly.
-- Mirrors the shape written by upsert_ante_core_bloc_member.
--
-- Call via: POST /rest/v1/rpc/read_ante_core_bloc_members
--
-- Return shape (jsonb array):
--   [{
--     "legacy_group_key":  text,
--     "auth_user_id":      text,
--     "display_name":      text,
--     "role":              text,   -- 'admin' | 'member'
--     "joined_at":         timestamptz|null,
--     "joined_month_key":  text|null,
--     "sort_order":        integer|null
--   }, ...]
--
-- Filters:
--   - left_at IS NULL               — active members only
--   - blocs.legacy_group_key IS NOT NULL — only blocs with a blob counterpart
--   - profiles.auth_user_id IS NOT NULL  — only auth-linked profiles (importer-only
--     legacy-key profiles have no auth_user_id and cannot be keyed into the JS
--     memberships map, so returning them would be useless)
--
-- Access: service_role only. anon, authenticated, and PUBLIC are explicitly denied.

create or replace function public.read_ante_core_bloc_members()
returns jsonb
language plpgsql
security definer
set search_path = ante_core, public
as $$
declare
  result jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'legacy_group_key', b.legacy_group_key,
        'auth_user_id',     p.auth_user_id::text,
        'display_name',     bm.display_name_snapshot,
        'role',             bm.role::text,
        'joined_at',        bm.joined_at,
        'joined_month_key', bm.joined_month_key,
        'sort_order',       bm.sort_order
      )
    ),
    '[]'::jsonb
  )
  into result
  from ante_core.bloc_members bm
  join ante_core.profiles p
    on p.id = bm.profile_id
  join ante_core.blocs b
    on b.id = bm.bloc_id
  where bm.left_at              is null
    and b.legacy_group_key      is not null
    and p.auth_user_id          is not null;

  return result;
end;
$$;

revoke execute on function public.read_ante_core_bloc_members() from public;
revoke execute on function public.read_ante_core_bloc_members() from anon;
revoke execute on function public.read_ante_core_bloc_members() from authenticated;
grant  execute on function public.read_ante_core_bloc_members() to service_role;
