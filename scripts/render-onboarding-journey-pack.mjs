import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const OUT_ROOT = process.env.FERO_JOURNEY_OUT || "/Users/opera_user/Documents/Codex Space/Lift Log/docs/user-journey-screenshots/2026-08-12";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 390;
const H = 844;
const HTML_ONLY = process.argv.includes("--html-only");

const flows = [
  {
    id: "01-cold-create-bloc",
    title: "Cold Download → Create Bloc",
    frames: [
      ["01-onboarding-leaderboard", onboarding1()],
      ["02-onboarding-activity", onboarding2()],
      ["03-onboarding-settlement", onboarding3()],
      ["04-onboarding-create-entry", onboarding4()],
      ["05-onboarding-create-entry-filled", onboarding4("Journey Crew")],
      ["06-create-bloc-modal", modalFrame(createBlocModal())],
      ["07-sign-in-first-email", modalFrame(authModal("Sign in first", "Use your email so your Bloc is saved to your account.", "Email", "journey-create@local.test", "Send code"))],
      ["08-otp-code", modalFrame(authModal("Check your email", "We sent a 6-digit code to journey-create@local.test.", "Code", "000000", "Verify"))],
      ["09-display-name-photo-empty", profileSetup(false)],
      ["10-display-name-photo-filled", profileSetup(true, "Journey Maker")],
      ["11-progress-creating", progress("Saving your name", .34)],
      ["12-landed-in-new-bloc", appToday("Journey Crew", "Finish setup", true)]
    ]
  },
  {
    id: "02-cold-join-code",
    title: "Cold Download → Join Existing Bloc By Code",
    frames: [
      ["01-onboarding-join-entry", onboarding4()],
      ["02-invite-code", modalFrame(joinCodeModal("Join a Bloc", "Enter a Bloc invite code.", "ALHK05"))],
      ["03-sign-in-first-email", modalFrame(authModal("Sign in first", "Use your email so we can add you to the Bloc.", "Email", "journey-join@local.test", "Send code"))],
      ["04-otp-code", modalFrame(authModal("Check your email", "We sent a 6-digit code to journey-join@local.test.", "Code", "000000", "Verify"))],
      ["05-display-name-photo-empty", profileSetup(false)],
      ["06-display-name-photo-filled", profileSetup(true, "Journey Joiner")],
      ["07-progress-joining", progress("Joining your Bloc", .58)],
      ["08-landed-in-joined-bloc", appToday("Join Flow Seed 191851", "You're in", false)]
    ]
  },
  {
    id: "03-invite-link-new-user",
    title: "Invite Link → New User Joins",
    frames: [
      ["01-invite-preview", invitePreview()],
      ["02-sign-in-first-email", modalFrame(authModal("Sign in first", "Use your email so we can add you to the Bloc.", "Email", "journey-invite@local.test", "Send code"))],
      ["03-otp-code", modalFrame(authModal("Check your email", "We sent a 6-digit code to journey-invite@local.test.", "Code", "000000", "Verify"))],
      ["04-display-name-photo-empty", profileSetup(false)],
      ["05-display-name-photo-filled", profileSetup(true, "Invite Journey")],
      ["06-progress-joining", progress("Opening your Bloc", .82)],
      ["07-landed-with-toast", appToday("Join Flow Seed 191851", "You're in", false, true)]
    ]
  },
  {
    id: "04-welcome-back-new-account",
    title: "Welcome Back → Create New Account",
    frames: [
      ["01-welcome-back", welcomeBack()],
      ["02-create-account-email", modalFrame(authModal("Create your account", "Use a new email. We'll send a one-time code.", "Email", "journey-welcome@local.test", "Send code"))],
      ["03-otp-code", modalFrame(authModal("Check your email", "We sent a 6-digit code to journey-welcome@local.test.", "Code", "000000", "Verify"))],
      ["04-onboarding-start-after-account", onboarding1()],
      ["05-onboarding-create-entry", onboarding4("Welcome Crew")],
      ["06-create-bloc-modal", modalFrame(createBlocModal("Welcome Crew"))],
      ["07-display-name-photo-filled", profileSetup(true, "Welcome Maker")],
      ["08-progress-creating", progress("Setting up your Bloc", .7)],
      ["09-landed-in-new-bloc", appToday("Welcome Crew", "Finish setup", true)]
    ]
  },
  {
    id: "05-edge-states",
    title: "Invite Edge States",
    frames: [
      ["01-invalid-invite", deadState("Invite not found", "This link does not point to an active Bloc invite.")],
      ["02-full-bloc", modalFrame(joinCodeModal("Join this Bloc", "Join Flow Seed 191851 is ready. Confirm the invite code below to join.", "ALHK05", "This Bloc is full. Maximum 20 members allowed."))],
      ["03-already-member", modalFrame(alreadyMemberModal())],
      ["04-empty-bloc-switcher", emptySwitcher()]
    ]
  }
];

