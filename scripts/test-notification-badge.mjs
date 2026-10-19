// The "For you" reaction badge shows the emoji MOST RECENTLY used, which is
// what the founder asked for on 16 October 2026 and what
// docs/handover-2026-10-15-session-catch-up.md §2.8 recorded as impossible at
// the time. It became possible when read_ante_core_current_logs started
// returning `latest_reaction` beside `reactions`.
//
// These checks exist because the fallback is the part that breaks quietly: the
// badge must still be the emoji the most people chose whenever recency is not
// available, and it must never show an emoji nobody in the row actually used.
import assert from "node:assert/strict";
import { normalizeLogEntry } from "../api/lift-log.js";
import { buildNotifications, unreadCount } from "../src/lib/notificationCentre.js";

const ME = "Riley";
const MY_ID = "user-riley";

function blocWith(log) {
  return {
    memberships: {
      [MY_ID]:    { userId: MY_ID,    displayName: ME },
      "user-jo":  { userId: "user-jo",  displayName: "Jo" },
      "user-sam": { userId: "user-sam", displayName: "Sam" },
      "user-ash": { userId: "user-ash", displayName: "Ash" }
    },
    memberOrder: [ME, "Jo", "Sam", "Ash"],
    logs: { [ME]: [log] }
  };
}

function badgeFor(log) {
  const items = buildNotifications({
    group: blocWith(log), currentUser: ME, currentUserId: MY_ID,
    reminderCards: [], formatAmount: n => `$${n}`
  });
  const row = items.find(item => item.kind === "reaction");
  assert.ok(row, "the fixture must produce one reaction row");
  return row.badge;
}

const BASE = {
  id: "log-1", date: "2026-10-16", type: "Gym",
  createdAt: "2026-10-16T06:00:00.000Z", verifiedVia: "photo"
};

// ── The newest emoji wins, even when it is the least popular ────────────────
// Two people chose 💪 and one chose 🔥, but 🔥 was the most recent. Before this
// change the badge read 💪; the founder asked for 🔥.
{
  const log = {
    ...BASE,
    reactions: { "💪": ["Jo", "Sam"], "🔥": ["Ash"] },
    latestReaction: { emoji: "🔥", at: "2026-10-16T09:30:00.000Z" }
  };
  assert.equal(badgeFor(log), "🔥", "the most recent emoji wins over the most chosen");
}

// ── Without the field, the badge is what it always was ──────────────────────
// An older server, canonical unavailable, or a log the overlay never reached.
{
  const log = { ...BASE, reactions: { "💪": ["Jo", "Sam"], "🔥": ["Ash"] } };
  assert.equal(badgeFor(log), "💪", "no latestReaction falls back to the most chosen");
}

// ── A latestReaction naming an emoji nobody in the row used is ignored ──────
// Your own reaction is the one case that really happens: the row is about other
// people, so badging your own emoji would be wrong.
{
  const log = {
    ...BASE,
    reactions: { "💪": ["Jo", "Sam"], "🎉": [ME] },
    latestReaction: { emoji: "🎉", at: "2026-10-16T10:00:00.000Z" }
  };
  assert.equal(badgeFor(log), "💪", "your own emoji being newest does not badge the row");
}
{
  const log = {
    ...BASE,
    reactions: { "💪": ["Jo"] },
    latestReaction: { emoji: "🥦", at: "2026-10-16T10:00:00.000Z" }
  };
  assert.equal(badgeFor(log), "💪", "an emoji not in reactions at all is ignored");
}

// ── One emoji, one reactor: both routes give the same answer ────────────────
{
  const withField = { ...BASE, reactions: { "👏": ["Jo"] }, latestReaction: { emoji: "👏", at: "2026-10-16T09:00:00.000Z" } };
  const without   = { ...BASE, reactions: { "👏": ["Jo"] } };
  assert.equal(badgeFor(withField), "👏");
  assert.equal(badgeFor(without), "👏");
}

// ── The server keeps the field only while it still means something ──────────
{
  const kept = normalizeLogEntry({
    ...BASE,
    reactions: { "🔥": ["Ash"] },
    latestReaction: { emoji: "🔥", at: "2026-10-16T09:30:00.000Z" }
  });
  assert.deepEqual(kept.latestReaction, { emoji: "🔥", at: "2026-10-16T09:30:00.000Z" },
    "a valid latestReaction survives normalizeLogEntry");

  // A reaction taken back must not leave the badge pointing at it.
  const dangling = normalizeLogEntry({
    ...BASE,
    reactions: { "💪": ["Jo"] },
    latestReaction: { emoji: "🔥", at: "2026-10-16T09:30:00.000Z" }
  });
  assert.ok(!("latestReaction" in dangling),
    "an emoji no longer in reactions is dropped, not carried");

  const noReactions = normalizeLogEntry({ ...BASE, reactions: {}, latestReaction: { emoji: "🔥", at: "2026-10-16T09:30:00.000Z" } });
  assert.ok(!("latestReaction" in noReactions), "no reactions means no latestReaction");

  const absent = normalizeLogEntry({ ...BASE, reactions: { "💪": ["Jo"] } });
  assert.ok(!("latestReaction" in absent), "the field is absent rather than null when nothing supplied it");

  // Rubbish from an unexpected shape must not reach the client.
  for (const latestReaction of [null, {}, { emoji: "" }, { emoji: "   " }, "💪", 7, { emoji: "💪", at: "not-a-date" }]) {
    const entry = normalizeLogEntry({ ...BASE, reactions: { "💪": ["Jo"] }, latestReaction });
    if (entry.latestReaction) {
      assert.equal(entry.latestReaction.emoji, "💪");
      assert.equal(entry.latestReaction.at, null, "an unparseable timestamp becomes null, never a crash");
    }
  }

  // The timestamp is normalised to ISO, the way createdAt is.
  const reformatted = normalizeLogEntry({
    ...BASE,
    reactions: { "💪": ["Jo"] },
    latestReaction: { emoji: "💪", at: "2026-10-16T09:30:00Z" }
  });
  assert.equal(reformatted.latestReaction.at, "2026-10-16T09:30:00.000Z", "the timestamp is normalised to ISO");
}

