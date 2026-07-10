// Bloc Stream — id-keyed mock data layer.
//
// This is the seam the real backend swaps into later. The contract is
// deliberately id-keyed (bloc_id, author_id = auth user id, message id) so no
// display-name-keyed dependency is introduced (see rule 6). Display names are
// resolved at render time from membership, never stored as identity here.
//
// Messages live in-memory for the session only — nothing is persisted or sent
// anywhere. `message_type` mirrors the eventual schema: 'text' | 'system' | 'event'.

const store = new Map(); // blocId -> message[]
let seq = 0;
const newId = () => `m_${Date.now().toString(36)}_${seq++}`;

export function listMessages(blocId) {
  return store.get(blocId) || [];
}

// Seed a few example text messages the first time a Bloc's stream is opened,
// so the UI has something to render before the input/backend exist.
export function seedIfEmpty(blocId, { currentUserId, members = [] } = {}) {
  if (!blocId || store.has(blocId)) return;
  const others = members.filter(m => m.id && m.id !== currentUserId);
  const other = others[0];
  const other2 = others[1] || others[0];
  const h = ms => new Date(Date.now() - ms).toISOString();
  const msgs = [];
  if (other) msgs.push({ id: newId(), bloc_id: blocId, author_id: other.id, message_type: "text", body: "anyone running this weekend?", created_at: h(5 * 3600e3) });
  msgs.push({ id: newId(), bloc_id: blocId, author_id: currentUserId, message_type: "text", body: "just logged mine 💪", created_at: h(3 * 3600e3) });
  if (other2) msgs.push({ id: newId(), bloc_id: blocId, author_id: other2.id, message_type: "text", body: "2 behind pace, gonna catch up tmrw", created_at: h(90 * 60e3) });
  if (other) msgs.push({ id: newId(), bloc_id: blocId, author_id: other.id, message_type: "text", body: "let's go 🔥", created_at: h(20 * 60e3) });
  store.set(blocId, msgs);
}

export function sendMessage(blocId, { authorId, body }) {
  const text = String(body || "").trim();
  if (!blocId || !text) return null;
  const msg = { id: newId(), bloc_id: blocId, author_id: authorId, message_type: "text", body: text, created_at: new Date().toISOString() };
  store.set(blocId, [...(store.get(blocId) || []), msg]);
  return msg;
}
