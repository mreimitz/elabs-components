/**
 * Off-thread discovery — RM-050.
 *
 * Discovering a graph from a raw log is O(events) with a couple of hash lookups per event;
 * on a 200 000-row import that is long enough to drop frames, and a dropped frame during a
 * file import is exactly the moment an app reads as broken. So the derivation moves to a
 * worker — but ONLY as an optimization: the caller never branches on the environment.
 *
 * **Degrade, never fail.** When there is no `Worker` (a server render, a Node test, an
 * embedded webview), when constructing one throws, or when a live one errors, the same
 * functions run inline on the calling thread and the promise still resolves with the same
 * answer. `handleProcessRequest` is literally shared with the worker entry, so "the inline
 * path agrees with the worker path" is a property of the code, not of a test.
 *
 * **Normalize once.** Every method takes an `AnyLog`; hand it an already-normalized log
 * (`asNormalizedLog`) and neither side re-parses. A `NormalizedLog` is plain data and
 * clones across `postMessage` unchanged.
 */
import type { DiscoverGraphOptions } from "../discover-graph";
import type { AnyLog } from "../event-log";
import type { ProcessGraph, Variant } from "../types";
import {
  handleProcessRequest,
  type ProcessWorkerRequest,
  type ProcessWorkerResponse,
} from "./process-worker";

/**
 * The slice of the `Worker` interface this module uses.
 *
 * Narrow on purpose: it is the seam a test (or a bundler with its own worker construction)
 * substitutes, and demanding the full DOM `Worker` surface for that would be pointless
 * ceremony. A real `Worker` satisfies it.
 */
export interface ProcessWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(
    type: "message" | "error" | "messageerror",
    listener: (event: unknown) => void,
  ): void;
}

/** Options for {@link createProcessWorker}. */
export interface CreateProcessWorkerOptions {
  /** Skip the worker entirely and run inline. Useful for benchmarks and for tests. */
  forceInline?: boolean;
  /**
   * Build the worker yourself.
   *
   * The default construction is
   * `new Worker(new URL("./process-worker.ts", import.meta.url), { type: "module" })`,
   * which Vite and webpack rewrite at build time. A bundler that does not — or a host that
   * needs its own URL — supplies this instead. Throwing from it is safe: the handle falls
   * back to the inline path.
   */
  createWorker?: () => ProcessWorkerLike;
}

/** What {@link createProcessWorker} hands back. */
export interface ProcessWorkerHandle {
  /** Discover a directly-follows graph. */
  discover(log: AnyLog, options?: DiscoverGraphOptions): Promise<ProcessGraph>;
  /** Group the log's cases into variants. */
  variants(log: AnyLog): Promise<Variant[]>;
  /** Stop the worker. Pending promises reject, and so does every later call. */
  terminate(): void;
  /**
   * `true` when work is currently running on the CALLING thread — either because the
   * environment has no worker, or because one failed and the handle degraded.
   */
  readonly inline: boolean;
}

interface Pending {
  request: ProcessWorkerRequest;
  settle: (response: ProcessWorkerResponse) => void;
}

function workerConstructible(): boolean {
  return typeof Worker !== "undefined" && typeof URL !== "undefined";
}

/**
 * Create a handle that computes off-thread when it can and inline when it cannot.
 *
 * The worker is created LAZILY, on the first request, so constructing a handle costs
 * nothing in an environment that never uses it.
 */
export function createProcessWorker(options: CreateProcessWorkerOptions = {}): ProcessWorkerHandle {
  const construct = options.createWorker;
  let inline = options.forceInline === true || (construct === undefined && !workerConstructible());
  let terminated = false;
  let worker: ProcessWorkerLike | undefined;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  /** Give up on the worker and answer everything outstanding on this thread. */
  function degrade(): void {
    inline = true;
    const stale = [...pending.values()];
    pending.clear();
    if (worker !== undefined) {
      const dying = worker;
      worker = undefined;
      try {
        dying.terminate();
      } catch {
        // A worker that cannot be terminated is already gone; nothing to recover.
      }
    }
    for (const entry of stale) entry.settle(handleProcessRequest(entry.request));
  }

  function onMessage(event: unknown): void {
    const response = (event as { data?: unknown }).data as ProcessWorkerResponse | undefined;
    if (response === undefined || typeof response.id !== "number") return;
    const entry = pending.get(response.id);
    if (entry === undefined) return;
    pending.delete(response.id);
    entry.settle(response);
  }

  function ensureWorker(): ProcessWorkerLike | undefined {
    if (inline || terminated) return undefined;
    if (worker !== undefined) return worker;
    try {
      worker =
        construct === undefined
          ? (new Worker(new URL("./process-worker.ts", import.meta.url), {
              type: "module",
            }) as unknown as ProcessWorkerLike)
          : construct();
    } catch {
      degrade();
      return undefined;
    }
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", degrade);
    worker.addEventListener("messageerror", degrade);
    return worker;
  }

  function send(build: (id: number) => ProcessWorkerRequest): Promise<ProcessWorkerResponse> {
    if (terminated) return Promise.reject(new Error("process worker terminated"));
    nextId += 1;
    const request = build(nextId);
    const active = ensureWorker();
    if (active === undefined) {
      // Inline, but still a microtask later, so the caller's own frame returns first.
      return Promise.resolve().then(() => handleProcessRequest(request));
    }
    return new Promise<ProcessWorkerResponse>((resolve, reject) => {
      pending.set(request.id, { request, settle: resolve });
      try {
        active.postMessage(request);
      } catch {
        pending.delete(request.id);
        degrade();
        try {
          resolve(handleProcessRequest(request));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  }

  function unwrap<T>(response: ProcessWorkerResponse, read: (ok: ProcessWorkerResponse) => T): T {
    if (!response.ok) throw new Error(response.error);
    return read(response);
  }

  return {
    async discover(log, discoverOptions) {
      const response = await send((id) =>
        discoverOptions === undefined
          ? { id, kind: "discover", log }
          : { id, kind: "discover", log, options: discoverOptions },
      );
      return unwrap(response, (ok) => (ok as { graph: ProcessGraph }).graph);
    },
    async variants(log) {
      const response = await send((id) => ({ id, kind: "variants", log }));
      return unwrap(response, (ok) => (ok as { variants: Variant[] }).variants);
    },
    terminate() {
      terminated = true;
      const stale = [...pending.values()];
      pending.clear();
      for (const entry of stale) {
        entry.settle({ id: entry.request.id, ok: false, error: "process worker terminated" });
      }
      if (worker !== undefined) {
        const dying = worker;
        worker = undefined;
        try {
          dying.terminate();
        } catch {
          // Already gone.
        }
      }
    },
    get inline(): boolean {
      return inline;
    },
  };
}
