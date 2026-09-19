/**
 * The loop's sequencer (RM-099), framework-free so Vitest drives it without a DOM: run each
 * call in order, each step taking AT LEAST `floorMs` (350 ms — a readability floor, not motion,
 * so reduced motion keeps it), and report pending → result per step with the elapsed ms.
 */
import type { AgentLoopTransport } from "./mcp-client";
import type { AgentLoopCall } from "./prompt-map";

export const STEP_FLOOR_MS = 350;

export type TraceStep = AgentLoopCall & {
  status: "pending" | "done";
  recorded?: boolean;
  result?: unknown;
  elapsedMs?: number;
};

export type RunLoopOptions = {
  floorMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Called with the full trace after every change; the caller renders it. */
  onTrace: (trace: TraceStep[]) => void;
  /** Return `true` to stop between steps (Reset pressed, section unmounted). */
  isCancelled?: () => boolean;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runLoop(
  calls: AgentLoopCall[],
  transport: AgentLoopTransport,
  {
    floorMs = STEP_FLOOR_MS,
    now = () => performance.now(),
    sleep = defaultSleep,
    onTrace,
    isCancelled = () => false,
  }: RunLoopOptions,
): Promise<TraceStep[] | null> {
  const trace: TraceStep[] = [];
  for (const call of calls) {
    if (isCancelled()) return null;
    trace.push({ ...call, status: "pending" });
    onTrace([...trace]);
    const started = now();
    const [outcome] = await Promise.all([transport.call(call.tool, call.args), sleep(floorMs)]);
    if (isCancelled()) return null;
    trace[trace.length - 1] = {
      ...call,
      status: "done",
      recorded: outcome.recorded,
      result: outcome.result,
      elapsedMs: Math.round(now() - started),
    };
    onTrace([...trace]);
  }
  return trace;
}
