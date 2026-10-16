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
// NOT covered yet, because the client does not hold the data:
//   - who commented (logs carry commentCount, not the comments themselves)
//   - @mentions in the Bloc Stream or in a comment thread
// Both need the stream/comments API and are the real work in finishing this.
//
// Also not here, deliberately: the "say what the money's going toward" prompt
// from docs/concept-2026-09-24-notification-centre.md. It is written, on
// origin/feat/settlement-note, but the note it collects is stored in
// localStorage only — it never reaches the API, the blob or canonical, so
// nobody else in the Bloc would ever see it. It needs a real save before the
// prompt can be shown to anyone.

const MS_DAY = 86400000;

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

// "your Gym Log", "your Volleyball Log". The activity name and "Log" both keep
// their capital: it reads as the name of the thing, not a description of it.
function describeWorkout(log) {
  const raw = String(log?.type || "").trim();
  const type = raw ? raw[0].toUpperCase() + raw.slice(1) : "";
  return type ? `your ${type} Log` : "your Log";
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
function ownLogItems(group, currentUser, userIdFor) {
  const mine = group?.logs?.[currentUser] || [];
  const items = [];
  mine.forEach(log => {
    const when = logWhen(log);
    // The square on the right: the workout's own photo while it still exists,
    // and the activity icon once it does not. Photos are deleted after 72
    // hours (shouldKeepLogPhoto in appState.js), and past months are stripped
    // of them entirely, so most rows will show the icon.
    const thumbPhotoUrl = typeof log?.photoUrl === "string" ? log.photoUrl : "";
    const thumbType = String(log?.activity || log?.type || "").trim();

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
      // One emoji, never a row of them.
      //
      // This is the emoji the most people chose, NOT the most recent one.
      // ante_core.workout_reactions does carry created_at, but the shape the
      // client receives is {emoji: [names]} with no timestamps, and jsonb
      // sorts its keys, so recency does not survive the trip. Showing the
      // newest needs that RPC to return a per-emoji latest created_at.
      const tally = new Map();
      reactors.forEach(r => tally.set(r.emoji, (tally.get(r.emoji) || 0) + 1));
      const topEmoji = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      items.push({
        id: `reaction:${log.id}`,
        kind: "reaction",
        badge: topEmoji,
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
    const comments = Number(log?.commentCount || 0);
    if (comments > 0) {
      items.push({
        id: `comment:${log.id}`,
        kind: "comment",
        // The client holds the count, not the authors, so there is nobody to
        // put in the avatar — the row leads with the workout instead.
        badge: "",
        people: [],
        title: comments === 1 ? `A comment on ${describeWorkout(log)}` : `${comments} comments on ${describeWorkout(log)}`,
        meta: shortWhen(when),
        when,
        thumbPhotoUrl,
        thumbType,
        opens: "comments",
        logId: log.id
      });
    }
  });
  return items;
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
export function buildNotifications({ group, currentUser, reminderCards, formatAmount }) {
  if (!group || !currentUser) return [];
  // Name -> userId, so a row can show that member's profile photo.
  const byName = new Map(
    Object.values(group?.memberships || {})
      .filter(membership => membership?.displayName)
      .map(membership => [membership.displayName, membership.userId || ""])
  );
  const userIdFor = name => byName.get(name) || "";
  const items = [
    ...moneyItems(reminderCards, currentUser, formatAmount, userIdFor),
    ...ownLogItems(group, currentUser, userIdFor)
  ];
  return items.sort((a, b) => {
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
