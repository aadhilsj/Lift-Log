const BIN_ID = "69d986cc36566621a89de1ef";
const JSONBIN_MASTER_KEY = "$2a$10$kSWJI9a9oo0zyoxJu4m03u793Cr6jq59Y9s6zyatxxNqzBFfDeoUS";
const JSONBIN_ACCESS_KEY = "$2a$10$EKPe7czcS5Yqun7TkKvz.e7sJASKZ7xL0sq9TigEY4P2M7YgVz7TS";

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
    monthHistory: base.monthHistory,
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
    merged.monthHistory = next.monthHistory;
  }

  return merged;
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

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: "Lift Log sync proxy failed",
      status: error?.status || 500,
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
