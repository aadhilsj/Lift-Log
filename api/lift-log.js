const BIN_ID = "69d986cc36566621a89de1ef";
const JSONBIN_MASTER_KEY = "$2a$10$kSWJI9a9oo0zyoxJu4m03u793Cr6jq59Y9s6zyatxxNqzBFfDeoUS";
const JSONBIN_ACCESS_KEY = "$2a$10$EKPe7czcS5Yqun7TkKvz.e7sJASKZ7xL0sq9TigEY4P2M7YgVz7TS";
const MIN_TARGET = 12;
const LEAGUE_TIME_ZONE = "Europe/Oslo";
const LEAGUE_CUTOFF_HOUR = 2;
const NAMES = ["Aadhil","Isira","Rahul","Kisal","Rishane","Deyhan","Aysha","Nishara","Abhishek"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const JOINED_MONTH_BY_NAME = { Abhishek: "2026-4" };

const STORAGE_BACKEND = process.env.STORAGE_BACKEND || (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "jsonbin");
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function normalizeState(data) {
  return {
    logs: data?.logs || {},
    excused: data?.excused || {},
    monthHistory: Array.isArray(data?.monthHistory) ? data.monthHistory : [],
    lastMonth: data?.lastMonth || null,
    meta: {
      revision: Number.isFinite(Number(data?.meta?.revision)) ? Number(data.meta.revision) : 0,
      updatedAt: data?.meta?.updatedAt || null
    }
  };
}

function getLeagueDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const year = Number(parts.find(part => part.type === "year").value);
  const month = Number(parts.find(part => part.type === "month").value);
  const day = Number(parts.find(part => part.type === "day").value);
  const hour = Number(parts.find(part => part.type === "hour").value);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (hour < LEAGUE_CUTOFF_HOUR) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function getLeagueMonthKey() {
  const today = getLeagueDateParts();
  return `${today.year}-${today.month - 1}`;
}

function compareMonthKeys(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay !== by) return ay - by;
  return am - bm;
}

function isJoinedForMonth(name, monthKey) {
  const joinedMonth = JOINED_MONTH_BY_NAME[name];
  return !joinedMonth || compareMonthKeys(monthKey, joinedMonth) >= 0;
}

function calcPenalties(activeCounts) {
  if (!activeCounts.length) return { winners: [], losers: [], perLoser: 0, totalPot: 0, perWinner: 0 };
  const sorted = [...activeCounts].sort((a, b) => b.count - a.count);
  const topCount = sorted[0].count;
  if (topCount === 0) return { winners: [], losers: [], perLoser: 0, totalPot: 0, perWinner: 0 };
  const winners = sorted.filter(user => user.count === topCount);
  const losers = activeCounts.filter(user => user.count < MIN_TARGET && user.count < topCount);
  const n = losers.length;
  const perLoser = n === 0 ? 0 : 20 + (n - 1) * 5;
  const totalPot = n * perLoser;
  const perWinner = winners.length > 0 && totalPot > 0 ? Math.floor(totalPot / winners.length) : 0;
  return { winners, losers, perLoser, totalPot, perWinner };
}

function buildDefaultSettlements(month) {
  const monthKey = month.key || `${month.year}-${month.month}`;
  const activeCounts = Object.keys(month.counts || {})
    .filter(name => isJoinedForMonth(name, monthKey))
    .filter(name => !(month.excused?.[name]))
    .map(name => ({ name, count: month.counts?.[name] || 0 }));
  const { losers } = calcPenalties(activeCounts);
  return Object.fromEntries(
    losers.map(loser => [
      loser.name,
      {
        status: "outstanding",
        settledAt: null,
        updatedAt: null
      }
    ])
  );
}

function buildMonthLogsSnapshot(logsByName) {
  return Object.fromEntries(
    NAMES.map(name => [name, [...(logsByName?.[name] || [])]])
  );
}

function rebuildMonthSnapshot(month, logsByUser) {
  const monthKey = month?.key;
  const relevantNames = NAMES.filter(name => isJoinedForMonth(name, monthKey));
  const nextLogsByUser = buildMonthLogsSnapshot(logsByUser);
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, (nextLogsByUser[name] || []).length])
  );
  const excused = month?.excused || Object.fromEntries(relevantNames.map(name => [name, false]));
  return {
    ...month,
    counts,
    excused,
    logsByUser: nextLogsByUser,
    settlements: buildDefaultSettlements({ counts, excused })
  };
}

function normalizeMonthHistory(monthHistory) {
  return (Array.isArray(monthHistory) ? monthHistory : []).map(month => ({
    ...month,
    settlements: month.settlements || buildDefaultSettlements(month)
  }));
}

