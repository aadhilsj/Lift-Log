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
let seq = 0;
const newId = () => `m_${Date.now().toString(36)}_${seq++}`;

export function listMessages(blocId) {
  return store.get(blocId) || [];
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

  const sys = (mins, tone, label, body, sub, reactions) => ({
    id: newId(), bloc_id: blocId, author_id: null, message_type: "system",
    tone, label, body, sub: sub || "", reactions: reactions || {}, created_at: h(mins * 60e3)
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
  const eventMsg = other && evt(80, other.id, { activity: "Saturday long run", when: "Sat 12 Jul · 8:00 AM", location: "Marina Beach", rsvp: other2 ? { [other.id]: "in", [other2.id]: "pass" } : { [other.id]: "in" } });

  const msgs = [
    sys(60 * 34, "positive", "Season Closed · 1 Jul", "June settled — summary ready.", "3 payments outstanding.", { "👏": other ? [other.id] : [] }),
    sys(60 * 30, "positive", "New Member · 5 Jul", "Deyhan joined the Bloc.", "", {}),
    runMsg,
    sys(60 * 5, "positive", "Target Hit · 6 Jul", "Aadhil hit target — 21 days early.", "First to MAS this month.", { "🔥": [currentUserId] }),
    txt(60 * 3, currentUserId, "just logged mine 💪", { reactions: other ? { "❤️": [other.id] } : {} }),
    other2 && sys(150, "warning", "Cooked · 8 Jul", `${other2.name} can't reach target this month.`, "Fine locked at season close.", { "😤": other ? [other.id] : [] }),
    other && runMsg && txt(90, other.id, "2 behind pace, gonna catch up tmrw", { replyTo: runMsg.id }),
    eventMsg,
    other && sys(70, "positive", "Comeback · 9 Jul", `${other.name}: At Risk → On Track.`, "", {}),
    sys(40, "warning", "Inactivity · 9 Jul", "Rahul — no workout in 7 days.", "", {}),
    (me && other2 && eventMsg)
      ? txt(20, other2.id, `@${me.name} you in for this? 🔥`, { mentions: [currentUserId], replyTo: eventMsg.id })
      : (other && txt(20, other.id, "let's go 🔥"))
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
