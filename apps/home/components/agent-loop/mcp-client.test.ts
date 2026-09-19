// RM-099 — the transport: JSON and SSE shapes, initialize once, recorded fallback.
import { describe, expect, it, vi } from "vitest";
import { createMcpClient, parseMcpBody } from "./mcp-client";
import { runLoop } from "./run-loop";

const ok = (body: unknown, type = "application/json") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    headers: { "content-type": type },
  });

describe("parseMcpBody", () => {
  it("reads plain JSON", () => {
    expect(
      parseMcpBody('{"jsonrpc":"2.0","id":2,"result":{"a":1}}', "application/json", 2).result,
    ).toEqual({ a: 1 });
  });
  it("reads SSE-wrapped JSON and picks the matching id", () => {
    const body =
      'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":1}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":2,"result":2}\n\n';
    expect(parseMcpBody(body, "text/event-stream", 2).result).toBe(2);
  });
});

describe("createMcpClient", () => {
  it("initializes once, then sends tools/call with the exact tool and arguments", async () => {
    const bodies: { method: string; params: unknown }[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      bodies.push(body);
      return ok({
        jsonrpc: "2.0",
        id: body.id,
        result: { content: [{ type: "text", text: "hi" }] },
      });
    }) as unknown as typeof fetch;
    const client = createMcpClient({ fetchImpl });
    const a = await client.call("search", { query: "kpi" });
    await client.call("docs", { component: "Sparkline" });
    expect(bodies.map((b) => b.method)).toEqual(["initialize", "tools/call", "tools/call"]);
    expect(bodies[1]!.params).toEqual({ name: "search", arguments: { query: "kpi" } });
    expect(a.recorded).toBe(false);
  });
  it("falls back to the recorded answer when the network fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const client = createMcpClient({ fetchImpl, recorded: () => ({ from: "recording" }) });
    expect(await client.call("search", { query: "kpi" })).toEqual({
      recorded: true,
      result: { from: "recording" },
    });
  });
  it("falls back when the server does not answer within the timeout", async () => {
    const fetchImpl = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) =>
        init!.signal!.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        ),
      )) as unknown as typeof fetch;
    const client = createMcpClient({ fetchImpl, timeoutMs: 20, recorded: () => "rec" });
    expect(await client.call("docs", { component: "X" })).toEqual({
      recorded: true,
      result: "rec",
    });
  });
});

describe("runLoop", () => {
  it("runs steps in order, pending → done, each at least the 350 ms floor", async () => {
    let t = 0;
    const slept: number[] = [];
    const seen: string[] = [];
    const trace = await runLoop(
      [
        { tool: "search", args: { query: "a" } },
        { tool: "docs", args: { component: "B" } },
      ],
      { call: async (tool) => ({ recorded: tool === "docs", result: tool }) },
      {
        now: () => t,
        sleep: async (ms) => {
          slept.push(ms);
          t += ms;
        },
        onTrace: (steps) => seen.push(steps.map((s) => `${s.tool}:${s.status}`).join(",")),
      },
    );
    expect(slept).toEqual([350, 350]);
    expect(seen).toEqual([
      "search:pending",
      "search:done",
      "search:done,docs:pending",
      "search:done,docs:done",
    ]);
    expect(trace!.map((s) => s.elapsedMs)).toEqual([350, 350]);
    expect(trace![1]!.recorded).toBe(true);
  });
  it("stops when cancelled", async () => {
    const out = await runLoop(
      [{ tool: "search", args: {} }],
      { call: async () => ({ recorded: false, result: 1 }) },
      {
        sleep: async () => {},
        onTrace: () => {},
        isCancelled: () => true,
      },
    );
    expect(out).toBeNull();
  });
});
