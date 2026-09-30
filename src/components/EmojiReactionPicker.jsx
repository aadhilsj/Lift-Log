import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { QUICK_REACTIONS } from "../lib/appState.js";

const RECENT_EMOJI_KEY = "fero_recent_reaction_emoji_v1";
const CATEGORIES = [
  { id: 0, icon: "😀", name: "Smileys & emotion" },
  { id: 1, icon: "👋", name: "People & body" },
  { id: 3, icon: "🦍", name: "Animals & nature" },
  { id: 4, icon: "🍎", name: "Food & drink" },
  { id: 5, icon: "🚗", name: "Travel & places" },
  { id: 6, icon: "⚽", name: "Activities" },
  { id: 7, icon: "💡", name: "Objects" },
  { id: 8, icon: "💯", name: "Symbols" },
  { id: 9, icon: "🏳️", name: "Flags" }
];

function readRecentEmoji() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_EMOJI_KEY) || "[]");
    return Array.isArray(value) ? value.filter(item => typeof item === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}

function recordRecentEmoji(emoji) {
  try {
    localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify([emoji, ...readRecentEmoji().filter(item => item !== emoji)].slice(0, 24)));
  } catch {
    // Reactions still work when device storage is unavailable.
  }
}

function QuickReactionChoices({ onPick, onMore, size = 25, fontSize = 16 }) {
  const buttonStyle = {
    width: size, height: size, flex: "0 0 auto", padding: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 999, background: "var(--s2, #111d1b)",
    border: "1px solid var(--border, #1b332e)", color: "var(--text, #fff)",
    fontSize, lineHeight: 1, cursor: "pointer", touchAction: "manipulation"
  };
  return <>
    {QUICK_REACTIONS.map(emoji => <button key={emoji} type="button" aria-label={`React with ${emoji}`}
      onMouseDown={event => event.preventDefault()}
      onClick={() => { recordRecentEmoji(emoji); onPick(emoji); }} style={buttonStyle}>{emoji}</button>)}
    <button type="button" aria-label="More emoji" title="More emoji"
      onMouseDown={event => event.preventDefault()}
      onClick={onMore} style={{ ...buttonStyle, fontSize: 20, fontWeight: 700, color: "#4ECDC4" }}>⋯</button>
  </>;
}

