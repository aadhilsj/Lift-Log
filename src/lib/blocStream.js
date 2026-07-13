// Bloc Stream — id-keyed mock data layer.
//
// This is the seam the real backend swaps into later. The contract is
// deliberately id-keyed (bloc_id, author_id = auth user id, message id) so no
// display-name-keyed dependency is introduced (see rule 6). Display names are
// resolved at render time from membership, never stored as identity here.
//
// Messages live in-memory for the session only — nothing is persisted or sent
// anywhere. `message_type` mirrors the eventual schema: 'text' | 'system' | 'event'.
// Reactions mirror bloc_message_reactions: message_id + user_id + emoji, stored
// here as { emoji: [userId, ...] } so counts and "did I react" derive cleanly.

const store = new Map(); // blocId -> message[]
const lastRead = new Map(); // blocId -> ms timestamp of last read
const DEFAULT_UNREAD_LOOKBACK_MS = 30 * 60 * 1000;
let seq = 0;
const newId = () => `m_${Date.now().toString(36)}_${seq++}`;

export function listMessages(blocId) {
  return store.get(blocId) || [];
}

// Unread = messages from other members (and system/event moments) newer than
// this member's last-read marker. Own messages never count. Seeds on demand so
// the header badge works before the stream has ever been opened. Mirrors an
// eventual `unread since last_read_at` query; the real value comes from the
// backend once per-member read state exists.
export function getUnreadCount(blocId, { currentUserId, members = [] } = {}) {
  if (!blocId) return 0;
  seedIfEmpty(blocId, { currentUserId, members });
  const since = lastRead.get(blocId) || (Date.now() - DEFAULT_UNREAD_LOOKBACK_MS);
  return (store.get(blocId) || []).filter(
    m => m.author_id !== currentUserId && new Date(m.created_at).getTime() > since
  ).length;
}

// Mark a Bloc's stream read up to now (clears its unread badge).
export function markStreamRead(blocId) {
  if (blocId) lastRead.set(blocId, Date.now());
}

// Seed example messages the first time a Bloc's stream is opened, covering the
// text and system-moment types so the UI has something to render pre-backend.
export function seedIfEmpty(blocId, { currentUserId, members = [] } = {}) {
  if (!blocId || store.has(blocId)) return;
  const others = members.filter(m => m.id && m.id !== currentUserId);
  const other = others[0];
  const other2 = others[1] || others[0];
  const me = members.find(m => m.id === currentUserId);
  const h = ms => new Date(Date.now() - ms).toISOString();

  const sys = (mins, tone, label, body, sub, reactions, opts = {}) => ({
    id: newId(), bloc_id: blocId, author_id: null, message_type: "system",
    tone, label, body, sub: sub || "", reactions: reactions || {}, payload: opts.payload || {}, system_kind: opts.systemKind || "", created_at: h(mins * 60e3)
  });
  const txt = (mins, authorId, body, opts = {}) => ({
    id: newId(), bloc_id: blocId, author_id: authorId, message_type: "text", body,
    reply_to: opts.replyTo || null, mentions: opts.mentions || [], reactions: opts.reactions || {}, created_at: h(mins * 60e3)
  });
  const evt = (mins, authorId, payload) => ({
    id: newId(), bloc_id: blocId, author_id: authorId, message_type: "event", payload, created_at: h(mins * 60e3)
  });

  // Captured so later messages can reply to them (reply_to is id-keyed).
  const runMsg = other && txt(60 * 6, other.id, "anyone running this weekend?");
  const eventMsg = other && evt(80, other.id, { activity: "Saturday long run", when: "Sat 12 Jul · 8:00 AM", location: "Marina Beach", rsvp: other2 ? { [other.id]: "in", [other2.id]: "maybe", ...(others[2] ? { [others[2].id]: "pass" } : {}) } : { [other.id]: "in" } });

  const msgs = [
    sys(60 * 34, "positive", "MONTH CLOSED", "June ended — summary ready.", "3 to pay", { "👏": other ? [other.id] : [] }, { systemKind: "season_closed", payload: { action: "season_results" } }),
    sys(60 * 33, "positive", "AWARDS · JUNE", "", "", {}, { systemKind: "awards", payload: { awards: [
      { title: "Bloc Champ", name: other?.name || "Member" },
      { title: "Most consistent", name: other2?.name || other?.name || "Member" },
      { title: "Biggest turnaround", name: me?.name || "Member" },
      { title: "Furthest behind", name: others[2]?.name || other2?.name || "Member" }
    ] } }),
    sys(60 * 31, "positive", "NEW MONTH", "July is here. Raise your ante.", "", {}),
    sys(60 * 30, "neutral", "NEW MEMBER", "Deyhan joined the Bloc.", "", {}),
    runMsg,
    sys(60 * 5, "positive", "TARGET HIT", "Aadhil hit target — 21 days early.", "First to target this month.", { "🔥": [currentUserId] }),
    txt(60 * 3, currentUserId, "just logged mine 💪", { reactions: other ? { "❤️": [other.id] } : {} }),
    other2 && sys(150, "warning", "COOKED", `${other2.name} can't reach target this month.`, "Fine locked at month end.", { "😤": other ? [other.id] : [] }),
    other && runMsg && txt(90, other.id, "2 behind pace, gonna catch up tmrw", { replyTo: runMsg.id }),
    eventMsg,
    other && sys(70, "positive", "COMEBACK", `${other.name}: Behind → On Track.`, "", {}),
    sys(58, "warning", "FINAL STRETCH", "3 days left. 2 members still short.", "", {}),
    sys(52, "positive", "PERFECT BLOC MONTH · June", "Everyone hit target.", "", {}, { systemKind: "perfect_month" }),
    sys(46, "neutral", "SETTINGS", "Target changed to 12 workouts.", "", {}),
    sys(40, "warning", "INACTIVITY", "Rahul — no workout in 7 days.", "", {}),
    sys(36, "neutral", "SIT OUT", "Mikhail sitting out this month.", "", {}),
    (me && other2 && eventMsg)
      ? txt(20, other2.id, `@${me.name} you in for this? 🔥`, { mentions: [currentUserId], replyTo: eventMsg.id })
      : (other && txt(20, other.id, "let's go 🔥")),
    // Consecutive own run — two in the same minute (time collapses to the last),
    // then one a minute later (time shows again). No name on own messages.
    txt(11, currentUserId, "yeah I'm keen"),
    txt(11, currentUserId, "what time are we thinking?"),
    txt(5, currentUserId, "actually let's make it 7"),
    // Consecutive received run — name on the first, avatar on the last only.
    other && txt(3, other.id, "7 works for me"),
    other && txt(3, other.id, "see you there 🙌")
  ].filter(Boolean);

  store.set(blocId, msgs);
}

