// Fero monthly share sticker — shared renderer.
// Used by the browsable mockup and by the headless PNG exporter, so both stay identical.
//
// Single-colour system: every logged day is one colour, and the session TYPE is carried
// by an icon inside the cell rather than by hue. That removes the legend entirely.

const WORKOUT_TYPES = ["Gym","Run","Sports","Pilates","Other"];

// Two themes: "cyan" is the branded one, "white" the neutral monochrome alternative.
// Every rule other than these fills is theme-agnostic and lives in sticker-style.css.
//
// Calendar days are translucent so the photo reads faintly through them — a solid fill
// looked like a hard sticker pasted on top.
// Three styles, one design. They differ on a single axis — how much presence the
// calendar has — which maps to how busy the photo underneath is.
//   solid → white tiles, navy icons. For noisy photos.
//   grid  → no fill, faint outline boxes, silver icons. The safe default.
//   bare  → no boxes at all, silver icons only. For clean skies.
const WHITE_FILL =
  "linear-gradient(155deg,rgba(255,255,255,.73) 0%,rgba(255,255,255,.49) 48%,rgba(228,240,238,.26) 100%)";
const STYLES = {
  solid: { fill:WHITE_FILL, boxes:true,  silverIcon:false, iconInk:"#1A2E4A",
           meFill:"linear-gradient(155deg,#FFFFFF,#E9F1F0)", hitRGB:["#FFFFFF","#E4EDEC"] },
  grid:  { fill:null,       boxes:true,  silverIcon:true,  iconInk:"#1A2E4A",
           meFill:"linear-gradient(155deg,#FFFFFF,#E9F1F0)", hitRGB:["#FFFFFF","#E4EDEC"] },
  bare:  { fill:null,       boxes:false, silverIcon:true,  iconInk:"#1A2E4A",
           meFill:"linear-gradient(155deg,#FFFFFF,#E9F1F0)", hitRGB:["#FFFFFF","#E4EDEC"] }
};
const RED_FILL = "linear-gradient(155deg,#E97070,#B93636)";

const ICON_PATHS = {
  Gym: { vb:"0 0 24 24", kind:"stroke", w:2.1,
    body:'<path d="M2.5 9.5v5"/><path d="M5.5 8.2v7.6"/><path d="M8.2 10.1v3.8"/><path d="M15.8 10.1v3.8"/><path d="M18.5 8.2v7.6"/><path d="M21.5 9.5v5"/><path d="M8.2 12h7.6"/>' },
  Run: { vb:"-1 0 24 24", kind:"fill", w:null,
    body:'<path d="M13.5,5.5C14.59,5.5 15.5,4.58 15.5,3.5C15.5,2.38 14.59,1.5 13.5,1.5C12.39,1.5 11.5,2.38 11.5,3.5C11.5,4.58 12.39,5.5 13.5,5.5M9.89,19.38L10.89,15L13,17V23H15V15.5L12.89,13.5L13.5,10.5C14.79,12 16.79,13 19,13V11C17.09,11 15.5,10 14.69,8.58L13.69,7C13.29,6.38 12.69,6 12,6C11.69,6 11.5,6.08 11.19,6.08L6,8.28V13H8V9.58L9.79,8.88L8.19,17L3.29,16L2.89,18L9.89,19.38Z"/>' },
  Sports: { vb:"0 0 24 24", kind:"stroke", w:1.7,
    body:'<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55l4.76 -3.45"/><path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45"/>' },
  Pilates: { vb:"0 0 399.421 399.421", kind:"fill", w:null,
    body:'<path d="M390.421,90.522h-25.905c-0.123-0.003-0.249-0.003-0.372,0h-25.901c-4.971,0-9,4.029-9,9s4.029,9,9,9h17.087v19.085l-170.319,64.885H95.949l-22.765-31.203h14.013c4.971,0,9-4.029,9-9s-4.029-9-9-9H55.684c-0.144-0.004-0.287-0.004-0.431,0H35.021c-4.971,0-9,4.029-9,9s4.029,9,9,9h15.882l22.765,31.203H9c-4.971,0-9,4.029-9,9v98.409c0,4.971,4.029,9,9,9h42.09c4.971,0,9-4.029,9-9v-47.32h253.151v47.32c0,4.971,4.029,9,9,9h42.09c4.971,0,9-4.029,9-9v-98.409c0-0.063,0-0.127-0.002-0.191v-67.284c0.003-0.139,0.003-0.278,0-0.418v-25.076h17.091c4.971,0,9-4.029,9-9S395.392,90.522,390.421,90.522z M355.33,146.869v45.623H235.572L355.33,146.869z M42.09,290.901H18v-38.32h24.09V290.901z M355.332,290.901h-24.09v-38.32h24.09V290.901z M355.332,234.581h-33.09H18v-24.089h73.28c0.068,0.001,0.135,0.001,0.203,0h94.981c0.137,0.003,0.273,0.003,0.41,0h168.458V234.581z"/>' },
  Other: { vb:"0 0 256 256", kind:"fill", w:null,
    body:'<circle cx="60" cy="60" r="24"/><circle cx="128" cy="60" r="24"/><circle cx="196" cy="60" r="24"/><circle cx="60" cy="128" r="24"/><circle cx="128" cy="128" r="24"/><circle cx="196" cy="128" r="24"/><circle cx="60" cy="196" r="24"/><circle cx="128" cy="196" r="24"/><circle cx="196" cy="196" r="24"/>' },
};

