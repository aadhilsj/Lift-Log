import React from "react";
import { createPortal } from "react-dom";
const { useState, useEffect, useRef, useLayoutEffect } = React;
import { QuickReactionChoices } from "./EmojiReactionPicker.jsx";
import { tapMedium } from "../lib/haptics.js";

// The hold menu: press and hold a message or a workout, and it lifts off a
// blurred page with a reaction row above it and its actions below.
//
// This is the iOS context-menu pattern (the one Instagram and Messages use),
// not an invention. Three rules come from it and are the whole feel:
//
//  1. The thing you pressed stays sharp and lifts; everything else blurs.
//  2. The menu is anchored to it - it grows out of what you pressed rather
//     than appearing from nowhere - and only slides to stay on screen.
//  3. Lift, blur and menu run off ONE transition. Separate timelines are
//     exactly what makes a homemade copy feel wrong.
//
// Portalled to document.body on purpose: the Stream and the profile both sit
// inside transformed parents, and a fixed overlay inside a transform is
// positioned against that parent instead of the viewport. See
// docs/recurring-debugging-playbook.md.

const EASE = "cubic-bezier(.22,1,.36,1)"; // one curve, shared by every piece
const DURATION = 260;
const GAP = 10;          // between the preview and each menu
const EDGE = 12;         // smallest gap to a screen edge
const LIFT = 1.03;       // how much the pressed thing grows

const ActionList = ({ actions, onClose }) =>
  React.createElement('div', {
    style: {
      minWidth: 212, overflow: "hidden", borderRadius: 14,
      background: "rgba(32,34,38,.92)",
      border: "1px solid rgba(255,255,255,.08)",
      boxShadow: "0 18px 44px rgba(0,0,0,.55)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)"
    }
  },
    actions.map((action, i) => React.createElement('button', {
      key: action.label,
      type: "button",
      onClick: e => { e.stopPropagation(); onClose(); action.onPick(); },
      style: {
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, padding: "13px 15px", background: "transparent", border: 0,
        borderTop: i === 0 ? 0 : "1px solid rgba(255,255,255,.07)",
        fontFamily: "'Outfit', sans-serif", fontSize: 15, fontWeight: 550,
        color: action.tone === "danger" ? "#FF6B6B" : "#F2F5F4",
        textAlign: "left", cursor: "pointer"
      }
    }, action.label))
  );

const HoldMenu = ({ anchorRect, preview, actions = [], onPick, onMore, onClose }) => {
  const [shown, setShown] = useState(false);
  const previewRef = useRef(null);
  const [layout, setLayout] = useState(null);

  // One frame to measure, then one state flip drives every transition at once.
  useLayoutEffect(() => {
    if (!anchorRect) return;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const previewH = anchorRect.height;
    const reactionH = onPick ? 58 + GAP : 0;
    const actionsH = actions.length ? actions.length * 46 + GAP + 8 : 0;
    const total = reactionH + previewH + actionsH;

    // Anchored first, then slid the smallest distance that keeps the whole
    // group on screen - which is what makes it read as "the message lifted"
    // rather than "a dialog appeared".
    let top = anchorRect.top;
    const topLimit = EDGE + reactionH;
    const bottomLimit = vh - EDGE - actionsH;
    if (top + previewH > bottomLimit) top = bottomLimit - previewH;
    if (top < topLimit) top = topLimit;
    if (total + EDGE * 2 > vh) top = Math.max(topLimit, (vh - total) / 2 + reactionH);

    setLayout({ top, left: anchorRect.left, width: anchorRect.width, height: previewH, vw });
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [anchorRect, actions.length, onPick]);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!anchorRect || !layout) return null;

  const shift = shown ? layout.top - anchorRect.top : 0;
  // Grow about the centre so a left-aligned bubble does not drift right.
  const originX = anchorRect.left + anchorRect.width / 2 < layout.vw / 2 ? "left" : "right";

  return createPortal(
    React.createElement('div', {
      onClick: onClose,
      onTouchStart: e => e.stopPropagation(),
      style: {
        position: "fixed", inset: 0, zIndex: 1400,
        // The blur and the dim are part of the same transition as the lift.
        backdropFilter: `blur(${shown ? 18 : 0}px)`,
        WebkitBackdropFilter: `blur(${shown ? 18 : 0}px)`,
        background: `rgba(4,8,8,${shown ? .44 : 0})`,
        transition: `backdrop-filter ${DURATION}ms ${EASE}, -webkit-backdrop-filter ${DURATION}ms ${EASE}, background ${DURATION}ms ${EASE}`,
        overscrollBehavior: "contain"
      }
    },
      // Reaction row, above the lifted thing. Only where holding is the way to
      // react: the Activity feed already has a + on every card, so repeating
      // the emoji there was just noise.
      onPick && React.createElement('div', {
        onClick: e => e.stopPropagation(),
        style: {
          position: "fixed", top: layout.top - GAP, left: Math.max(EDGE, Math.min(layout.left, layout.vw - EDGE - 300)),
          transform: `translateY(-100%) scale(${shown ? 1 : .86})`,
          transformOrigin: `${originX} bottom`,
          opacity: shown ? 1 : 0,
          transition: `transform ${DURATION}ms ${EASE}, opacity ${DURATION}ms ${EASE}`,
          display: "flex", gap: 2, alignItems: "center",
          background: "rgba(32,34,38,.92)", border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 999, padding: "6px 10px",
          boxShadow: "0 18px 44px rgba(0,0,0,.55)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)"
        }
      },
        // Bigger than the old inline bar: the reactions are the main action here.
        React.createElement(QuickReactionChoices, { onPick, onMore, size: 42, fontSize: 30 })
      ),

      // The thing you pressed, sharp and lifted
      React.createElement('div', {
        ref: previewRef,
        onClick: e => e.stopPropagation(),
        style: {
          position: "fixed", top: anchorRect.top, left: anchorRect.left,
          width: anchorRect.width,
          transform: `translateY(${shift}px) scale(${shown ? LIFT : 1})`,
          transformOrigin: `${originX} center`,
          transition: `transform ${DURATION}ms ${EASE}`,
          pointerEvents: "none"
        }
      }, preview),

      // Actions, below
      actions.length > 0 && React.createElement('div', {
        onClick: e => e.stopPropagation(),
        style: {
          position: "fixed", top: layout.top + layout.height + GAP,
          left: Math.max(EDGE, Math.min(layout.left, layout.vw - EDGE - 212)),
          transform: `scale(${shown ? 1 : 0.9})`,
          transformOrigin: `${originX} top`,
          opacity: shown ? 1 : 0,
          transition: `transform ${DURATION}ms ${EASE}, opacity ${DURATION}ms ${EASE}`
        }
      }, React.createElement(ActionList, { actions, onClose }))
    ),
    document.body
  );
};