function css() {
  return `
  :root{--bg:#050909;--card:#080F0F;--s2:#121B22;--cyan:#4ECDC4;--border:#163d36;--muted:#8FAEAA;--text:#F5F7FF;--amber:#D4A843;--red:#D44A4A}
  *{box-sizing:border-box} body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:radial-gradient(ellipse 70% 45% at 50% 0%,rgba(78,205,196,.10),transparent 55%),linear-gradient(#071615,#050909);color:var(--text);font-family:Outfit,Raleway,Inter,Arial,sans-serif;letter-spacing:0}
  .screen{width:${W}px;height:${H}px;padding:42px 22px 24px;display:flex;flex-direction:column;align-items:center;position:relative}
  .word{font-size:54px;line-height:.9;font-weight:1000;letter-spacing:-2px;align-self:flex-start}.word span{color:var(--cyan)}
  .headline{font-family:Raleway,Outfit,sans-serif;font-size:34px;font-weight:1000;line-height:1.02;text-align:center;margin:54px 0 18px}.headline.small{font-size:33px}.sub{font-size:17px;font-weight:800;line-height:1.55;color:rgba(214,226,224,.72);text-align:center}
  .card{width:100%;border:.5px solid rgba(22,61,54,.9);border-radius:18px;background:radial-gradient(circle at 78% 0%,rgba(78,205,196,.08),transparent 34%),rgba(6,16,14,.96);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 18px 46px rgba(0,0,0,.32);overflow:hidden}
  .label{font-size:10px;font-weight:1000;letter-spacing:.12em;color:rgba(78,205,196,.76);text-transform:uppercase}.row{display:grid;align-items:center;gap:10px;border-bottom:.5px solid rgba(22,61,54,.5);padding:10px 12px}.row:last-child{border-bottom:0}
  .avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:white;font-weight:1000;overflow:hidden;background:#9b5}.avatar img{width:100%;height:100%;object-fit:cover}
  .tag{min-width:72px;justify-self:end;border-radius:999px;padding:4px 8px;text-align:center;font-size:9px;font-weight:1000;letter-spacing:.06em}.cleared{background:linear-gradient(90deg,rgba(203,213,225,.08),rgba(203,213,225,.35));color:#e2e8f0}.track{background:rgba(90,191,90,.14);color:#5abf5a}.risk{background:#1e1808;color:#d4a843}.cooked{background:rgba(212,74,74,.14);color:#d44a4a}
  .controls{position:absolute;left:22px;right:22px;bottom:94px;display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:16px}.circle{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:rgba(13,31,30,.86);border:.5px solid rgba(78,205,196,.25);color:var(--cyan);font-size:26px}.circle.next{background:var(--cyan);color:#04100f;border:0}.dots{display:flex;justify-content:center;gap:7px}.dot{width:7px;height:7px;border-radius:9px;background:rgba(143,174,170,.28)}.dot.on{width:20px;background:var(--cyan)}
  .btn{height:54px;border-radius:16px;border:0;background:var(--cyan);color:#050909;font-weight:1000;font-size:17px;display:grid;place-items:center}.btn.secondary{background:#121B22;color:#8FAEAA;border:.5px solid #163d36}
  .modalBg{position:absolute;inset:0;background:rgba(5,9,9,.86);display:grid;place-items:center;padding:20px}.modal{width:100%;border-radius:20px;padding:22px 18px;background:#080F0F;border:.5px solid #163d36;box-shadow:0 24px 80px rgba(0,0,0,.5)}.modal h1{font-size:34px;line-height:1.04;margin:0 0 12px;font-family:Raleway,Outfit,sans-serif}.helper{font-size:15px;line-height:1.55;color:#8FAEAA;margin-bottom:18px}.input{height:54px;border-radius:14px;background:#121B22;border:.5px solid rgba(78,205,196,.32);padding:0 16px;display:flex;align-items:center;font-size:18px;font-weight:800;color:#f5f7ff;width:100%}.actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
  .photo{width:76px;height:76px;border-radius:50%;background:#121B22;border:.5px solid rgba(78,205,196,.34);display:grid;place-items:center;overflow:hidden;box-shadow:0 0 30px rgba(78,205,196,.11)}.photo img{width:100%;height:100%;object-fit:cover}
  .topbar{height:70px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#020506;border-bottom:.5px solid #163d36}.nav{position:absolute;bottom:40px;left:24px;right:24px;height:72px;border-radius:36px;background:rgba(13,31,30,.88);border:.5px solid rgba(78,205,196,.28);display:flex;align-items:center;justify-content:space-around;box-shadow:0 0 40px rgba(78,205,196,.10)}.toast{position:absolute;top:86px;left:86px;right:86px;border-radius:16px;background:rgba(8,15,15,.96);border:.5px solid rgba(78,205,196,.3);padding:12px;text-align:center;color:#4ECDC4;font-weight:1000}
  `;
}

