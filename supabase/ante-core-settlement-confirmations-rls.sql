grant usage on schema ante_core to authenticated;
grant select, update on ante_core.settlement_confirmations to authenticated;

alter table ante_core.settlement_confirmations enable row level security;

drop policy if exists "settlement confirmations readable by active bloc members" on ante_core.settlement_confirmations;
create policy "settlement confirmations readable by active bloc members"
on ante_core.settlement_confirmations
for select
to authenticated
using (
  exists (
    select 1
    from ante_core.bloc_members bm
    join ante_core.profiles p
      on p.id = bm.profile_id
    where bm.bloc_id = settlement_confirmations.bloc_id
      and bm.left_at is null
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "payers can claim settlement confirmations" on ante_core.settlement_confirmations;
create policy "payers can claim settlement confirmations"
on ante_core.settlement_confirmations
for update
to authenticated
using (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.payer_profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.payer_profile_id
      and p.auth_user_id = auth.uid()
  )
);

drop policy if exists "receivers can confirm settlement confirmations" on ante_core.settlement_confirmations;
create policy "receivers can confirm settlement confirmations"
on ante_core.settlement_confirmations
for update
to authenticated
using (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.receiver_profile_id
      and p.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from ante_core.profiles p
    where p.id = settlement_confirmations.receiver_profile_id
      and p.auth_user_id = auth.uid()
  )
);
