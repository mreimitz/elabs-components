import { describe, expect, it } from "vitest";

import { discoverGraph } from "../discover-graph";
import { normalizeLog } from "../event-log";
import { extractVariants } from "../extract-variants";
import fixture from "../fixtures/order-to-cash-small.json";
import type { AnyLog } from "../event-log";
import type { EventLog } from "../types";
import { createProcessWorker, type ProcessWorkerLike } from "./create-process-worker";
import { handleProcessRequest, type ProcessWorkerResponse } from "./process-worker";

const orderToCash = fixture as EventLog;

/**
 * A stand-in for `Worker` that speaks the REAL protocol: it receives the same request
 * object `postMessage` would clone, answers it asynchronously, and delivers the answer as
 * a `{ data }` message event to the listeners the handle registered.
 *
 * This is deliberately not a spy. It exercises the message plumbing — id correlation,
 * listener registration, the `{ data }` unwrap — which is the only part of the worker path
 * that does not also run inline.
 */
class FakeWorker implements ProcessWorkerLike {
  readonly received: unknown[] = [];
  terminated = false;
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(private readonly options: { garbleFirst?: boolean } = {}) {}

  postMessage(message: unknown): void {
    this.received.push(message);
    const response = handleProcessRequest(message as Parameters<typeof handleProcessRequest>[0]);
    // A real worker answers on a later task; resolving synchronously here would hide an
    // ordering bug the moment one appeared.
    void Promise.resolve().then(() => {
      if (this.terminated) return;
      if (this.options.garbleFirst === true && this.received.length === 1) {
        // Something that is not a response at all — the handle must ignore it and stay
        // waiting rather than settling the promise with rubbish.
        this.emit("message", { data: { nonsense: true } });
      }
      this.emit("message", { data: response });
    });
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(type: "message" | "error" | "messageerror", listener: (e: unknown) => void) {
    const bucket = this.listeners.get(type);
    if (bucket === undefined) this.listeners.set(type, [listener]);
    else bucket.push(listener);
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe("createProcessWorker degrades to the calling thread", () => {
  it("runs inline in an environment with no Worker, and still answers correctly", async () => {
    // The fallback here is ENVIRONMENT-DRIVEN, not simulated: jsdom implements no `Worker`
    // constructor, so this is the same code path a server render or an embedded webview
    // takes. Asserted rather than assumed, because the whole test is vacuous otherwise.
    expect(typeof Worker).toBe("undefined");

    const handle = createProcessWorker();
    expect(handle.inline).toBe(true);
    expect(await handle.discover(orderToCash)).toEqual(discoverGraph(orderToCash));
    expect(await handle.variants(orderToCash)).toEqual(extractVariants(orderToCash));
    handle.terminate();
  });

  it("falls back when constructing the worker throws", async () => {
    let attempts = 0;
    const handle = createProcessWorker({
      createWorker: () => {
        attempts += 1;
        throw new Error("no worker here");
      },
    });
    expect(handle.inline).toBe(false); // optimistic until the first request proves otherwise
    expect(await handle.discover(orderToCash)).toEqual(discoverGraph(orderToCash));
    expect(handle.inline).toBe(true);
    expect(attempts).toBe(1);
    // Degraded for good — it does not retry the broken constructor on every call.
    expect(await handle.variants(orderToCash)).toEqual(extractVariants(orderToCash));
    expect(attempts).toBe(1);
  });

  it("falls back when postMessage throws, without losing the in-flight request", async () => {
    const handle = createProcessWorker({
      createWorker: () => ({
        postMessage() {
          throw new Error("detached");
        },
        terminate() {},
        addEventListener() {},
      }),
    });
    expect(await handle.discover(orderToCash)).toEqual(discoverGraph(orderToCash));
    expect(handle.inline).toBe(true);
  });

  it("answers a request already in flight when the worker errors", async () => {
    const silent: ProcessWorkerLike & { fail?: () => void } = {
      postMessage() {
        // Never answers — the error event is what settles this request.
      },
      terminate() {},
      addEventListener(type, listener) {
        if (type === "error") silent.fail = () => listener(new Error("worker died"));
      },
    };
    const handle = createProcessWorker({ createWorker: () => silent });
    const pending = handle.discover(orderToCash);
    silent.fail?.();
    expect(await pending).toEqual(discoverGraph(orderToCash));
    expect(handle.inline).toBe(true);
  });

  it("runs inline on request when asked to, without ever constructing a worker", async () => {
    let constructed = 0;
    const handle = createProcessWorker({
      forceInline: true,
      createWorker: () => {
        constructed += 1;
        return new FakeWorker();
      },
    });
    expect(handle.inline).toBe(true);
    await handle.discover(orderToCash);
    expect(constructed).toBe(0);
  });
});

describe("createProcessWorker over the message protocol", () => {
  it("sends the request across and resolves with the worker's answer", async () => {
    const fake = new FakeWorker();
    const handle = createProcessWorker({ createWorker: () => fake });
    const graph = await handle.discover(orderToCash);
    expect(handle.inline).toBe(false);
    expect(graph).toEqual(discoverGraph(orderToCash));
    expect(fake.received).toEqual([{ id: 1, kind: "discover", log: orderToCash }]);
  });

  it("agrees with the inline path, request for request", async () => {
    const viaWorker = createProcessWorker({ createWorker: () => new FakeWorker() });
    const viaInline = createProcessWorker({ forceInline: true });
    const options = { flowTime: "inter_start_time" } as const;

    expect(await viaWorker.discover(orderToCash, options)).toEqual(
      await viaInline.discover(orderToCash, options),
    );
    expect(await viaWorker.variants(orderToCash)).toEqual(await viaInline.variants(orderToCash));
    viaWorker.terminate();
    viaInline.terminate();
  });

  it("keeps concurrent requests apart by id", async () => {
    const fake = new FakeWorker();
    const handle = createProcessWorker({ createWorker: () => fake });
    const [graph, variants] = await Promise.all([
      handle.discover(orderToCash),
      handle.variants(orderToCash),
    ]);
    expect(graph).toEqual(discoverGraph(orderToCash));
    expect(variants).toEqual(extractVariants(orderToCash));
    expect(fake.received.map((message) => (message as { id: number }).id)).toEqual([1, 2]);
  });

  it("ignores a message that is not a response", async () => {
    const handle = createProcessWorker({
      createWorker: () => new FakeWorker({ garbleFirst: true }),
    });
    expect(await handle.discover(orderToCash)).toEqual(discoverGraph(orderToCash));
  });

  it("passes an already-normalized log through untouched", async () => {
    const normalized = normalizeLog(orderToCash);
    const fake = new FakeWorker();
    const handle = createProcessWorker({ createWorker: () => fake });
    expect(await handle.discover(normalized)).toEqual(discoverGraph(normalized));
    // The handle does not normalize, copy or reshape on the way out — `asNormalizedLog` is
    // idempotent and the log crosses `postMessage` as the caller handed it over.
    expect((fake.received[0] as { log: unknown }).log).toBe(normalized);
  });

  it("rejects when the worker reports a failure", async () => {
    const handle = createProcessWorker({ createWorker: () => new FakeWorker() });
    await expect(handle.discover({ nope: true } as unknown as AnyLog)).rejects.toThrow();
  });

  it("rejects pending and later work once terminated", async () => {
    const silent: ProcessWorkerLike = {
      postMessage() {},
      terminate() {},
      addEventListener() {},
    };
    const handle = createProcessWorker({ createWorker: () => silent });
    const pending = handle.discover(orderToCash);
    handle.terminate();
    await expect(pending).rejects.toThrow("process worker terminated");
    await expect(handle.variants(orderToCash)).rejects.toThrow("process worker terminated");
  });
});

describe("handleProcessRequest", () => {
  it("is the one function both paths run", () => {
    const response = handleProcessRequest({ id: 7, kind: "discover", log: orderToCash });
    expect(response).toEqual({
      id: 7,
      ok: true,
      kind: "discover",
      graph: discoverGraph(orderToCash),
    });
  });

  it("honours discover options", () => {
    const response = handleProcessRequest({
      id: 1,
      kind: "discover",
      log: orderToCash,
      options: { flowTime: "inter_start_time" },
    });
    expect(response).toEqual({
      id: 1,
      ok: true,
      kind: "discover",
      graph: discoverGraph(orderToCash, { flowTime: "inter_start_time" }),
    });
  });

  it("answers variants", () => {
    expect(handleProcessRequest({ id: 2, kind: "variants", log: orderToCash })).toEqual({
      id: 2,
      ok: true,
      kind: "variants",
      variants: extractVariants(orderToCash),
    });
  });

  it("turns a throw into an ok:false response rather than killing the worker", () => {
    const response = handleProcessRequest({
      id: 3,
      kind: "discover",
      log: { nope: true } as unknown as AnyLog,
    });
    expect(response.ok).toBe(false);
    expect((response as Extract<ProcessWorkerResponse, { ok: false }>).error).toBeTruthy();
    // Still answerable afterwards — the failure is per-request, not per-worker.
    expect(handleProcessRequest({ id: 4, kind: "variants", log: orderToCash }).ok).toBe(true);
  });
});
