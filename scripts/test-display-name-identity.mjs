// Identity guards: a display name is cosmetic and must never grant access to a
// Bloc, resolve an actor inside a Bloc, or relink a session to another account's
// memberships. Two different users may share a display name.
import assert from "node:assert/strict";
import {
  migrateAuthIdentity,
  resolveDisplayNameForUser,
  assertGroupMembershipForUser,
  isCurrentGroupMember,
  isGroupAdminActor,
  applyJoinGroup,
  scopeReadableStateForUser
} from "../api/lift-log.js";
import { getMembershipForUser } from "../src/lib/appState.js";

const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const IMPOSTOR_ID = "22222222-2222-2222-2222-222222222222";
const MEMBER_ID = "33333333-3333-3333-3333-333333333333";
const NAME = "Aadhil";

function ownerBloc(overrides = {}) {
  return {
    id: "bloc-owner",
    name: "Owner Bloc",
    inviteCode: "OWNERBL",
    adminName: NAME,
    adminUserId: OWNER_ID,
    memberOrder: [NAME],
    activeMemberOrder: [NAME],
    memberships: {
      [OWNER_ID]: { userId: OWNER_ID, displayName: NAME, role: "admin", joinedAt: null }
    },
    logs: {},
    excused: {},
    monthHistory: [],
    settings: { minTarget: 12, timeZone: "Europe/Oslo" },
    ...overrides
  };
}

function stateWith(group) {
  return {
    version: 2,
    groups: { [group.id]: group },
    groupOrder: [group.id],
    defaultGroupId: group.id,
    profiles: {
      [OWNER_ID]: { id: OWNER_ID, email: "owner@example.com", displayName: NAME },
      [IMPOSTOR_ID]: { id: IMPOSTOR_ID, email: "impostor@example.com", displayName: NAME },
      [MEMBER_ID]: { id: MEMBER_ID, email: "member@example.com", displayName: "Giang", profilePhotoUrl: "https://example.com/giang.jpg" }
    },
    meta: { revision: 1, updatedAt: new Date().toISOString() }
  };
}

// 1. A same-named account must not be backfilled into someone else's Bloc.
{
  const state = stateWith(ownerBloc());
  const migrated = migrateAuthIdentity(state, IMPOSTOR_ID, "impostor@example.com");
  assert.equal(migrated.changed, false, "same display name must not mint a membership");
  const group = migrated.state.groups["bloc-owner"];
  assert.equal(group.memberships[IMPOSTOR_ID], undefined);
  assert.equal(Object.keys(group.memberships).length, 1);
}

// 2. The same holds for a legacy Bloc that has the name in memberOrder but no
//    membership row at all — no auth-id evidence means no access.
{
  const legacy = ownerBloc({
    id: "bloc-legacy",
    adminUserId: null,
    memberships: {},
    memberOrder: [NAME, "Giang"],
    activeMemberOrder: [NAME, "Giang"]
  });
  const migrated = migrateAuthIdentity(stateWith(legacy), IMPOSTOR_ID, "impostor@example.com");
  assert.equal(migrated.state.groups["bloc-legacy"].memberships[IMPOSTOR_ID], undefined);
}

// 3. A legacy member WITH recorded auth-id evidence is still repaired.
{
  const legacy = ownerBloc({
    id: "bloc-legacy-linked",
    adminUserId: null,
    adminName: "Giang",
    memberships: {},
    memberOrder: ["Giang", NAME],
    activeMemberOrder: ["Giang", NAME],
    monthHistory: [{ key: "2026-5", memberAuthUserIds: { [NAME]: OWNER_ID } }]
  });
  const migrated = migrateAuthIdentity(stateWith(legacy), OWNER_ID, "owner@example.com");
  const repaired = migrated.state.groups["bloc-legacy-linked"];
  assert.equal(repaired.memberships[OWNER_ID]?.displayName, NAME, "linked legacy member should be repaired");
  assert.equal(repaired.memberships[OWNER_ID]?.role, "member");
}