function rolloverStateIfNeeded(data) {
  const base = normalizeState(data);
  const expectedKey = getLeagueMonthKey();
  if (!base.lastMonth || base.lastMonth === expectedKey) return base;

  const [ly, lm] = base.lastMonth.split("-").map(Number);
  const [cy, cm] = expectedKey.split("-").map(Number);
  const lastDate = new Date(ly, lm, 1);
  const curDate = new Date(cy, cm, 1);
  if (lastDate >= curDate) return base;

  const label = `${MONTH_NAMES[lm]} '${String(ly).slice(2)}`;
  const relevantNames = NAMES.filter(name => isJoinedForMonth(name, base.lastMonth));
  const counts = Object.fromEntries(
    relevantNames.map(name => [name, (base.logs?.[name] || []).length])
  );
  const excused = Object.fromEntries(
    relevantNames.map(name => [name, base.excused?.[name]?.[base.lastMonth] || false])
  );
  const snapshot = {
    key: base.lastMonth,
    label,
    year: ly,
    month: lm,
    counts,
    excused,
    logsByUser: buildMonthLogsSnapshot(base.logs),
    settlements: buildDefaultSettlements({ counts, excused })
  };

  return {
    logs: {},
    excused: {},
    monthHistory: [...normalizeMonthHistory(base.monthHistory), snapshot],
    lastMonth: expectedKey,
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

async function fetchCurrentState() {
  if (STORAGE_BACKEND === "supabase") {
    return await fetchCurrentStateFromSupabase();
  }
  return await fetchCurrentStateFromJsonBin();
}

async function persistState(nextState, reason) {
  if (STORAGE_BACKEND === "supabase") {
    return await persistStateToSupabase(nextState, reason);
  }
  return await persistStateToJsonBin(nextState);
}

async function fetchCurrentStateFromJsonBin() {
  const upstream = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: {
      "X-Master-Key": JSONBIN_MASTER_KEY,
      "X-Access-Key": JSONBIN_ACCESS_KEY
    }
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    const error = new Error(text || "Failed to read current state");
    error.status = upstream.status;
    throw error;
  }

  const json = JSON.parse(text);
  return rolloverStateIfNeeded(json.record || {});
}

async function persistStateToJsonBin(nextState) {
  const upstream = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_MASTER_KEY,
      "X-Access-Key": JSONBIN_ACCESS_KEY
    },
    body: JSON.stringify(nextState)
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    const error = new Error(text || "Failed to persist current state");
    error.status = upstream.status;
    throw error;
  }
  return nextState;
}

async function fetchCurrentStateFromSupabase() {
  assertSupabaseConfigured();
  const response = await supabaseFetch("/rest/v1/lift_log_state?id=eq.true&select=state", {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return rolloverStateIfNeeded({});
  }
  return rolloverStateIfNeeded(rows[0]?.state || {});
}

async function persistStateToSupabase(nextState, reason) {
  assertSupabaseConfigured();
  const safeState = normalizeState(nextState);

  await createSupabaseBackup(safeState, reason);

  const response = await supabaseFetch("/rest/v1/lift_log_state?id=eq.true", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      state: safeState,
      revision: safeState.meta.revision,
      updated_at: safeState.meta.updatedAt || new Date().toISOString()
    })
  });

  const rows = await response.json();
  if (Array.isArray(rows) && rows.length > 0) {
    return rolloverStateIfNeeded(rows[0]?.state || safeState);
  }

  await supabaseFetch("/rest/v1/lift_log_state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates"
    },
    body: JSON.stringify([{
      id: true,
      state: safeState,
      revision: safeState.meta.revision,
      updated_at: safeState.meta.updatedAt || new Date().toISOString()
    }])
  });

  return safeState;
}

async function createSupabaseBackup(state, reason) {
  const backupPayload = {
    state_revision: state.meta.revision,
    state,
    reason
  };

  await supabaseFetch("/rest/v1/lift_log_backups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(backupPayload)
  });
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(text || "Supabase request failed");
    error.status = response.status;
    throw error;
  }
  return response;
}

function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const error = new Error("Supabase backend selected but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
    error.status = 500;
    throw error;
  }
}

