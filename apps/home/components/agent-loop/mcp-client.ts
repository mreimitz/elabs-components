/**
 * mcp-client.ts — the ONLY code in the agent loop that fetches (RM-099, wave-3 ruling 2).
 *
 * Minimal JSON-RPC over `fetch` to the same origin's `/mcp` (Streamable HTTP): `initialize`
 * once per client, then `tools/call`. The server may answer with plain JSON or with the SSE
 * wrapping (`event: message` / `data: {…}`) — both are parsed. Every request has a 4 s timeout.
 * On ANY failure (network, blocked, timeout, HTTP error, JSON-RPC error) the call resolves with
 * the recorded answer from `agent-loop-recorded.json` and `recorded: true`, so the UI can badge
 * the card instead of breaking. No model is ever called (D5): this is a lookup server.
 */
import { findRecorded } from "./prompt-map";

export type McpCallOutcome = { recorded: boolean; result: unknown };
export type AgentLoopTransport = {
  call(tool: string, args: Record<string, unknown>): Promise<McpCallOutcome>;
};

export type McpClientOptions = {
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Where a failed call's answer comes from; defaults to the generated recorded responses. */
  recorded?: (tool: string, args: unknown) => unknown;
};

export const MCP_PROTOCOL_VERSION = "2025-06-18";

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { message: string };
};

/** Parse a Streamable-HTTP response body: plain JSON, or SSE `data:` lines carrying JSON. */
export function parseMcpBody(
  body: string,
  contentType: string | null,
  id: number,
): JsonRpcResponse {
  if ((contentType ?? "").includes("text/event-stream")) {
    const messages = body
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .map((data) => JSON.parse(data) as JsonRpcResponse);
    const match = messages.find((m) => m.id === id) ?? messages.at(-1);
    if (!match) throw new Error("empty event stream");
    return match;
  }
  return JSON.parse(body) as JsonRpcResponse;
}

export function createMcpClient({
  endpoint = "/mcp",
  timeoutMs = 4000,
  fetchImpl,
  recorded = findRecorded,
}: McpClientOptions = {}): AgentLoopTransport {
  let nextId = 1;
  let initialized: Promise<void> | null = null;
  const doFetch = (...args: Parameters<typeof fetch>) => (fetchImpl ?? fetch)(...args);

  async function rpc(method: string, params: unknown): Promise<unknown> {
    const id = nextId++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const message = parseMcpBody(await res.text(), res.headers.get("content-type"), id);
      if (message.error) throw new Error(message.error.message);
      return message.result;
    } finally {
      clearTimeout(timer);
    }
  }

  function ensureInitialized(): Promise<void> {
    initialized ??= rpc("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "elabs-ai.com agent loop", version: "1" },
    }).then(
      () => undefined,
      (err: unknown) => {
        initialized = null; // retry on the next run: a proxy blip must not pin the page offline
        throw err;
      },
    );
    return initialized;
  }

  return {
    async call(tool, args) {
      try {
        await ensureInitialized();
        const result = await rpc("tools/call", { name: tool, arguments: args });
        return { recorded: false, result };
      } catch {
        return { recorded: true, result: recorded(tool, args) };
      }
    },
  };
}
