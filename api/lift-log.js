const BIN_ID = "69d986cc36566621a89de1ef";
const JSONBIN_MASTER_KEY = "$2a$10$kSWJI9a9oo0zyoxJu4m03u793Cr6jq59Y9s6zyatxxNqzBFfDeoUS";
const JSONBIN_ACCESS_KEY = "$2a$10$EKPe7czcS5Yqun7TkKvz.e7sJASKZ7xL0sq9TigEY4P2M7YgVz7TS";
const MIN_TARGET = 12;

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

function calcPenalties(activeCounts) {
  if (!activeCounts.length) return { winners: [], losers: [], perLoser: 0, totalPot: 0, perWinner: 0 };
  const sorted = [...activeCounts].sort((a, b) => b.count - a.count);
  const topCount = sorted[0].count;
  if (topCount === 0) return { winners: [], losers: [], perLoser: 0, totalPot: 0, perWinner: 0 };
  const winners = sorted.filter(u => u.count === topCount);
  const losers = activeCounts.filter(u => u.count < MIN_TARGET && u.count < topCount);
  const n = losers.length;
  const perLoser = n === 0 ? 0 : 20 + (n - 1) * 5;
  const totalPot = n * perLoser;
  const perWinner = winners.length > 0 && totalPot > 0 ? Math.floor(totalPot / winners.length) : 0;
  return { winners, losers, perLoser, totalPot, perWinner };
}

function buildDefaultSettlements(month) {
  const activeCounts = Object.keys(month.counts || {})
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

function normalizeMonthHistory(monthHistory) {
  return (Array.isArray(monthHistory) ? monthHistory : []).map(month => ({
    ...month,
    settlements: month.settlements || buildDefaultSettlements(month)
  }));
}

async function fetchCurrentState() {
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
  return normalizeState(json.record || {});
}

function mergeState(current, incoming) {
  const base = normalizeState(current);
  const next = normalizeState(incoming);
  const actor = incoming?.actor || null;

  const merged = {
    logs: { ...base.logs },
    excused: { ...base.excused },
    monthHistory: normalizeMonthHistory(base.monthHistory),
    lastMonth: next.lastMonth || base.lastMonth,
    meta: {
      revision: Math.max(base.meta.revision, next.meta.revision) + 1,
      updatedAt: new Date().toISOString()
    }
  };

  if (actor) {
    if (next.logs && Object.prototype.hasOwnProperty.call(next.logs, actor)) {
      merged.logs[actor] = next.logs[actor] || [];
    }
    if (next.excused && Object.prototype.hasOwnProperty.call(next.excused, actor)) {
      merged.excused[actor] = next.excused[actor] || {};
    }
  } else {
    merged.logs = next.logs;
    merged.excused = next.excused;
  }

  if (next.monthHistory.length > base.monthHistory.length || (next.lastMonth && next.lastMonth !== base.lastMonth)) {
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

  const base = normalizeState(current);
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
      const upstream = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": JSONBIN_MASTER_KEY,
          "X-Access-Key": JSONBIN_ACCESS_KEY
        },
        body: JSON.stringify(merged)
      });

      const text = await upstream.text();
      if (!upstream.ok) {
        return res.status(upstream.status).send(text);
      }

      return res.status(200).json(merged);
    }

    if (req.method === "POST") {
      const payload = await readJson(req);
      if (payload?.action !== "settlement") {
        return res.status(400).json({ error: "Unsupported POST action" });
      }

      const current = await fetchCurrentState();
      const updated = applySettlementUpdate(current, payload);
      const upstream = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": JSONBIN_MASTER_KEY,
          "X-Access-Key": JSONBIN_ACCESS_KEY
        },
        body: JSON.stringify(updated)
      });

      const text = await upstream.text();
      if (!upstream.ok) {
        return res.status(upstream.status).send(text);
      }

      return res.status(200).json(updated);
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
