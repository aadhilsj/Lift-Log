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

// Relative time, in the app's plain voice.
export function shortWhen(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((now - t) / MS_DAY);
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
function ownLogItems(group, currentUser) {
  const mine = group?.logs?.[currentUser] || [];
  const items = [];
  mine.forEach(log => {
    const when = logWhen(log);
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
      // One emoji, never a row of them. Reactions carry no timestamp, so the
      // newest cannot be known — this takes the one most people chose.
      const tally = new Map();
      reactors.forEach(r => tally.set(r.emoji, (tally.get(r.emoji) || 0) + 1));
      const topEmoji = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
      items.push({
        id: `reaction:${log.id}`,
        kind: "reaction",
        glyph: topEmoji,
        title: `${nameList(unique)} reacted to ${describeWorkout(log)}`,
        meta: shortWhen(when),
        when,
        opens: "activity",
        logId: log.id
      });
    }
    const comments = Number(log?.commentCount || 0);
    if (comments > 0) {
      items.push({
        id: `comment:${log.id}`,
        kind: "comment",
        glyph: "",
        // The client holds the count, not the authors. Saying "a comment" is
        // honest; inventing a name would not be.
        title: comments === 1 ? `A comment on ${describeWorkout(log)}` : `${comments} comments on ${describeWorkout(log)}`,
        meta: shortWhen(when),
        when,
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
function moneyItems(reminderCards, currentUser, formatAmount) {
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
    return {
      id: `money:${card.key}`,
      kind: "money",
      glyph: youPay ? "→" : "←",
      title: youPay
        ? `You still owe ${card.receiverDisplayName} ${amount}`
        : `${card.payerDisplayName} still owes you ${amount}`,
      meta: card.monthLabel || "",
      when: "",
      // Owing is the one thing here you are expected to act on, so it sits with
      // the pinned rows rather than drifting down the list as it ages.
      pinned: youPay,
      opens: "settlement",
      monthKey: card.monthKey
    };
  }).filter(Boolean);
}

// Pinned rows first, then newest. A row with no timestamp (money) sorts after
// dated rows of the same group rather than jumping to the top on a blank.
export function buildNotifications({ group, currentUser, reminderCards, formatAmount }) {
  if (!group || !currentUser) return [];
  const items = [
    ...moneyItems(reminderCards, currentUser, formatAmount),
    ...ownLogItems(group, currentUser)
  ];
  return items.sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return String(b.when || "").localeCompare(String(a.when || ""));
  });
}

// What the bell shows. Pinned rows always count; everything else counts until
// the centre has been opened, which is the only "seen" state that exists today.
export function unreadCount(items, lastOpenedIso) {
  const seenAt = Date.parse(lastOpenedIso || "");
  return items.filter(item => {
    if (item.pinned) return true;
    if (!Number.isFinite(seenAt)) return true;
    const t = Date.parse(item.when || "");
    return Number.isFinite(t) ? t > seenAt : false;
  }).length;
}