export function sendMessage(blocId, { authorId, body, replyTo = null, mentions = [] }) {
  const text = String(body || "").trim();
  if (!blocId || !text) return null;
  const msg = {
    id: newId(), bloc_id: blocId, author_id: authorId, message_type: "text", body: text,
    reply_to: replyTo || null, mentions: mentions || [], reactions: {}, created_at: new Date().toISOString()
  };
  store.set(blocId, [...(store.get(blocId) || []), msg]);
  return msg;
}

// Create an event message (message_type='event'). The three form fields plus an
// id-keyed RSVP map live in `payload`, mirroring the eventual jsonb column.
// rsvp is { userId: 'in' | 'pass' } — display names resolve at render time.
export function createEvent(blocId, { authorId, activity, when, location }) {
  const a = String(activity || "").trim();
  if (!blocId || !a) return null;
  const msg = {
    id: newId(), bloc_id: blocId, author_id: authorId, message_type: "event",
    payload: { activity: a, when: String(when || "").trim(), location: String(location || "").trim(), rsvp: {} },
    created_at: new Date().toISOString()
  };
  store.set(blocId, [...(store.get(blocId) || []), msg]);
  return msg;
}

// Set (or clear) the current user's RSVP on an event. Tapping the status the
// user already holds clears it; otherwise it sets 'in' or 'pass'.
export function setRsvp(blocId, messageId, userId, status) {
  const msgs = store.get(blocId);
  if (!msgs) return;
  const next = msgs.map(m => {
    if (m.id !== messageId || m.message_type !== "event") return m;
    const rsvp = { ...((m.payload && m.payload.rsvp) || {}) };
    if (rsvp[userId] === status) delete rsvp[userId]; else rsvp[userId] = status;
    return { ...m, payload: { ...m.payload, rsvp } };
  });
  store.set(blocId, next);
}

// Toggle a reaction for the current user (id-keyed). Mirrors an insert/delete
// in bloc_message_reactions.
export function toggleReaction(blocId, messageId, emoji, userId) {
  const msgs = store.get(blocId);
  if (!msgs) return;
  const next = msgs.map(m => {
    if (m.id !== messageId) return m;
    const reactions = { ...(m.reactions || {}) };
    const users = new Set(reactions[emoji] || []);
    if (users.has(userId)) users.delete(userId); else users.add(userId);
    if (users.size) reactions[emoji] = [...users]; else delete reactions[emoji];
    return { ...m, reactions };
  });
  store.set(blocId, next);
}