function html(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css()}</style></head><body>${body}</body></html>`;
}

function controls(i) {
  return `<div class="controls"><div class="circle">‹</div><div class="dots">${[0,1,2,3].map(n=>`<span class="dot ${n===i?"on":""}"></span>`).join("")}</div><div class="circle next">›</div></div>`;
}

function onboardingShell(i, headline, visual, sub = "") {
  return html(`<main class="screen"><div class="word">FER<span>O</span></div><div class="headline ${headline.length>29?"small":""}">${headline}</div>${visual}${sub ? `<div class="sub" style="margin-top:18px">${sub}</div>` : ""}${controls(i)}</main>`);
}

function onboarding1() {
  const rows = [
    ["Tariq","CLEARED","14","cleared","#D94D68"],
    ["Hana","ON TRACK","10","track","#F2A83A"],
    ["Noah","AT RISK","7","risk","#8A78D6"],
    ["Eli","COOKED","3","cooked","#C17F5A"]
  ];
  const visual = `<div class="card" style="margin-top:4px"><div style="padding:16px;border-bottom:.5px solid rgba(22,61,54,.7)" class="label">SUNDAY WARRIORS · BLOC LEADERBOARD</div>${rows.map((r,i)=>`<div class="row" style="grid-template-columns:28px 34px 1fr auto 32px"><b style="color:#8FAEAA">#${i+1}</b><span class="avatar" style="background:${r[4]}">${r[0][0]}</span><b style="font-size:17px">${r[0]}</b><span class="tag ${r[3]}">${r[1]}</span><b style="font-size:19px;color:#4ECDC4;text-align:right">${r[2]}</b></div>`).join("")}</div>`;
  return onboardingShell(0, "For the Bloc that<br>keeps you showing up.", visual, `<span>A monthly target. A live leaderboard.</span><br>Progress everyone can see.`);
}

function onboarding2() {
  const rows = [
    ["Axel","Gym","Chest day done","🏋️"],
    ["Monica","Run","5K this morning","🏃"],
    ["Mina","Sports","Pickup hoops","🏀"]
  ];
  const visual = `<div class="card" style="margin-top:8px"><div style="padding:16px;border-bottom:.5px solid rgba(22,61,54,.7)" class="label">ACTIVITY FEED</div>${rows.map((r,i)=>`<div class="row" style="grid-template-columns:34px 1fr 78px"><span class="avatar" style="background:${["#3E7CC3","#8A78D6","#D94D68"][i]}">${r[0][0]}</span><div><b style="font-size:16px">${r[0]}</b> <span style="color:#4ECDC4">${r[3]}</span> <span style="color:#8FAEAA">${r[1]}</span><div style="font-size:12px;color:#cbd5d1;margin-top:6px">${r[2]}</div></div><div style="width:78px;height:78px;border-radius:14px;background:linear-gradient(135deg,#1f3440,#0d1f1e);display:grid;place-items:center;font-size:30px">${r[3]}</div></div>`).join("")}</div>`;
  return onboardingShell(1, "Pick your people.", visual, "Hold each other accountable.");
}

function onboarding3() {
  const visual = `<div class="card" style="margin-top:2px"><div style="padding:16px;border-bottom:.5px solid rgba(22,61,54,.7)" class="label">THE SETTLEMENT</div><div style="padding:13px;display:grid;gap:14px"><div style="border:1px solid rgba(57,168,90,.24);background:rgba(57,168,90,.11);border-radius:15px;padding:14px;text-align:center"><div class="label" style="color:#7ee59b">WINNER</div><div style="font-size:42px;font-weight:1000;color:#39A85A">+$25</div><div style="font-weight:800;color:#cbd5d1">Top of the Bloc. Maya and Leo pay you.</div><hr style="border-color:rgba(255,255,255,.1);width:44%"><b>Maya <span style="color:#39A85A">+$15</span></b><br><b>Leo <span style="color:#39A85A">+$10</span></b></div><div style="border:1px solid rgba(185,50,50,.22);background:rgba(185,50,50,.07);border-radius:15px;padding:14px;text-align:center"><div class="label" style="color:#ff8a8a">TOUGH MONTH</div><div style="font-size:42px;font-weight:1000;color:#E65A5A">-$20</div><div style="font-weight:800;color:#cbd5d1">You missed the target. Bounce back next month.</div><hr style="border-color:rgba(255,255,255,.1);width:44%"><b>You owe Noah <span style="color:#E65A5A">-$20</span></b></div></div></div>`;
  return onboardingShell(2, "Set a target. Set a penalty.", visual, "Miss it, and you owe. Hit it, and you're cleared.");
}

function onboarding4(value = "") {
  const visual = `<div class="card" style="padding:18px;margin-top:12px"><div class="input" style="box-shadow:0 0 0 3px rgba(78,205,196,.10)">${value || "Type your Bloc name"}</div></div><div class="sub" style="margin-top:18px">Start a Bloc. Bring your mates in.<br><span style="color:#4ECDC4;font-weight:1000">Consistency's a group sport.</span></div><div class="btn" style="width:100%;margin-top:22px">Create your Bloc</div><div style="margin-top:16px;color:#4ECDC4;font-weight:900">Join an existing Bloc instead</div>`;
  return onboardingShell(3, "Show up together.<br>Or pay up.", visual);
}

