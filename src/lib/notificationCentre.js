// The notification centre: everything in this Bloc that involves YOU.
//
// The Bloc Stream is the Bloc's shared room and the Activity feed is everyone's
// workouts. Neither answers "what happened to me while I was away", which is
// what this does: your logs' reactions and comments, and money you owe or are
// owed.
//
// Everything here is derived from state the client already holds. Nothing is
// fetched, and nothing is written.
//
// Two things here are NOT derived from state the client already holds, and are
// fetched once when the centre is opened rather than on every refresh:
//   - the newest comment on each of your logs (who wrote it and what it said)
//   - @mentions of you in the Bloc Stream
// Both arrive as arguments. Missing them is normal, not an error: the rows
// simply fall back to what the client does know.
//
// Still not covered: @mentions inside a comment thread.
//
// Also not here, deliberately: the "say what the money's going toward" prompt
// from docs/concept-2026-09-24-notification-centre.md. It is written, on
// origin/feat/settlement-note, but the note it collects is stored in
// localStorage only — it never reaches the API, the blob or canonical, so
// nobody else in the Bloc would ever see it. It needs a real save before the
// prompt can be shown to anyone.

import { getLogDisplayActivity } from "./activities.js";

const MS_DAY = 86400000;
// How long a row stays. After five weeks a reaction, a comment or a mention is
// history rather than news, and nobody is going to act on it. Money is not on
// this clock: a debt is still a debt however old it is.
const MAX_AGE_DAYS = 35;

// How old a row is, in days. Both the words on the row and the section it is
// filed under come from this one number — otherwise a row reads "today" while
// sitting under "This week", which is exactly what happened the first time
// these were worked out separately.
function daysAgo(iso, now) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / MS_DAY);
}

// Relative time, in the app's plain voice.
export function shortWhen(iso, now = Date.now()) {
  const days = daysAgo(iso, now);
  if (days === null) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "last month" : `${months} months ago`;
}

function logWhen(log) {
  return log?.createdAt || (log?.date ? `${log.date}T12:00:00.000Z` : "");
}

// "your Gym Log", "your Padel Log". The activity name and "Log" both keep
// their capital: it reads as the name of the thing, not a description of it.
//
// getLogDisplayActivity is the app's own answer, used by the feed, the month
// calendar and the log modal: the activity the member actually chose, falling
// back to the broad category only when there is no activity on the log. Using
// `type` alone said "your Sports Log" for every racket and ball sport, and
// Sports has not been something anyone can log for a long time.
function describeWorkout(log) {
  const raw = String(getLogDisplayActivity(log) || "").trim();
  const name = raw ? raw[0].toUpperCase() + raw.slice(1) : "";
  return name ? `your ${name} Log` : "your Log";
}

