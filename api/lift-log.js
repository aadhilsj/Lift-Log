const BIN_ID = "69d986cc36566621a89de1ef";
const JSONBIN_MASTER_KEY = "$2a$10$kSWJI9a9oo0zyoxJu4m03u793Cr6jq59Y9s6zyatxxNqzBFfDeoUS";
const JSONBIN_ACCESS_KEY = "$2a$10$EKPe7czcS5Yqun7TkKvz.e7sJASKZ7xL0sq9TigEY4P2M7YgVz7TS";

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
      const upstream = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: {
          "X-Master-Key": JSONBIN_MASTER_KEY,
          "X-Access-Key": JSONBIN_ACCESS_KEY
        }
      });

      const text = await upstream.text();
      if (!upstream.ok) {
        return res.status(upstream.status).send(text);
      }

      const json = JSON.parse(text);
      return res.status(200).json(json.record || {});
    }

    if (req.method === "PUT") {
      const payload = await readJson(req);
      const upstream = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": JSONBIN_MASTER_KEY,
          "X-Access-Key": JSONBIN_ACCESS_KEY
        },
        body: JSON.stringify(payload)
      });

      const text = await upstream.text();
      if (!upstream.ok) {
        return res.status(upstream.status).send(text);
      }

      return res.status(200).send(text);
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({
      error: "Lift Log sync proxy failed",
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
