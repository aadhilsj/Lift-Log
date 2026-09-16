// Single source of truth for workout-type icon artwork.
//
// Consumed by two very different renderers — CategoryIcon (SVG, in-app) and
// shareSticker.js (Canvas 2D, the share sticker) — so the shapes are stored as
// neutral data rather than as markup for either one.
//
// Adding a new workout type means adding one entry here. Do not copy these paths
// into a component; the two copies that used to exist had already drifted apart.
//
// `vb`     viewBox as [minX, minY, width, height]
// `kind`   "stroke" — the drawing IS a stroke, and has no fill
//          "fill"   — closed shapes, filled
// `w`      stroke width, in viewBox units (stroke icons only)
// `extent` nominal viewBox size, used to scale the hairline edge and the silver
//          gradient so they read identically across wildly different viewBoxes

const WORKOUT_ICONS = {
  Gym: {
    vb: [0, 0, 24, 24], kind: "stroke", w: 2.1, extent: 24,
    shapes: [
      { d: "M2.5 9.5v5" }, { d: "M5.5 8.2v7.6" }, { d: "M8.2 10.1v3.8" },
      { d: "M15.8 10.1v3.8" }, { d: "M18.5 8.2v7.6" }, { d: "M21.5 9.5v5" },
      { d: "M8.2 12h7.6" }
    ]
  },
  Run: {
    vb: [-1, 0, 24, 24], kind: "fill", w: null, extent: 24,
    shapes: [{ d: "M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.08L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z" }]
  },
  Sports: {
    vb: [0, 0, 24, 24], kind: "stroke", w: 1.7, extent: 24,
    shapes: [
      { d: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" },
      { d: "M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45" },
      { d: "M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45" }
    ]
  },
  Pilates: {
    vb: [0, 0, 399.421, 399.421], kind: "fill", w: null, extent: 399.421,
    shapes: [{ d: "M390.421,90.522h-25.905c-0.123-0.003-0.249-0.003-0.372,0h-25.901c-4.971,0-9,4.029-9,9s4.029,9,9,9h17.087v19.085l-170.319,64.885H95.949l-22.765-31.203h14.013c4.971,0,9-4.029,9-9s-4.029-9-9-9H55.684c-0.144-0.004-0.287-0.004-0.431,0H35.021c-4.971,0-9,4.029-9,9s4.029,9,9,9h15.882l22.765,31.203H9c-4.971,0-9,4.029-9,9v98.409c0,4.971,4.029,9,9,9h42.09c4.971,0,9-4.029,9-9v-47.32h253.151v47.32c0,4.971,4.029,9,9,9h42.09c4.971,0,9-4.029,9-9v-98.409c0-0.063,0-0.127-0.002-0.191v-67.284c0.003-0.139,0.003-0.278,0-0.418v-25.076h17.091c4.971,0,9-4.029,9-9S395.392,90.522,390.421,90.522z M355.33,146.869v45.623H235.572L355.33,146.869z M42.09,290.901H18v-38.32h24.09V290.901z M355.332,290.901h-24.09v-38.32h24.09V290.901z M355.332,234.581h-33.09H18v-24.089h73.28c0.068,0.001,0.135,0.001,0.203,0h94.981c0.137,0.003,0.273,0.003,0.41,0h168.458V234.581z" }]
  },
  Other: {
    vb: [0, 0, 256, 256], kind: "fill", w: null, extent: 256,
    shapes: [60, 128, 196].flatMap(cy => [60, 128, 196].map(cx => ({ circle: [cx, cy, 24] })))
  },

  // ── Activities (src/lib/activities.js) ──────────────────────────────────────
  // PLACEHOLDERS until the team's custom set is ready: Tabler Icons (MIT,
  // tabler.io/icons), except Padel, which Tabler does not have and was drawn here.
  Yoga: tablerIcon(["M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "M4 20h4l1.5 -3", "M17 20l-1 -5h-5l1 -7", "M4 10l4 -1l4 -1l4 1.5l4 1.5"]),
  // Shuttlecock: no Tabler badminton icon, so this one is drawn here.
  Badminton: tablerIcon(["M12 16.3m-2.3 0a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0", "M9.9 14.8 7.4 5.2l4.6-2.4l4.6 2.4l-2.5 9.6", "M9.6 8.2h4.8", "M12 2.8v11.6"]),
  Basketball: tablerIcon(["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0", "M5.65 5.65l12.7 12.7", "M5.65 18.35l12.7 -12.7", "M12 3a9 9 0 0 0 9 9", "M3 12a9 9 0 0 1 9 9"]),
  Football: tablerIcon(["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0", "M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55z", "M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45"]),
  Cricket: tablerIcon(["M11.105 18.79l-1 .992a4.159 4.159 0 0 1 -6.038 -5.715l.157 -.166l8.282 -8.401l1.5 1.5l3.45 -3.391a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-3.391 3.45l1.5 1.5l-3.668 3.617", "M10.5 7.5l6 6", "M14 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"]),
  Tennis: tablerIcon(["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0", "M6 5.3a9 9 0 0 1 0 13.4", "M18 5.3a9 9 0 0 0 0 13.4"]),
  Padel: tablerIcon(["M12 2.8c3.4 0 6 2.6 6 6.1c0 3.6-2.6 6.3-6 6.3s-6-2.7-6-6.3c0-3.5 2.6-6.1 6-6.1z", "M10.6 15.1l-.6 2.4h4l-.6-2.4", "M10.8 17.5l-.3 3.7h3l-.3-3.7", "M10 7h.01", "M14 7h.01", "M12 9.3h.01", "M10 11.6h.01", "M14 11.6h.01"]),
  // Squash racket and ball: no Tabler squash icon, so this one is drawn here.
  Squash: tablerIcon(["M4.55 4.55A7 5 45 1 1 14.45 14.45A7 5 45 1 1 4.55 4.55z", "M6.7 6.7l5.6 5.6", "M6.9 12.1l5.2 -5.2", "M14.45 14.45l1.9 1.9", "M15.86 17.14l4 4l1.28 -1.28l-4 -4z", "M19.3 4.7m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"]),
  Pickleball: tablerIcon(["M12.718 20.713a7.64 7.64 0 0 1 -7.48 -12.755l.72 -.72a7.643 7.643 0 0 1 9.105 -1.283l2.387 -2.345a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-2.346 2.387a7.644 7.644 0 0 1 -1.052 8.864", "M14 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "M9.3 5.3l9.4 9.4"]),
  Golf: tablerIcon(["M12 18v-15l7 4l-7 4", "M9 17.67c-.62 .36 -1 .82 -1 1.33c0 1.1 1.8 2 4 2s4 -.9 4 -2c0 -.5 -.38 -.97 -1 -1.33"]),
  Volleyball: tablerIcon(["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0", "M12 12a8 8 0 0 0 8 4", "M7.5 13.5a12 12 0 0 0 8.5 6.5", "M12 12a8 8 0 0 0 -7.464 4.928", "M12.951 7.353a12 12 0 0 0 -9.88 4.111", "M12 12a8 8 0 0 0 -.536 -8.928", "M15.549 15.147a12 12 0 0 0 1.38 -10.611"]),
  Hiking: tablerIcon(["M12 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "M7 21l2 -4", "M13 21v-4l-3 -3l1 -6l3 4l3 2", "M10 14l-1.827 -1.218a2 2 0 0 1 -.831 -2.15l.28 -1.117a2 2 0 0 1 1.939 -1.515h1.439l4 1l3 -2", "M17 12v9", "M16 20h2"]),
  Swimming: tablerIcon(["M16 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "M6 11l4 -2l3.5 3l-1.5 2", "M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25"]),
  Climbing: tablerIcon(["M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612z", "M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2"]),
  Cycling: tablerIcon(["M5 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "M19 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "M12 19l0 -4l-3 -3l5 -4l2 3l3 0", "M17 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"]),
  Rowing: tablerIcon(["M6.414 6.414a2 2 0 0 0 0 -2.828l-1.414 -1.414l-2.828 2.828l1.414 1.414a2 2 0 0 0 2.828 0z", "M17.586 17.586a2 2 0 0 0 0 2.828l1.414 1.414l2.828 -2.828l-1.414 -1.414a2 2 0 0 0 -2.828 0z", "M6.5 6.5l11 11", "M22 2.5c-9.983 2.601 -17.627 7.952 -20 19.5c9.983 -2.601 17.627 -7.952 20 -19.5z", "M6.5 12.5l5 5", "M12.5 6.5l5 5"]),
  "Home Workout": tablerIcon(["M21 12l-9 -9l-9 9h2v7a2 2 0 0 0 2 2h6", "M9 21v-6a2 2 0 0 1 2 -2h2c.39 0 .754 .112 1.061 .304", "M19 21.5l2.518 -2.58a1.74 1.74 0 0 0 0 -2.413a1.627 1.627 0 0 0 -2.346 0l-.168 .172l-.168 -.172a1.627 1.627 0 0 0 -2.346 0a1.74 1.74 0 0 0 0 2.412l2.51 2.59z"]),
  Kitesurfing: tablerIcon(["M22 12a10 10 0 1 0 -20 0", "M22 12c0 -1.66 -1.46 -3 -3.25 -3c-1.8 0 -3.25 1.34 -3.25 3c0 -1.66 -1.57 -3 -3.5 -3s-3.5 1.34 -3.5 3c0 -1.66 -1.46 -3 -3.25 -3c-1.8 0 -3.25 1.34 -3.25 3", "M2 12l10 10l-3.5 -10", "M15.5 12l-3.5 10l10 -10"])
};

// Placeholder activity icons share one stroke style, matching Sports.
function tablerIcon(paths) {
  return { vb: [0, 0, 24, 24], kind: "stroke", w: 1.7, extent: 24, shapes: paths.map(d => ({ d })) };
}

// Case-insensitive: log.type is "Gym" but callers have historically lowercased.
function getWorkoutIcon(type) {
  if (!type) return null;
  const key = String(type).toLowerCase();
  for (const name in WORKOUT_ICONS) {
    if (name.toLowerCase() === key) return WORKOUT_ICONS[name];
  }
  return null;
}

export { WORKOUT_ICONS, getWorkoutIcon };
