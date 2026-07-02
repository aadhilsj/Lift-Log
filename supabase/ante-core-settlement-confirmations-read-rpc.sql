create or replace function public.read_ante_core_settlement_confirmations()
returns jsonb
language sql
security definer
set search_path = ante_core, public
as '
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        ''id'', sc.id,
        ''legacy_group_key'', b.legacy_group_key,
        ''bloc_id'', sc.bloc_id,
        ''season_id'', sc.season_id,
        ''month_key'', s.month_key,
        ''month_label'', s.label,
        ''payer_auth_user_id'', case
          when payer.auth_user_id is null then null
          else payer.auth_user_id::text
        end,
        ''receiver_auth_user_id'', case
          when receiver.auth_user_id is null then null
          else receiver.auth_user_id::text
        end,
        ''payer_display_name'', sc.payer_display_name_snapshot,
        ''receiver_display_name'', sc.receiver_display_name_snapshot,
        ''amount'', sc.amount,
        ''currency'', sc.currency,
        ''payer_claimed_at'', case
          when sc.payer_claimed_at is null then null
          else to_char(sc.payer_claimed_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')
        end,
        ''confirmed_at'', case
          when sc.confirmed_at is null then null
          else to_char(sc.confirmed_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')
        end,
        ''created_at'', to_char(sc.created_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"''),
        ''updated_at'', to_char(sc.updated_at at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')
      )
      order by s.month_key desc, sc.created_at asc
    ),
    ''[]''::jsonb
  )
  from ante_core.settlement_confirmations sc
  join ante_core.seasons s
    on s.id = sc.season_id
  join ante_core.blocs b
    on b.id = sc.bloc_id
  join ante_core.profiles payer
    on payer.id = sc.payer_profile_id
  join ante_core.profiles receiver
    on receiver.id = sc.receiver_profile_id
  where b.legacy_group_key is not null;
';

revoke execute on function public.read_ante_core_settlement_confirmations() from public;
revoke execute on function public.read_ante_core_settlement_confirmations() from anon;
revoke execute on function public.read_ante_core_settlement_confirmations() from authenticated;
grant execute on function public.read_ante_core_settlement_confirmations() to service_role;