// 4. Inside a Bloc, the actor name resolves only from memberships[userId].
{
  const state = stateWith(ownerBloc());
  assert.equal(resolveDisplayNameForUser(state, "bloc-owner", OWNER_ID, "owner@example.com"), NAME);
  assert.equal(resolveDisplayNameForUser(state, "bloc-owner", IMPOSTOR_ID, "impostor@example.com"), "");
  // Outside a Bloc the profile name is still fine — it is cosmetic there.
  assert.equal(resolveDisplayNameForUser(state, "", IMPOSTOR_ID, "impostor@example.com"), NAME);
}

// 5. Group-scoped mutations fail closed for a non-member.
{
  const state = stateWith(ownerBloc());
  assert.equal(assertGroupMembershipForUser(state, "bloc-owner", OWNER_ID), NAME);
  assert.throws(
    () => assertGroupMembershipForUser(state, "bloc-owner", IMPOSTOR_ID),
    err => err.status === 403
  );
}

// 6. Membership and admin checks never accept a name for an authenticated id.
{
  const group = ownerBloc();
  assert.equal(isCurrentGroupMember(group, NAME, OWNER_ID), true);
  assert.equal(isCurrentGroupMember(group, NAME, IMPOSTOR_ID), false);
  assert.equal(isGroupAdminActor(group, OWNER_ID, NAME), true);
  assert.equal(isGroupAdminActor(group, IMPOSTOR_ID, NAME), false);

  const legacyNoAdminId = ownerBloc({ adminUserId: null });
  assert.equal(isGroupAdminActor(legacyNoAdminId, OWNER_ID, NAME), true);
  assert.equal(isGroupAdminActor(legacyNoAdminId, IMPOSTOR_ID, NAME), false);
}

// 7. Joining requires a valid invite code, and a name already held by another
//    member in that Bloc is rejected (Bloc state is name-keyed).
{
  const state = stateWith(ownerBloc());
  assert.throws(
    () => applyJoinGroup(state, { userId: IMPOSTOR_ID, inviteCode: "OWNERBL" }),
    err => err.status === 409
  );
  assert.throws(
    () => applyJoinGroup(state, { userId: IMPOSTOR_ID, inviteCode: "NOPE" }),
    err => err.status === 404
  );
}

// 8. Read scoping never leaks another account's Blocs or profile.
{
  const scoped = scopeReadableStateForUser(stateWith(ownerBloc()), IMPOSTOR_ID);
  assert.deepEqual(scoped.groups, {});
  assert.deepEqual(scoped.groupOrder, []);
  assert.deepEqual(Object.keys(scoped.profiles), [IMPOSTOR_ID]);
}

// 8b. Read scoping preserves co-member profile photos for visible Blocs without
//     exposing profiles from unrelated Blocs.
{
  const scoped = scopeReadableStateForUser(stateWith(ownerBloc({
    memberOrder: [NAME, "Giang"],
    activeMemberOrder: [NAME, "Giang"],
    memberships: {
      [OWNER_ID]: { userId: OWNER_ID, displayName: NAME, role: "admin", joinedAt: null },
      [MEMBER_ID]: { userId: MEMBER_ID, displayName: "Giang", role: "member", joinedAt: null }
    }
  })), OWNER_ID);
  assert.equal(scoped.profiles[MEMBER_ID]?.profilePhotoUrl, "https://example.com/giang.jpg");
  assert.equal(scoped.profiles[MEMBER_ID]?.email, "");
  assert.equal(scoped.profiles[IMPOSTOR_ID], undefined);
}

// 9. Frontend: a real authenticated session resolves membership only by userId.
{
  const group = ownerBloc();
  const impostorSession = { userId: IMPOSTOR_ID, email: "impostor@example.com" };
  const impostorProfile = { id: IMPOSTOR_ID, email: "impostor@example.com", displayName: NAME };
  assert.equal(getMembershipForUser(group, impostorSession, impostorProfile), null);
  assert.equal(
    getMembershipForUser(group, { userId: OWNER_ID, email: "owner@example.com" }, null)?.displayName,
    NAME
  );
  // Local preview impersonation keeps the name-based lookup on purpose.
  const previewSession = { userId: "local-preview:aadhil", localPreview: true, previewDisplayName: NAME };
  assert.equal(getMembershipForUser(group, previewSession, null)?.displayName, NAME);
}

console.log("Display-name identity guard tests passed");