// A list of names as a sentence: "Jo", "Jo and Sam", "Jo, Sam and 2 others".
function nameList(names) {
  const list = names.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} other${list.length - 2 === 1 ? "" : "s"}`;
}

// ── Reactions and comments on your own logs ──────────────────────────────────
// Each row carries who it was (for the avatars), one emoji (for the badge) and
// the workout (for the square on the right).
function ownLogItems(group, currentUser, userIdFor, latestComments, latestCommentsLoaded) {
  const mine = group?.logs?.[currentUser] || [];
  const items = [];
  mine.forEach(log => {
    const when = logWhen(log);
    // The square on the right: the workout's own photo while it still exists,
    // and the activity icon once it does not. Photos are deleted after 72
    // hours (shouldKeepLogPhoto in appState.js), and past months are stripped
    // of them entirely, so most rows will show the icon.
    const thumbPhotoUrl = typeof log?.photoUrl === "string" ? log.photoUrl : "";
    const thumbType = String(getLogDisplayActivity(log) || "").trim();

    // One row per log, not one per reaction: five reactions on one workout is
    // one thing that happened, not five.
    const reactors = [];
    Object.entries(log?.reactions || {}).forEach(([emoji, members]) => {
      (Array.isArray(members) ? members : []).forEach(member => {
        const name = typeof member === "string" ? member : member?.displayName || member?.name;
        if (name && name !== currentUser) reactors.push({ name, emoji });
      });
    });
    if (reactors.length) {
      const unique = [...new Set(reactors.map(r => r.name))];
      // One emoji, never a row of them — and the one most recently used, which
      // is what the founder asked for.
      //
      // `latestReaction` is a sibling of `reactions` on the log, added to
      // read_ante_core_current_logs on 16 October 2026 because {emoji: [names]}
      // carries no timestamps and jsonb sorts its keys, so recency could not
      // survive the trip. When it is missing — an older server, canonical
      // unavailable, a log the overlay did not reach — the badge falls back to
      // the emoji the most people chose, which is what it was before.
      const newestEmoji = String(log?.latestReaction?.emoji || "").trim();
      const tally = new Map();
      reactors.forEach(r => tally.set(r.emoji, (tally.get(r.emoji) || 0) + 1));
      const mostChosen = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      // Only your own reaction being the newest is not worth badging: every
      // reactor shown here is somebody else, so the badge must be one of
      // theirs. Falling back keeps the row about them.
      const badgeEmoji = newestEmoji && reactors.some(r => r.emoji === newestEmoji)
        ? newestEmoji
        : mostChosen;
      items.push({
        id: `reaction:${log.id}`,
        kind: "reaction",
        badge: badgeEmoji,
        people: unique.slice(0, 2).map(name => ({ name, userId: userIdFor(name) })),
        title: `${nameList(unique)} reacted to ${describeWorkout(log)}`,
        meta: shortWhen(when),
        when,
        thumbPhotoUrl,
        thumbType,
        opens: "activity",
        logId: log.id
      });
    }
    // The newest comment, if it has been fetched.
    //
    // Once the fetch has landed its number is the ONLY one worth having: it
    // counts other people's comments and leaves out your own, which the blob's
    // commentCount does not. Your reply to somebody else on your own log is
    // not news to you, and a log whose only comments are yours gets no row at
    // all. Until it lands, the blob's count is all there is.
    const latest = latestComments?.[String(log.id)] || null;
    const comments = latestCommentsLoaded
      ? Number(latest?.total || 0)
      : Number(log?.commentCount || 0);
    if (comments > 0) {
      const author = String(latest?.commenterName || "").trim();
      const said = commentSnippet(latest?.body);
      const others = comments - 1;
      items.push({
        id: `comment:${log.id}`,
        kind: "comment",
        badge: "",
        // Without the fetch there is nobody to show, and inventing a face
        // would be worse than leading with the comment mark.
        people: author && author !== currentUser ? [{ name: author, userId: userIdFor(author) }] : [],
        title: author
          ? (others > 0
              // "and 2 others" rather than a second line: the row stays one
              // height whether a workout has one comment or nine.
              ? `${author} and ${others} other${others === 1 ? "" : "s"} commented on ${describeWorkout(log)}`
              : `${author} commented on ${describeWorkout(log)}`)
          : (comments === 1 ? `A comment on ${describeWorkout(log)}` : `${comments} comments on ${describeWorkout(log)}`),
        // What they actually said, under the sentence, the way Instagram does.
        body: said,
        meta: shortWhen(latest?.createdAt || when),
        when: latest?.createdAt || when,
        thumbPhotoUrl,
        thumbType,
        opens: "comments",
        logId: log.id
      });
    }
  });
  return items;
}

// One line of what was said. Long comments are cut on a word where possible,
// because a hard cut mid-word reads like a bug.
const COMMENT_SNIPPET_MAX = 80;
function commentSnippet(body) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= COMMENT_SNIPPET_MAX) return text;
  const cut = text.slice(0, COMMENT_SNIPPET_MAX);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > COMMENT_SNIPPET_MAX - 18 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// ── Being tagged in the Bloc Stream ──────────────────────────────────────────
// The stream read already returns each message's mentions as auth user ids, so
// this needs no new database work — only the messages, which are fetched when
// the centre opens.
function mentionItems(streamMessages, currentUserId, nameForUserId) {
  if (!currentUserId) return [];
  return (Array.isArray(streamMessages) ? streamMessages : [])
    .filter(message => {
      if (String(message?.author_id || "") === String(currentUserId)) return false;
      const mentions = Array.isArray(message?.mentions) ? message.mentions : [];
      return mentions.some(id => String(id) === String(currentUserId));
    })
    .map(message => {
      const author = nameForUserId(String(message?.author_id || "")) || "Someone";
      return {
        id: `mention:${message.id}`,
        kind: "mention",
        badge: "@",
        people: [{ name: author, userId: String(message?.author_id || "") }],
        title: `${author} mentioned you in the Bloc Stream`,
        body: commentSnippet(message?.body),
        meta: shortWhen(message?.created_at),
        when: message?.created_at || "",
        opens: "stream",
        messageId: String(message?.id || "")
      };
    });
}

// ── Money ────────────────────────────────────────────────────────────────────
// Reuses the settlement reminder cards Today already builds, so the two can
// never disagree about who owes what.
function moneyItems(reminderCards, currentUser, formatAmount, userIdFor) {
  // One row per month, payer and receiver. The card builder already keys on
  // exactly that, but the same pair can arrive twice if a month appears twice
  // in monthHistory, and two identical rows read as a bug.
  const seen = new Set();
  return (reminderCards || []).map(card => {
    const youPay = card.payerDisplayName === currentUser;
    const youGet = card.receiverDisplayName === currentUser;
    if (!youPay && !youGet) return null;
    if (seen.has(card.key)) return null;
    seen.add(card.key);
    const amount = formatAmount ? formatAmount(card.amount, card.currency) : `${card.amount}`;
    // The other person in the pair: theirs is the face on the row.
    const other = youPay ? card.receiverDisplayName : card.payerDisplayName;
    return {
      id: `money:${card.key}`,
      kind: "money",
      direction: youPay ? "pay" : "owed",
      badge: "",
      people: [{ name: other, userId: userIdFor(other) }],
      title: youPay
        ? `You still owe ${card.receiverDisplayName} ${amount}`
        : `${card.payerDisplayName} still owes you ${amount}`,
      meta: card.monthLabel || "",
      when: "",
      // Both directions sit at the top of the list: the founder asked to see
      // what he is owed there too, not only what he owes.
      pinned: true,
      // But only what YOU owe keeps the bell lit. Being owed is not a thing
      // you can act on, and a badge that can never be cleared is nagging.
      alwaysUnread: youPay,
      opens: "settlement",
      monthKey: card.monthKey
    };
  }).filter(Boolean);
}

// What to call the money section, which depends on what is in it:
//   only money you owe        -> "Needs you"   (there is something to do)
//   anything owed to you      -> "Settling up" (quieter, covers both ways)
export function moneyHeading(moneyRows) {
  if (!moneyRows.length) return "";
  return moneyRows.every(row => row.direction === "pay") ? "Needs you" : "Settling up";
}

// Today / This week / Earlier, so a long list is ordered at a glance. A row
// with no timestamp falls to Earlier rather than claiming to be recent.
// The thresholds are shortWhen's own: anything it calls "today" is filed under
// Today, and anything it dates within the week is filed under This week.
function timeBucket(when, now) {
  const days = daysAgo(when, now);
  if (days === null) return "earlier";
  if (days <= 0) return "today";
  if (days < 7) return "week";
  return "earlier";
}

// The list as the screen draws it: the money section first, under whichever
// heading fits it, then the rest by age. Empty sections are dropped.
export function groupNotifications(items, now = Date.now()) {
  const money = items.filter(item => item.kind === "money");
  const rest = items.filter(item => item.kind !== "money");
  const buckets = { today: [], week: [], earlier: [] };
  rest.forEach(item => buckets[timeBucket(item.when, now)].push(item));
  return [
    { key: "money", label: moneyHeading(money), items: money },
    { key: "today", label: "Today", items: buckets.today },
    { key: "week", label: "This week", items: buckets.week },
    { key: "earlier", label: "Earlier", items: buckets.earlier }
  ].filter(section => section.items.length > 0);
}

// Pinned rows first, then newest. A row with no timestamp (money) sorts after
// dated rows of the same group rather than jumping to the top on a blank.
export function buildNotifications({
  group, currentUser, currentUserId, reminderCards, formatAmount,
  // Fetched when the centre opens; absent on the first paint, which is fine.
  // latestCommentsLoaded says the fetch has answered, so an empty answer can
  // be believed rather than mistaken for "not asked yet".
  latestComments, latestCommentsLoaded, streamMessages
}) {
  if (!group || !currentUser) return [];
  // Name -> userId, so a row can show that member's profile photo, and back
  // again for the stream, which identifies people by id rather than by name.
  const byName = new Map();
  const byUserId = new Map();
  Object.values(group?.memberships || {}).forEach(membership => {
    if (!membership?.displayName) return;
    byName.set(membership.displayName, membership.userId || "");
    if (membership.userId) byUserId.set(String(membership.userId), membership.displayName);
  });
  const userIdFor = name => byName.get(name) || "";
  const nameForUserId = id => byUserId.get(String(id)) || "";
  const items = [
    ...moneyItems(reminderCards, currentUser, formatAmount, userIdFor),
    ...ownLogItems(group, currentUser, userIdFor, latestComments, latestCommentsLoaded),
    ...mentionItems(streamMessages, currentUserId, nameForUserId)
  ];
  return items
    .filter(item => {
      // Money has no timestamp and never expires. Anything dated does.
      if (item.kind === "money") return true;
      const age = daysAgo(item.when, Date.now());
      return age === null || age < MAX_AGE_DAYS;
    })
    .sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    // Within the money section, what you owe comes before what you are owed.
    if (a.pinned && b.pinned && a.direction !== b.direction) return a.direction === "pay" ? -1 : 1;
    return String(b.when || "").localeCompare(String(a.when || ""));
  });
}

// What the bell shows. Money you owe always counts; everything else counts
// until the centre has been opened, which is the only "seen" state that exists
// today. Money owed TO you does not keep the bell lit - there is nothing you
// can do about it, and a badge you cannot clear is just nagging.
export function unreadCount(items, lastOpenedIso) {
  const seenAt = Date.parse(lastOpenedIso || "");
  return items.filter(item => {
    if (item.alwaysUnread) return true;
    if (!Number.isFinite(seenAt)) return true;
    const t = Date.parse(item.when || "");
    return Number.isFinite(t) ? t > seenAt : false;
  }).length;
}
