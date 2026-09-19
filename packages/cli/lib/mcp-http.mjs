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
 *
 * `siteOrigin` is where this instance's own URLs point (story links, `info`'s
 * `endpoints`): the explicit option wins, then the `SITE_ORIGIN` env var, then
 * mcp.mjs's production default — so a preview deployment (no fixed domain yet,
 * ADR 0038 §3) reports itself instead of always naming production (RM-100).
 *
 * `siteRoutes` (default false) opts those URLs into the `/storybook/` + `/r` forms —
 * only for a caller whose site actually serves them. `https://elabs-ai.com` is still the
 * Storybook project until RM-105 moves the domain: it has no `/storybook/` and no `/r`, so
 * every instance defaults to the links that work there today (`/?path=…`, the published
 * registry). `apps/home/app/mcp/route.ts` passes `siteRoutes: true` for its own real routes.
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
 * @param {{ manifest?: object|null, root?: string|null, hosted?: boolean, siteOrigin?: string, siteRoutes?: boolean }} [opts]
 * @returns {(request: Request) => Promise<Response>}
 */
export function createMcpHttpHandler({
  manifest = null,
  root = null,
  hosted = true,
  // `process` is absent on some Fetch-API runtimes (the module doc's Deno/Bun
  // case) — never reference it unguarded at the top level.
  siteOrigin = (typeof process !== "undefined" && process.env?.SITE_ORIGIN) || undefined,
  siteRoutes = false,
} = {}) {
  const opts = { manifest, root, hosted, siteOrigin, siteRoutes };
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
