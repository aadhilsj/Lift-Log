// A stand-in for Supabase that keeps everything on this Mac.
//
// Why this exists: every Vercel preview points SUPABASE_URL at the production
// project (docs/rollover-incident-2026-09-01.md, confirmed 2026-09-03), so a
// preview branch is not a safe place to rehearse a flow that writes member
// data. This server speaks just enough PostgREST for api/lift-log.js to run
// against a JSON file instead.
//
// What is real here and what is not:
//   real  - the blob (public.lift_log_state). Reads, writes and the revision
//           counter all behave as they do in production, because the blob is
//           the whole of what the app reads for an open month.
//   fake  - every ante_core RPC returns no rows. The app is built to treat
//           that as "no canonical data yet" and fall back to the blob, which
//           is the documented "blob wins on doubt" rule. Canonical mirroring
//           is therefore NOT exercised by this sandbox; see docs.
//
// Started for you by scripts/sandbox.mjs. Not something to run by hand.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const dataFile = process.env.SANDBOX_BLOB_FILE;
const port = Number(process.env.SANDBOX_SUPABASE_PORT || 54321);

if (!dataFile) {
  console.error("SANDBOX_BLOB_FILE is required.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(dataFile), { recursive: true });

function readRow() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      state: parsed.state || {},
      revision: Number(parsed.revision) || 0,
      updated_at: parsed.updated_at || new Date().toISOString()
    };
  } catch {
    return { state: {}, revision: 0, updated_at: new Date().toISOString() };
  }
}

function writeRow(row) {
  // Written whole and atomically: a half-written blob would look to the app
  // exactly like corrupt production data, which is a confusing thing to debug
  // in a sandbox you are only using to look at a modal.
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(row, null, 2));
  fs.renameSync(tmp, dataFile);
}

function send(res, status, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  const route = url.pathname;
  const method = (req.method || "GET").toUpperCase();

  // --- the blob ----------------------------------------------------------
  if (route === "/rest/v1/lift_log_state") {
    if (method === "GET") {
      const row = readRow();
      const select = url.searchParams.get("select") || "state,revision,updated_at";
      const projected = {};
      for (const field of select.split(",").map(part => part.trim()).filter(Boolean)) {
        if (field in row) projected[field] = row[field];
      }
      return send(res, 200, [projected]);
    }
    if (method === "PATCH" || method === "POST") {
      const body = await readBody(req);
      const incoming = Array.isArray(body) ? body[0] : body;
      if (!incoming) return send(res, 400, { message: "empty body" });
      const row = {
        state: incoming.state ?? readRow().state,
        revision: Number(incoming.revision) || 0,
        updated_at: incoming.updated_at || new Date().toISOString()
      };
      writeRow(row);
      return send(res, 200, [row]);
    }
  }

  // Backups are accepted and dropped. Keeping them would grow without bound
  // for a sandbox nobody restores from.
  if (route === "/rest/v1/lift_log_backups" && method === "POST") {
    await readBody(req);
    return send(res, 201, []);
  }

  // --- canonical ---------------------------------------------------------
  // Every ante_core RPC answers "no rows". Reads then fall back to the blob;
  // writes are accepted and discarded. This is the sandbox's one real
  // limitation and it is deliberate: reimplementing the canonical SQL in
  // JavaScript would mean testing my re-implementation rather than the app.
  if (route.startsWith("/rest/v1/rpc/")) {
    await readBody(req);
    return send(res, 200, []);
  }

  // --- storage -----------------------------------------------------------
  if (route.startsWith("/storage/v1/object/list/")) {
    await readBody(req);
    return send(res, 200, []);
  }
  if (route.startsWith("/storage/v1/")) {
    await readBody(req);
    return send(res, 200, {});
  }

  // Anything unrecognised is worth seeing rather than silently swallowing:
  // it means the app reached for something this sandbox does not model.
  console.warn(`[sandbox-supabase] unhandled ${method} ${route}`);
  return send(res, 404, { message: `sandbox: no route for ${method} ${route}` });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[sandbox-supabase] listening on http://127.0.0.1:${port}`);
  console.log(`[sandbox-supabase] blob file: ${dataFile}`);
});
