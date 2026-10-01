// Settlement notes — PREVIEW STUB.
//
// "What's it going toward?": whoever is owed money writes one short line, and
// everyone who can see the settlement sees it.
//
// This file stores those notes in localStorage ONLY, so the note can be looked
// at and sized on a real phone before any decision is made about building it
// properly. Nothing here reaches the API, the blob or canonical, so a note is
// per-browser and never shared between people. If the feature is approved, this
// module is replaced by a real write through api/lift-log.js — nothing else
// that imports it has to change.

const STORAGE_KEY = "fero_settlement_note_preview_v1";
// One short line. Long enough for a real thing, short enough that the reminder
// card never grows past one extra line.
export const SETTLEMENT_NOTE_MAX = 60;

// One note per person owed, per month — not one per person paying. Marcus is
// owed by three people and writes once; all three see the same line.
export const settlementNoteKey = (groupId, monthKey, receiverDisplayName) =>
  `${String(groupId || "")}:${String(monthKey || "")}:${String(receiverDisplayName || "")}`;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // Private windows and blocked site data both throw here. An unreadable
    // store means "no notes", never an error.
    return {};
  }
}

export function getSettlementNote(groupId, monthKey, receiverDisplayName) {
  return readAll()[settlementNoteKey(groupId, monthKey, receiverDisplayName)] || "";
}

export function setSettlementNote(groupId, monthKey, receiverDisplayName, text) {
  const key = settlementNoteKey(groupId, monthKey, receiverDisplayName);
  const trimmed = String(text || "").trim().slice(0, SETTLEMENT_NOTE_MAX);
  const all = readAll();
  if (trimmed) all[key] = trimmed;
  else delete all[key];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Nothing to do: the note simply does not persist in this browser.
  }
  return trimmed;
}