function modalFrame(inner) {
  return html(`<div class="screen" style="padding:0"><div class="modalBg">${inner}</div></div>`);
}

function createBlocModal(name = "Journey Crew") {
  return `<div class="modal"><h1>Create a Bloc</h1><p class="helper">Start the Bloc now. Tune the rules after.</p><div class="label">Bloc Name</div><div class="input" style="margin:6px 0 16px">${name}</div><div class="label">Monthly penalty amount</div><div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin:6px 0 16px"><div class="input">NOK</div><div class="input">20</div></div><div class="label">Monthly workout target</div><div class="input" style="width:130px;margin-top:6px;justify-content:space-between"><b>-</b><span>12</span><b>+</b></div><div class="actions"><div class="btn secondary">Cancel</div><div class="btn">Create</div></div></div>`;
}

function authModal(title, helper, label, value, action) {
  return `<div class="modal"><h1>${title}</h1><p class="helper">${helper}</p><div class="label">${label}</div><div class="input" style="margin-top:6px">${value}</div><div class="actions"><div class="btn secondary">Cancel</div><div class="btn">${action}</div></div></div>`;
}

function joinCodeModal(title, helper, code, error = "") {
  return `<div class="modal"><h1>${title}</h1><p class="helper">${helper}</p><div class="label">Invite code</div><div class="input" style="margin-top:6px">${code}</div>${error ? `<p style="color:#D4A843;font-weight:800;font-size:13px">${error}</p>` : ""}<div class="actions"><div class="btn secondary">Cancel</div><div class="btn">Join Bloc</div></div></div>`;
}

