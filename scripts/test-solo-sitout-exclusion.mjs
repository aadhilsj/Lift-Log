import assert from "node:assert/strict";
import {
  applyRequestCancel,
  applySitOutRequest,
  applySitOutReview,
  applySoloRequest,
  applySoloReview
} from "../api/lift-log.js";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const GROUP_ID = "request-guard-bloc";

function currentMonthKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "numeric"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${Number(values.month) - 1}`;
}

function state() {
  const monthKey = currentMonthKey();
  return {
    version: 2,
    groups: {
      [GROUP_ID]: {
        id: GROUP_ID,
        name: "Request guard Bloc",
        inviteCode: "GUARDS",
        adminName: "Admin",
        adminUserId: ADMIN_ID,
        memberOrder: ["Admin", "Member"],
        activeMemberOrder: ["Admin", "Member"],
        memberships: {
          [ADMIN_ID]: { userId: ADMIN_ID, displayName: "Admin", role: "admin", joinedAt: null },
          [MEMBER_ID]: { userId: MEMBER_ID, displayName: "Member", role: "member", joinedAt: null }
        },
        logs: { Admin: [], Member: [] },
        excused: {},
        solo: {},
        sitOutRequests: {},
        soloRequests: {},
        monthHistory: [],
        lastMonth: monthKey,
        settings: { minTarget: 12, timeZone: "Europe/Oslo" }
      }
    },
    groupOrder: [GROUP_ID],
    profiles: {},
    meta: { revision: 0, updatedAt: null }
  };
}

const memberPayload = { groupId: GROUP_ID, actor: "Member", actorUserId: MEMBER_ID };
const adminPayload = { groupId: GROUP_ID, actor: "Admin", actorUserId: ADMIN_ID };

function expectStatus(fn, message) {
  assert.throws(fn, error => error?.status === 400 && message.test(error.message));
}

{
  const soloPending = applySoloRequest(state(), { ...memberPayload, personalTarget: 6, reason: "Travel" });
  expectStatus(
    () => applySitOutRequest(soloPending, { ...memberPayload, reason: "Travel" }),
    /Solo Mode is active or pending/
  );

  const { state: cancelled } = applyRequestCancel(soloPending, memberPayload, "solo");
  const next = applySitOutRequest(cancelled, { ...memberPayload, reason: "Travel" });
  assert.equal(next.groups[GROUP_ID].sitOutRequests[currentMonthKey()].Member.status, "pending", "cancelling Solo makes Sit out available again");
}

{
  const sitOutPending = applySitOutRequest(state(), { ...memberPayload, reason: "Travel" });
  expectStatus(
    () => applySoloRequest(sitOutPending, { ...memberPayload, personalTarget: 6, reason: "Travel" }),
    /sit-out request is pending/
  );

  const { state: cancelled } = applyRequestCancel(sitOutPending, memberPayload, "sitout");
  const next = applySoloRequest(cancelled, { ...memberPayload, personalTarget: 6, reason: "Travel" });
  assert.equal(next.groups[GROUP_ID].soloRequests[currentMonthKey()].Member.status, "pending", "cancelling Sit out makes Solo available again");
}

{
  const monthKey = currentMonthKey();
  const bothPending = state();
  bothPending.groups[GROUP_ID].sitOutRequests = { [monthKey]: { Member: { memberName: "Member", monthKey, status: "pending", requestedByUserId: MEMBER_ID } } };
  bothPending.groups[GROUP_ID].soloRequests = { [monthKey]: { Member: { memberName: "Member", monthKey, status: "pending", personalTarget: 6, requestedByUserId: MEMBER_ID } } };

  const soloApproved = applySoloReview(bothPending, { ...adminPayload, memberName: "Member", monthKey, decision: "approve" });
  expectStatus(
    () => applySitOutReview(soloApproved, { ...adminPayload, memberName: "Member", monthKey, decision: "approve" }),
    /already Solo/
  );

  const sitOutApproved = applySitOutReview(bothPending, { ...adminPayload, memberName: "Member", monthKey, decision: "approve" });
  expectStatus(
    () => applySoloReview(sitOutApproved, { ...adminPayload, memberName: "Member", monthKey, decision: "approve" }),
    /already sitting out/
  );
}

console.log("Solo and sit-out exclusion checks passed.");
