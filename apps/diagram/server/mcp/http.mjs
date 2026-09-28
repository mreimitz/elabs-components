/**
 * DG-35 — MCP Streamable HTTP on the dev server, a Connect middleware mounted at `/mcp`
 * (`server.middlewares.use("/mcp", …)` strips the prefix, so `req.url` is `/`). The pattern
 * of `packages/cli/lib/mcp-http.mjs`, for Node's req/res instead of Fetch:
 *
 *   POST /mcp   one JSON-RPC message (or a batch) → 200 `application/json`; 202, no body,
 *               when every message was a notification. Never SSE: every answer fits one
 *               response (the spec lets a server pick JSON).
 *   GET  /mcp   405 — no server-initiated stream (the spec allows 405).
 *   other       405 with `Allow: POST`.
 *
 * Stateless: no `Mcp-Session-Id` (a Vite restart would drop every session, and no tool
 * keeps per-client state). No CORS headers: `local-guard.mjs` refuses foreign origins
 * before anything runs.
 */
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import { refuseNonLocal } from "../local-guard.mjs";
import { handleMessage } from "./handler.mjs";

/** A diagram is at most 1 MB (`workspace-fs.mjs` MAX_TEXT_BYTES); JSON escaping can double it. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    req.on("end", () =>
      resolve(size > MAX_BODY_BYTES ? null : Buffer.concat(chunks).toString("utf8")),
    );
    req.on("error", reject);
  });
}

/**
 * @param {object} ctx the handler context (`tools`, `prompts`, `resources`, `bridge`, …)
 * @returns {import("vite").Connect.NextHandleFunction}
 */
export function createMcpMiddleware(ctx) {
  return (req, res) => {
    const refused = refuseNonLocal(req);
    if (refused) return send(res, 403, { error: refused });
    const path = (req.url ?? "/").split("?")[0];
    if (path !== "/") return send(res, 404, { error: "Not found." });
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" });
      return res.end();
    }
    void (async () => {
      const text = await readBody(req);
      if (text === null) {
        return send(res, 413, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Request too large" },
        });
      }
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        return send(res, 400, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        });
      }
      const batch = Array.isArray(payload);
      const messages = batch ? payload : [payload];
      if (messages.length === 0) {
        return send(res, 400, {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Invalid Request" },
        });
      }
      const responses = (
        await Promise.all(
          messages.map((m) =>
            handleMessage(m, { ...ctx, origin: new URL(`http://${req.headers.host}`).origin }),
          ),
        )
      ).filter(Boolean);
      if (responses.length === 0) {
        res.writeHead(202);
        return res.end();
      }
      return send(res, 200, batch ? responses : responses[0]);
    })().catch((e) =>
      send(res, 500, {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: e instanceof Error ? e.message : String(e) },
      }),
    );
  };
}
