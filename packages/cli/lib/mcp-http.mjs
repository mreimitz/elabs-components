/**
 * brand-ui MCP over Streamable HTTP — the hosted twin of `brand-ui mcp` (stdio).
 *
 * A stateless, dependency-free Web `Request` → `Response` handler around the same
 * pure `handleMessage` the stdio server uses, so any runtime with the Fetch API
 * (a Vercel function, Node's `http` via a shim, Deno, Bun) can serve it:
 *
 *   POST  one JSON-RPC message or a batch → 200 `application/json`, or 202 with
 *         no body when every message was a notification.
 *   GET   405 — this server never opens a server-initiated SSE stream.
 *   OPTIONS 204 with permissive CORS, so browser-based MCP clients can connect.
 *
 * No `Mcp-Session-Id`: every request carries everything the tools need, and the
 * manifest is injected once at startup. `hosted` defaults to true, which drops the
 * tools that read the caller's disk (`audit`) — see LOCAL_ONLY_TOOLS in mcp.mjs.
 */
import { handleMessage } from "./mcp.mjs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

/**
 * Build a Fetch-API handler for the brand-ui MCP server.
 * @param {{ manifest?: object|null, root?: string|null, hosted?: boolean }} [opts]
 * @returns {(request: Request) => Promise<Response>}
 */
export function createMcpHttpHandler({ manifest = null, root = null, hosted = true } = {}) {
  const opts = { manifest, root, hosted };
  return async function handleMcpHttp(request) {
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "POST")
      return new Response(null, {
        status: 405,
        headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" },
      });

    let payload;
    try {
      payload = JSON.parse(await request.text());
    } catch {
      return json(
        { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
        400,
      );
    }

    const batch = Array.isArray(payload);
    const messages = batch ? payload : [payload];
    if (messages.length === 0)
      return json(
        { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
        400,
      );

    const responses = messages.map((msg) => handleMessage(msg, opts)).filter(Boolean);
    if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });
    return json(batch ? responses : responses[0]);
  };
}