function alreadyMemberModal() {
  return `<div class="modal"><h1>You're already in this Bloc</h1><p class="helper">Sign in to open the Bloc you're already part of.</p><div class="actions"><div class="btn secondary">Use different email</div><div class="btn">Enter the Bloc</div></div></div>`;
}

function profileSetup(withPhoto, name = "") {
  const img = withPhoto ? `<img src="../local-test-profile.png">` : `📷`;
  return html(`<main class="screen" style="justify-content:center;text-align:center"><div class="word" style="align-self:center;font-size:70px">FER<span>O</span></div><div class="headline" style="margin:32px 0 24px">What should your Bloc call you?</div><div class="card" style="padding:16px;display:grid;gap:13px;justify-items:center"><div class="photo">${img}</div><b style="color:#8FAEAA;font-size:12px">${withPhoto ? "Change Photo" : "Add Photo"}</b><div class="input">${name || "Display name"}</div><div class="btn" style="width:100%;opacity:${name ? 1 : .45}">Continue</div></div></main>`);
}

function progress(text, pct) {
  return html(`<main class="screen" style="justify-content:center;text-align:center"><div class="word" style="align-self:center;font-size:70px">FER<span>O</span></div><h1 class="headline" style="margin:48px 0 18px">${text}</h1><div style="width:250px;height:8px;background:#121B22;border-radius:999px;overflow:hidden;border:.5px solid rgba(78,205,196,.22)"><div style="width:${Math.round(pct*100)}%;height:100%;background:#4ECDC4;border-radius:999px"></div></div><p class="helper" style="margin-top:16px">Opening your Bloc</p></main>`);
}

function appToday(name, banner, setup, toast = false) {
  return html(`<div style="height:${H}px;background:#050909;color:#f5f7ff;position:relative;overflow:hidden"><div class="topbar"><div style="font-weight:1000;font-size:27px">FER<span style="color:#4ECDC4">O</span></div><b style="color:#4ECDC4">⌂ ${name}</b><div>◯ ⚙</div></div>${toast ? `<div class="toast">You're in</div>` : ""}<main style="padding:22px"><div style="color:#8FAEAA;font-weight:1000;letter-spacing:.16em;font-size:12px">AUGUST · DAY 1/31</div>${setup ? `<div class="card" style="padding:18px;margin:18px 0"><div class="label">FINISH SETUP</div><h2 style="margin:8px 0 4px">3 things need review</h2><p class="helper" style="margin:0">Check defaults before your Bloc starts properly.</p></div>` : ""}<div class="card"><div style="padding:18px;border-bottom:.5px solid #163d36"><h2 style="margin:0">Bloc Leaderboard</h2></div>${["You","Alex","Mina","Noah"].map((n,i)=>`<div class="row" style="grid-template-columns:34px 1fr auto"><span class="avatar" style="background:${["#D94D68","#3E7CC3","#8A78D6","#C17F5A"][i]}">${n[0]}</span><b>${n}</b><span class="tag risk">AT RISK</span></div>`).join("")}</div></main><div class="nav"><b>↕<br>Today</b><b>⌁<br>Activity</b><b style="font-size:44px;color:#4ECDC4">＋</b><b>▥<br>Month</b><b>↺<br>History</b></div></div>`);
}

function invitePreview() {
  const rows = [["51 Man","5","COOKED","cooked"],["Bet Man","0","COOKED","cooked"],["Big Tester","0","COOKED","cooked"]];
  return html(`<main class="screen" style="justify-content:center"><div class="word" style="align-self:center;font-size:70px;margin-bottom:28px">FER<span>O</span></div><div class="headline" style="margin:0 0 28px;font-size:26px">Welcome to the Bloc that keeps you showing up.</div><div class="card"><div style="padding:18px;border-bottom:.5px solid rgba(22,61,54,.7)"><h2 style="margin:0 0 8px">Join Flow Seed 191851</h2><div class="label" style="color:#8FAEAA">12 WORKOUTS · 8/20 MEMBERS</div></div>${rows.map((r,i)=>`<div class="row" style="grid-template-columns:34px 1fr auto 30px"><span class="avatar" style="background:${["#5d83bd","#3E7CC3","#ad6aa0"][i]}">${r[0][0]}</span><b style="font-size:20px">${r[0]}</b><span class="tag ${r[3]}">${r[2]}</span><b style="color:#4ECDC4;font-size:20px">${r[1]}</b></div>`).join("")}</div><div class="btn" style="width:100%;margin-top:28px">Join this Bloc</div></main>`);
}

function welcomeBack() {
  return html(`<main class="screen" style="justify-content:center;text-align:center"><div class="word" style="align-self:center;font-size:74px;margin-bottom:34px">FER<span>O</span></div><h1 class="headline" style="margin:0 0 12px">Welcome back</h1><p class="helper">Sign in to get back to your Blocs, or create a new account to get started.</p><div class="btn" style="width:100%;margin-top:20px">Sign in</div><div class="btn secondary" style="width:100%;margin-top:12px">Create new account</div></main>`);
}

function deadState(title, copy) {
  return html(`<main class="screen" style="justify-content:center;text-align:center"><div class="word" style="align-self:center;font-size:74px;margin-bottom:44px">FER<span>O</span></div><h1 class="headline" style="margin:0 0 12px">${title}</h1><p class="helper">${copy}</p></main>`);
}

function emptySwitcher() {
  return html(`<main class="screen" style="justify-content:center;text-align:center"><div class="word" style="align-self:center;font-size:76px;margin-bottom:12px">FER<span>O</span></div><div class="label" style="font-size:13px;margin-bottom:70px">YOUR BLOCS</div><h1 class="headline" style="margin:0 0 12px">No Blocs yet</h1><p class="helper">Create a Bloc or join one with an invite code.</p><div class="actions" style="width:100%;margin-top:26px"><div class="btn">Create Bloc</div><div class="btn">Join Existing</div></div></main>`);
}

async function writeTestImage(filePath) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4ECDC4"/><stop offset="1" stop-color="#203A66"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><circle cx="128" cy="96" r="42" fill="#f6f7fb"/><path d="M44 235c12-58 47-86 84-86s72 28 84 86" fill="#f6f7fb"/></svg>`;
  await fs.writeFile(filePath, svg);
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
    child.on("error", reject);
  });
}