// A hairline dark edge, same idea as the type. Stroke-drawn icons get the path laid
// down twice — a wider dark pass underneath, the silver pass on top. Filled icons use
// paint-order:stroke so the outline sits under the fill instead of eating into it.
// Edge width scales with each icon's viewBox so it reads identically at every size.
function icon(type,size,color,defs,edge){
  const ic = ICON_PATHS[type];
  if(!ic) return "";
  const c = color || STYLES.grid.iconInk;
  const d = defs || "";
  const cap = ' stroke-linecap="round" stroke-linejoin="round"';
  let inner;
  if(ic.kind === "stroke"){
    const base = '<g fill="none"'+cap+'>'+ic.body+'</g>';
    const top  = base.replace('<g fill="none"', '<g fill="none" stroke="'+c+'" stroke-width="'+ic.w+'"');
    inner = edge
      ? base.replace('<g fill="none"', '<g fill="none" stroke="'+edge.color+'" stroke-width="'+(Number(ic.w)+edge.w*2)+'"') + top
      : top;
  } else {
    inner = edge
      ? '<g fill="'+c+'" stroke="'+edge.color+'" stroke-width="'+(edge.w*2)+'" paint-order="stroke"'+cap+'>'+ic.body+'</g>'
      : '<g fill="'+c+'">'+ic.body+'</g>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+size+'" height="'+size+'" viewBox="'+ic.vb+'">'+d+inner+'</svg>';
}

// Brushed-silver ramp for the fill-less white theme: white → grey → white reads as a
// metallic sheen rather than a flat tint. Scoped per instance so ids never collide.
//
// MUST be userSpaceOnUse. The default objectBoundingBox units collapse on a zero-area
// bbox, and the dumbbell is drawn from vertical strokes whose bbox width is exactly 0 —
// under bounding-box units those paths render nothing at all.
let _gradSeq = 0;
const ICON_EXTENT = { Gym:24, Run:24, Sports:24, Pilates:399.421, Other:256 };
function silverDefs(id, extent){
  const e = extent || 24;
  return '<defs><linearGradient id="'+id+'" gradientUnits="userSpaceOnUse"'+
    ' x1="0" y1="0" x2="'+(e*0.85)+'" y2="'+e+'">'+
    '<stop offset="0%" stop-color="#FFFFFF"/>'+
    '<stop offset="34%" stop-color="#FBFDFD"/>'+
    '<stop offset="62%" stop-color="#E2EAED"/>'+
    '<stop offset="82%" stop-color="#F8FBFC"/>'+
    '<stop offset="100%" stop-color="#FFFFFF"/>'+
  '</linearGradient></defs>';
}

const OFFSET = 2, DAYS = 31;   // July 2026 starts Wednesday, Monday-first

// A day holds an ARRAY of activities. The icon shown is the first logged; the count
// badge appears only from 2 upward. Total activities is the sum, which is why the
// header number and the number of marks are allowed to differ.
const one = t => [t];
const DENSE = {1:one("Gym"),2:one("Run"),4:one("Gym"),5:one("Sports"),6:one("Gym"),
  8:one("Run"),9:one("Gym"),10:one("Pilates"),11:one("Sports"),13:one("Gym"),
  14:one("Run"),15:one("Gym"),17:one("Sports"),18:one("Gym"),19:one("Run"),
  20:one("Gym"),22:one("Pilates"),23:one("Gym"),25:one("Run"),26:one("Sports"),
  28:one("Gym"),30:one("Run")};
const SPARSE = {2:one("Gym"),6:one("Run"),9:one("Gym"),14:one("Sports"),17:one("Gym"),
  21:one("Run"),26:one("Gym"),29:one("Other")};

// Same 22 days as DENSE so the grid shape is identical — only the badges differ.
// 27 activities across 22 days: three doubles and one triple.
const MULTI = Object.assign({}, DENSE, {
  4:["Gym","Run"], 9:["Gym","Sports"], 17:["Sports","Gym"], 25:["Run","Gym","Pilates"]
});
// 10 activities across the same 8 days.
const MULTI_SPARSE = Object.assign({}, SPARSE, {
  6:["Run","Gym"], 17:["Gym","Sports"]
});
const DATASETS = { dense:DENSE, sparse:SPARSE, multi:MULTI, "multi-sparse":MULTI_SPARSE };
const totalActivities = logs => Object.values(logs).reduce((n,a)=>n+a.length,0);

function hexA(hex,a){
  const n = parseInt(hex.slice(1),16);
  return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')';
}

// No drop shadow — just the fill and a soft inner top highlight to keep the cell
// feeling like glass rather than a flat swatch.
function cellStyle(th){
  if(!th.fill) return '';                                // fill-less: styled by CSS instead
  return 'background:'+th.fill+';'+
         'border:1px solid rgba(2,30,28,.24);'+          // hairline edge, same idea as the text stroke
         'box-shadow:inset 0 1px 0 rgba(255,255,255,.3);';
}

// The icon carries the whole signal when there's no fill, so it gets the silver ramp.
function dayIcon(type, th){
  if(!th.silverIcon) return icon(type,21,th.iconInk);
  const id = 'fs'+(_gradSeq++);
  const e = ICON_EXTENT[type];
  return icon(type,21,'url(#'+id+')', silverDefs(id, e), {color:"rgba(2,26,24,.5)", w:e/53});
}

// In Bare, an unused day renders nothing at all — so a trailing row with no logged
// days is pure void, and the gap above the wordmark would change size month to month
// depending on which weekday the month happened to end on. Trim those rows.
// Solid and Grid keep every row, because there the empty boxes ARE the calendar.
function lastOccupiedRow(logs){
  let last = 0;
  for(const d of Object.keys(logs)) last = Math.max(last, Math.floor((OFFSET + Number(d) - 1) / 7));
  return last;
}

function calendarGrid(logs, th){
  const boxes = th.boxes;
  const slots = boxes ? OFFSET + DAYS : (lastOccupiedRow(logs) + 1) * 7;
  let html = '<div class="wd">'+["M","T","W","T","F","S","S"].map(d=>'<span>'+d+'</span>').join('')+'</div>';
  html += '<div class="grid">';
  for(let i=0;i<OFFSET;i++) html += '<div class="cell pad"></div>';
  for(let d=1; d<=DAYS && OFFSET+d-1 < slots; d++){
    const day = logs[d];
    if(!day){ html += '<div class="cell off"></div>'; continue; }
    // Anchored to the glyph, not the cell corner — in Bare the cell is invisible, so a
    // badge parked at the corner of nothing would read as detached.
    const badge = day.length > 1 ? '<i class="mult">'+day.length+'</i>' : '';
    html += '<div class="cell on" style="'+(boxes?cellStyle(th):'')+'">'+
      '<span class="ic">'+dayIcon(day[0],th)+badge+'</span></div>';
  }
  return html + '</div>';
}

const headRow = n =>
  '<div class="s-head">'+
    '<span class="s-month">July <span class="yr">2026</span></span>'+
    '<span class="sep">:</span>'+
    '<span class="s-count"><span class="n">'+n+'</span><span class="u">activities</span></span>'+
  '</div>';
const brandRow = () => '<div class="mark">FER<span class="o">O</span></div>';

// ── outcome copy ───────────────────────────────────────────────────────────────
// won    → hit the target AND collected money
// hit    → hit the target, no money moved
// missed → fell short, owes money
const OUTCOMES = {
  won:    { label:"TOP OF THE BLOC", money:"+£45", tone:"cyan" },
  hit:    { label:"TARGET HIT",      money:"",     tone:"cyan" },
  missed: { label:"MISSED TARGET",   money:"−£30", tone:"red"  }
};

const ROSTER = [
  {name:"Aadhil",me:true,seed:3,count:22},
  {name:"Isindu",me:false,seed:7,count:18},
  {name:"Nuwan", me:false,seed:11,count:14},
  {name:"Tharu", me:false,seed:5,count:9}
];
const BLOC_TARGET = 16;
const BLOC_PODIUM = 3;   // the sticker is only offered to the top three finishers

function miniRow(count,seed,fill){
  const days = Array.from({length:31},(_,i)=>i);
  let k = seed;
  for(let i=days.length-1;i>0;i--){
    k = (k*1103515245 + 12345) & 0x7fffffff;
    const j = k % (i+1);
    [days[i],days[j]] = [days[j],days[i]];
  }
  const on = new Set(days.slice(0,count));
  return Array.from({length:31},(_,d) => on.has(d)
    ? '<i style="background:'+fill+'"></i>'
    : '<i class="off"></i>').join('');
}

// Your row runs hotter than the calendar cyan; everyone who also hit target is pulled
// back a step. Red stays where it is — a missed month should still be easy to spot.
// Hue carries pass/fail; brightness carries "this one is you".
const OTHERS_HIT_ALPHA  = .56;
const OTHERS_MISS_ALPHA = .72;
function rosterFill(member, th){
  const hit = member.count >= BLOC_TARGET;
  if(member.me) return hit ? th.meFill : RED_FILL;
  return hit
    ? "linear-gradient(155deg,"+hexA(th.hitRGB[0],OTHERS_HIT_ALPHA)+","+hexA(th.hitRGB[1],OTHERS_HIT_ALPHA)+")"
    : "linear-gradient(155deg,"+hexA("#E97070",OTHERS_MISS_ALPHA)+","+hexA("#B93636",OTHERS_MISS_ALPHA)+")";
}

// opts: { style:"solid"|"grid"|"bare", density:"dense"|"sparse" }
//
// Layout A: month titles it, the count sits above the calendar sharing a baseline with
// its label, and the brand signs off alone at the bottom. No verdict, no money, no
// target — the sticker says "here is my month" and nothing else.
function renderSticker(opts){
  const st = STYLES[opts.style] || STYLES.grid;
  const logs = DATASETS[opts.density] || DENSE;
  const n = totalActivities(logs);
  const cls = "sticker s-" + (STYLES[opts.style] ? opts.style : "grid");

  return '<div class="'+cls+'">'+
    headRow(n)+
    calendarGrid(logs, st)+
    brandRow()+
  '</div>';
}
