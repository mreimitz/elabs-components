// DIAGNOSTICS ONLY (throwaway branch). Logs, per browser tab, when each story file starts and
// ends and the tab's JS heap at those moments, to line up with per-process memory samples.
import { afterAll, beforeAll } from "vitest";

type Top = Window & { __leakTab?: string };

const log = (phase: string, file: string) => {
  const top = window.top as Top;
  top.__leakTab ??= Math.random().toString(36).slice(2, 6);
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  console.log(
    `LEAKPROBE ${JSON.stringify({
      phase,
      tab: top.__leakTab,
      at: Date.now(),
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : -1,
      file: file.replace(/^.*\/(packages|apps|registry)\//, "$1/"),
    })}`,
  );
};

beforeAll((suite) => log("start", (suite as { filepath?: string }).filepath ?? suite.name));
afterAll((suite) => log("end", (suite as { filepath?: string }).filepath ?? suite.name));