function mergeState(current, incoming) {
  const base = rolloverStateIfNeeded(current);
  const next = normalizeState(incoming);
  const actor = incoming?.actor || null;
  const leagueMonthKey = getLeagueMonthKey();
  const incomingMonthKey = next.lastMonth || null;

  const merged = {
    logs: { ...base.logs },
    excused: { ...base.excused },
    monthHistory: normalizeMonthHistory(base.monthHistory),
    lastMonth: actor ? base.lastMonth : (compareMonthKeys(next.lastMonth, base.lastMonth) >= 0 ? (next.lastMonth || base.lastMonth) : base.lastMonth),
    meta: {
      revision: Math.max(base.meta.revision, next.meta.revision) + 1,
      updatedAt: new Date().toISOString()
    }
  };

  if (actor) {
    if (incomingMonthKey && incomingMonthKey !== leagueMonthKey) {
      const error = new Error("Month changed. Refresh before logging.");
      error.status = 409;
      throw error;
    }
    if (next.logs && Object.prototype.hasOwnProperty.call(next.logs, actor)) {
      merged.logs[actor] = next.logs[actor] || [];
    }
    if (next.excused && Object.prototype.hasOwnProperty.call(next.excused, actor)) {
      merged.excused[actor] = next.excused[actor] || {};
    }
    if (Array.isArray(next.monthHistory) && next.monthHistory.length) {
      const nextHistory = normalizeMonthHistory(next.monthHistory);
      merged.monthHistory = merged.monthHistory.map(baseMonth => {
        const incomingMonth = nextHistory.find(month => month.key === baseMonth.key);
        if (!incomingMonth?.logsByUser || !Object.prototype.hasOwnProperty.call(incomingMonth.logsByUser, actor)) {
          return baseMonth;
        }
        return rebuildMonthSnapshot(baseMonth, {
          ...(baseMonth.logsByUser || {}),
          [actor]: incomingMonth.logsByUser[actor] || []
        });
      });
    }
  } else {
    merged.logs = next.logs;
    merged.excused = next.excused;
  }

  if (!actor && compareMonthKeys(next.lastMonth, base.lastMonth) >= 0 && (next.monthHistory.length > base.monthHistory.length || (next.lastMonth && next.lastMonth !== base.lastMonth))) {
    merged.monthHistory = normalizeMonthHistory(next.monthHistory);
  }

  return merged;
}

function applySettlementUpdate(current, payload) {
  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) {
    const error = new Error("ADMIN_PIN is not configured");
    error.status = 500;
    throw error;
  }
  if (payload?.pin !== adminPin) {
    const error = new Error("Invalid admin PIN");
    error.status = 401;
    throw error;
  }

  const base = rolloverStateIfNeeded(current);
  const monthHistory = normalizeMonthHistory(base.monthHistory);
  const monthIndex = monthHistory.findIndex(month => month.key === payload?.monthKey);
  if (monthIndex === -1) {
    const error = new Error("Month not found");
    error.status = 404;
    throw error;
  }

  const month = monthHistory[monthIndex];
  const settlements = { ...(month.settlements || buildDefaultSettlements(month)) };
  if (!Object.prototype.hasOwnProperty.call(settlements, payload?.player)) {
    const error = new Error("Settlement target is not eligible");
    error.status = 400;
    throw error;
  }

  settlements[payload.player] = {
    status: payload?.settled ? "settled" : "outstanding",
    settledAt: payload?.settled ? new Date().toISOString().slice(0, 10) : null,
    updatedAt: new Date().toISOString()
  };

  monthHistory[monthIndex] = {
    ...month,
    settlements
  };

  return {
    ...base,
    monthHistory,
    meta: {
      revision: base.meta.revision + 1,
      updatedAt: new Date().toISOString()
    }
  };
}

async function readJson(req) {
  if (typeof req.body === "object" && req.body !== null) return req.body;
  if (typeof req.body === "string" && req.body.length) return JSON.parse(req.body);

  return await new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const current = await fetchCurrentState();
      return res.status(200).json(current);
    }

    if (req.method === "PUT") {
      const payload = await readJson(req);
      const current = await fetchCurrentState();
      const merged = mergeState(current, payload);
      const persisted = await persistState(merged, payload?.actor ? `player-update:${payload.actor}` : "full-state-update");
      return res.status(200).json(persisted);
    }

    if (req.method === "POST") {
      const payload = await readJson(req);
      if (payload?.action !== "settlement") {
        return res.status(400).json({ error: "Unsupported POST action" });
      }

      const current = await fetchCurrentState();
      const updated = applySettlementUpdate(current, payload);
      const persisted = await persistState(updated, `settlement:${payload.monthKey}:${payload.player}`);
      return res.status(200).json(persisted);
    }

    res.setHeader("Allow", "GET, PUT, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: "Lift Log sync proxy failed",
      status: error?.status || 500,
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