function EmojiSheet({ onPick, onClose }) {
  const [dataset, setDataset] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState(0);
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState(0);
  const [recent, setRecent] = useState(readRecentEmoji);

  useEffect(() => {
    let active = true;
    import("emojibase-data/en/data.json")
      .then(module => { if (active) setDataset(module.default); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = event => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const entries = useMemo(() => (dataset || []).filter(item => item.group != null && item.group !== 2), [dataset]);
  const searchableEntries = useMemo(() => entries.flatMap(item => [
    item,
    ...(item.skins || []).map(skin => ({ ...skin, tags: item.tags || [] }))
  ]), [entries]);
  const names = useMemo(() => {
    const lookup = new Map();
    entries.forEach(item => {
      lookup.set(item.emoji, item.label);
      item.skins?.forEach(skin => lookup.set(skin.emoji, skin.label));
    });
    return lookup;
  }, [entries]);
  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (term) return searchableEntries.filter(item => `${item.label} ${(item.tags || []).join(" ")}`.toLocaleLowerCase().includes(term));
    if (category === "recent") return recent.map(emoji => ({ emoji, label: names.get(emoji) || emoji }));
    return entries.filter(item => item.group === category);
  }, [entries, searchableEntries, category, names, query, recent]);
  const choose = emoji => {
    recordRecentEmoji(emoji);
    setRecent(readRecentEmoji());
    onPick(emoji);
    onClose();
  };
  const grid = (items, useTone = true) => <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 3 }}>
    {items.map(item => {
      const selected = useTone && tone ? item.skins?.find(skin => skin.tone === tone) || item : item;
      return <button key={selected.emoji} type="button" aria-label={selected.label} title={selected.label}
        onClick={() => choose(selected.emoji)}
        style={{ height: 40, minWidth: 0, padding: 0, border: "none", borderRadius: 9, background: "transparent", fontSize: 25, lineHeight: 1, cursor: "pointer" }}>{selected.emoji}</button>;
    })}
  </div>;

  return createPortal(<div data-emoji-sheet-viewport="true" role="presentation"
    style={{ position: "fixed", inset: 0, zIndex: 20000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.65)" }}>
    <button type="button" aria-label="Close emoji sheet" onClick={onClose}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "transparent" }} />
    <section role="dialog" aria-modal="true" aria-label="Choose a reaction emoji"
      style={{ position: "relative", width: "100%", maxWidth: 600, maxHeight: "min(75dvh, 680px)", display: "flex", flexDirection: "column", boxSizing: "border-box", padding: "14px 12px calc(12px + env(safe-area-inset-bottom, 0px))", borderRadius: "20px 20px 0 0", background: "#081110", border: "1px solid #1b332e", boxShadow: "0 -16px 40px rgba(0,0,0,.45)", color: "#f5fbf9", fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <strong style={{ fontSize: 15 }}>React with emoji</strong>
        <button type="button" aria-label="Close emoji sheet" onClick={onClose}
          style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid #1b332e", background: "#10201c", color: "#d0e5df", fontSize: 19 }}>×</button>
      </div>
      <input type="search" aria-label="Search emoji" placeholder="Search emoji" value={query} onChange={event => setQuery(event.target.value)}
        style={{ width: "100%", height: 38, boxSizing: "border-box", padding: "0 12px", borderRadius: 11, border: "1px solid #27423b", outlineColor: "#4ECDC4", background: "#0c1b18", color: "#fff", fontSize: 14, marginBottom: 10 }} />
      <div role="tablist" aria-label="Emoji categories" style={{ display: "flex", gap: 4, overflowX: "auto", flexShrink: 0, paddingBottom: 7, marginBottom: 5 }}>
        {[{ id: "recent", icon: "🕘", name: "Recent" }, ...CATEGORIES].map(item => <button key={item.id} type="button" role="tab" aria-selected={category === item.id && !query}
          aria-label={item.name} title={item.name} onClick={() => { setQuery(""); setCategory(item.id); }}
          style={{ width: 38, height: 34, flex: "0 0 auto", padding: 0, borderRadius: 8, border: "none", borderBottom: category === item.id && !query ? "2px solid #4ECDC4" : "2px solid transparent", background: category === item.id && !query ? "#17332d" : "transparent", fontSize: 20 }}>{item.icon}</button>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, color: "#8aaba3", fontSize: 11, marginBottom: 7 }}>
        <span>{query ? `Results for “${query}”` : category === "recent" ? "Recent" : CATEGORIES.find(item => item.id === category)?.name}</span>
        <div aria-label="Skin tone" style={{ display: "flex", gap: 5 }}>
          {["✋", "🏻", "🏼", "🏽", "🏾", "🏿"].map((symbol, index) => <button key={index} type="button" aria-label={index ? `Skin tone ${index}` : "Default skin tone"} aria-pressed={tone === index}
            onClick={() => setTone(index)} style={{ width: 21, height: 21, padding: 0, borderRadius: 999, border: tone === index ? "1px solid #4ECDC4" : "1px solid transparent", background: index ? [null, "#ffdfbd", "#ecc195", "#bb8664", "#875b41", "#563d31"][index] : "transparent", fontSize: 15 }}>{index ? "" : symbol}</button>)}
        </div>
      </div>
      <div data-emoji-grid="true" style={{ flex: 1, minHeight: 160, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!dataset && !loadError && <p style={{ textAlign: "center", color: "#8aaba3" }}>Loading emoji…</p>}
        {loadError && <p style={{ textAlign: "center", color: "#eaa" }}>Emoji could not load. Try again.</p>}
        {dataset && !query && category !== "recent" && recent.length > 0 && <>
          <div style={{ fontSize: 11, color: "#8aaba3", margin: "2px 0 5px" }}>Recent</div>
          {grid(recent.map(emoji => ({ emoji, label: names.get(emoji) || emoji })), false)}
          <div style={{ height: 1, background: "#1b332e", margin: "9px 0" }} />
        </>}
        {dataset && query && visible.length > 400 && <p style={{ color: "#8aaba3", fontSize: 11, textAlign: "center" }}>Showing 400 of {visible.length} matches. Keep typing to narrow your search.</p>}
        {dataset && (visible.length ? grid(query ? visible.slice(0, 400) : visible, !query && category !== "recent") : <p style={{ textAlign: "center", color: "#8aaba3" }}>No emoji found</p>)}
      </div>
    </section>
  </div>, document.body);
}

export { EmojiSheet, QuickReactionChoices };
