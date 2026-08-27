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
  }
};

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