// ── `reactions` itself is untouched, which is the whole point of a sibling ───
// normalizeReactions, the optimistic updates in App.jsx and the Activity feed
// all depend on {emoji: [names]}.
{
  const entry = normalizeLogEntry({
    ...BASE,
    reactions: { "💪": ["Jo", "Jo", "Sam"], "": ["Ash"], "🔥": [] },
    latestReaction: { emoji: "💪", at: "2026-10-16T09:30:00.000Z" }
  });
  assert.deepEqual(entry.reactions, { "💪": ["Jo", "Sam"] },
    "reactions still de-duplicates, drops empty emojis and drops empty lists");
}

// ── What the BELL counts, not just what the badge shows ─────────────────────
// Added 19 October 2026. The founder asked whether the bell lights up for a
// reaction, and it did not: a reaction row was dated by the WORKOUT, so
// reacting to anything but a brand-new log produced a row older than the last
// time the centre was opened, and unreadCount skipped it. Nothing here was
// covered by a test, which is how it shipped.
{
  const SEEN = "2026-10-15T00:00:00.000Z";   // the last time the bell was tapped
  const LATER = "2026-10-16T09:00:00.000Z";  // everything below happens after it
  // A workout from BEFORE the centre was last opened. This is the case that
  // was broken: the reaction is new, the workout is not.
  const OLD_LOG = {
    id: "log-old", date: "2026-10-10", type: "Gym",
    createdAt: "2026-10-10T06:00:00.000Z", verifiedVia: "photo"
  };
  const countFor = log => unreadCount(buildNotifications({
    group: blocWith(log), currentUser: ME, currentUserId: MY_ID,
    reminderCards: [], formatAmount: n => `$${n}`
  }), SEEN);

  assert.equal(countFor({
    ...OLD_LOG,
    reactions: { "🔥": ["Jo"] },
    latestReaction: { emoji: "🔥", at: LATER }
  }), 1, "a reaction arriving after the last open counts, even on an older workout");

  // The row carries the reaction's time, so "today" is what the row reads and
  // Today/This week/Earlier puts it in the right section.
  const row = buildNotifications({
    group: blocWith({ ...OLD_LOG, reactions: { "🔥": ["Jo"] }, latestReaction: { emoji: "🔥", at: LATER } }),
    currentUser: ME, currentUserId: MY_ID, reminderCards: [], formatAmount: n => `$${n}`
  }).find(item => item.kind === "reaction");
  assert.equal(row.when, LATER, "the reaction row is dated by the reaction");

  // Without a usable timestamp there is nothing better than the workout's own
  // time. This is the documented limit, not an accident: an older server or a
  // log canonical did not reach still produces a row, it just cannot date it.
  assert.equal(countFor({
    ...OLD_LOG,
    reactions: { "🔥": ["Jo"] }
  }), 0, "no latestReaction timestamp falls back to the workout's time");

  assert.equal(countFor({
    ...OLD_LOG,
    reactions: { "🔥": ["Jo"] },
    latestReaction: { emoji: "🔥", at: "not a date" }
  }), 0, "an unparseable timestamp falls back rather than throwing");

  // Your own reaction must not light your own bell. Only Jo's 🔥 belongs to
  // somebody else, so a newest-emoji of 💪 — which only Riley used — is not
  // trusted to date the row.
  assert.equal(countFor({
    ...OLD_LOG,
    reactions: { "🔥": ["Jo"], "💪": [ME] },
    latestReaction: { emoji: "💪", at: LATER }
  }), 0, "your own reaction being the newest does not date the row");

  // A reaction older than the last open is not news.
  assert.equal(countFor({
    ...OLD_LOG,
    reactions: { "🔥": ["Jo"] },
    latestReaction: { emoji: "🔥", at: "2026-10-12T08:00:00.000Z" }
  }), 0, "a reaction from before the last open is not counted");

  // A log nobody reacted to produces no row at all, so nothing to count.
  assert.equal(countFor(OLD_LOG), 0, "a log with no reactions produces no row");
}

console.log("All notification badge checks passed.");