async function main() {
  await fs.rm(OUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(OUT_ROOT, { recursive: true });
  await writeTestImage(path.join(OUT_ROOT, "local-test-profile.png"));
  const allFiles = [];
  for (const flow of flows) {
    const flowDir = path.join(OUT_ROOT, flow.id);
    await fs.mkdir(flowDir, { recursive: true });
    for (const [name, markup] of flow.frames) {
      const htmlFile = path.join(flowDir, `${name}.html`);
      const pngFile = path.join(flowDir, `${name}.png`);
      await fs.writeFile(htmlFile, markup);
      if (HTML_ONLY) {
        allFiles.push({ flow: flow.id, file: htmlFile });
      } else {
        await run(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--window-size=${W},${H}`, `--screenshot=${pngFile}`, `file://${htmlFile}`]);
        allFiles.push({ flow: flow.id, file: pngFile });
        await fs.rm(htmlFile, { force: true });
      }
    }
  }
  const md = [
    "# Fero Pre-Bloc User Journey PNG Pack",
    "",
    "Generated: 2026-08-12",
    "",
    "This pack is a high-fidelity storyboard export for the approved onboarding/invite flows. It includes the optional profile-photo step using `local-test-profile.png`.",
    "",
    HTML_ONLY ? "PNG rendering was blocked in the current sandbox. Open the HTML frames in a browser, or rerun `node scripts/render-onboarding-journey-pack.mjs` from a normal local terminal to produce PNGs." : "",
    "",
    ...flows.flatMap(flow => [
      `## ${flow.title}`,
      ...allFiles.filter(item => item.flow === flow.id).map(item => `- [${path.basename(item.file)}](${path.relative(OUT_ROOT, item.file)})`),
      ""
    ])
  ].join("\n");
  await fs.writeFile(path.join(OUT_ROOT, "README.md"), md);
  console.log(`Rendered ${allFiles.length} ${HTML_ONLY ? "HTML frames" : "PNGs"} to ${OUT_ROOT}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
