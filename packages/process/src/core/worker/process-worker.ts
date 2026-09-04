/**
 * The worker entry point — RM-050.
 *
 * Two things live here, deliberately in one module: the PURE request handler, and the
 * `message` bootstrap that runs it inside a real worker. `createProcessWorker` imports the
 * handler for its inline path, so the code that answers on the main thread and the code
 * that answers off it are the SAME function — parity is structural, not something a test
 * has to keep true.
 *
 * The bootstrap is guarded by a real worker-scope check, so importing this module from the
 * main thread registers nothing.
 */
import { discoverGraph, type DiscoverGraphOptions } from "../discover-graph";
import type { AnyLog } from "../event-log";
import { extractVariants } from "../extract-variants";
import type { ProcessGraph, Variant } from "../types";

/** What the main thread asks the worker to compute. Structured-cloneable, by construction. */
export type ProcessWorkerRequest =
  | { id: number; kind: "discover"; log: AnyLog; options?: DiscoverGraphOptions }
  | { id: number; kind: "variants"; log: AnyLog };

/** What comes back. `ok: false` carries a message, never an `Error` (which clones poorly). */
export type ProcessWorkerResponse =
  | { id: number; ok: true; kind: "discover"; graph: ProcessGraph }
  | { id: number; ok: true; kind: "variants"; variants: Variant[] }
  | { id: number; ok: false; error: string };

/**
 * Answer one request.
 *
 * Pure and synchronous: the whole point of the worker is that this is the expensive part,
 * and moving it off the main thread is the only thing the worker adds. Throwing is
 * converted to an `ok: false` response so a bad log cannot silently kill the worker and
 * leave every later request hanging.
 */
export function handleProcessRequest(request: ProcessWorkerRequest): ProcessWorkerResponse {
  try {
    if (request.kind === "discover") {
      return {
        id: request.id,
        ok: true,
        kind: "discover",
        graph: discoverGraph(request.log, request.options ?? {}),
      };
    }
    return { id: request.id, ok: true, kind: "variants", variants: extractVariants(request.log) };
  } catch (error) {
    return { id: request.id, ok: false, error: describe(error) };
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Is this module executing INSIDE a worker?
 *
 * `self instanceof WorkerGlobalScope` is the specified test. A duck-type on `postMessage`
 * would be wrong: `window.postMessage` exists on every page, so the main thread would
 * install a listener that answers its own messages.
 */
function inWorkerScope(): boolean {
  const scope = globalThis as { WorkerGlobalScope?: new () => unknown; self?: unknown };
  const constructor = scope.WorkerGlobalScope;
  if (typeof constructor !== "function") return false;
  return scope.self instanceof constructor;
}

if (inWorkerScope()) {
  const scope = self as unknown as {
    addEventListener: (type: "message", listener: (event: MessageEvent) => void) => void;
    postMessage: (message: unknown) => void;
  };
  scope.addEventListener("message", (event: MessageEvent) => {
    scope.postMessage(handleProcessRequest(event.data as ProcessWorkerRequest));
  });
}