// Wraps anything that should answer a press-and-hold with the menu. Used by
// the Activity feed, whose card is one big element rather than a bubble with
// its own gesture handling.
const HoldTarget = ({ actions = [], onPick, onMore, disabled = false, children }) => {
  const ref = useRef(null);
  const timer = useRef(null);
  const moved = useRef(false);
  const [anchorRect, setAnchorRect] = useState(null);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const open = () => {
    const node = ref.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  };

  // Some controls inside a hold target run their own press gesture and must
  // keep it to themselves. The reaction chips are the case this was written
  // for: holding one shows who reacted at 420ms, and the hold menu then
  // opened on top of it at 500ms, so a press meant to read names also
  // selected the whole post for Report or Block.
  //
  // Marked with data-hold-exempt on the control, so this stays a property of
  // the control rather than a list of exceptions kept here.
  const startedOnExemptControl = event => {
    try { return !!event?.target?.closest?.("[data-hold-exempt]"); } catch { return false; }
  };

  // 500ms matches the Stream and the iOS guidance: long enough to be deliberate,
  // short enough not to feel stuck. Moving first means a scroll, not a hold.
  const start = event => {
    // Nothing to show on your own post once reactions are not part of it.
    if (disabled || (!actions.length && !onPick)) return;
    if (startedOnExemptControl(event)) return;
    moved.current = false;
    clear();
    timer.current = setTimeout(() => { if (!moved.current) { open(); void tapMedium(); try { navigator.vibrate && navigator.vibrate(10); } catch (_) {} } }, 500);
  };

  useEffect(() => clear, []);

  return React.createElement(React.Fragment, null,
    React.createElement('div', {
      ref,
      onTouchStart: start,
      onTouchMove: () => { moved.current = true; clear(); },
      onTouchEnd: clear,
      onTouchCancel: clear,
      onContextMenu: e => { if (disabled || (!actions.length && !onPick)) return; if (startedOnExemptControl(e)) return; e.preventDefault(); open(); },
      style: { WebkitTouchCallout: "none" }
    }, children),
    anchorRect && React.createElement(HoldMenu, {
      anchorRect,
      preview: children,
      actions,
      onClose: () => setAnchorRect(null),
      // Passed through only when the caller actually offers reactions, so the
      // menu can tell "no reaction row wanted" from "row with a dead handler".
      onPick: onPick ? (emoji => { setAnchorRect(null); onPick(emoji); }) : undefined,
      onMore: onMore ? (() => { setAnchorRect(null); onMore(); }) : undefined
    })
  );
};

export { HoldMenu, HoldTarget };
