#!/usr/bin/env node
/**
 * measure-command.mjs — time a command honestly.
 *
 * The rule this file exists to enforce: **never compare a single cold run to a
 * single warm run.** That comparison is the most common way a performance claim
 * turns out to be measuring a filesystem cache. So every measurement here does
 * warmup runs, repeats, and reports the SPREAD alongside the central value —
 * and `baseline.mjs#compare` refuses to call a delta inside that spread an
 * improvement.
 *
 * Command classes (references/safety-model.md): timing a build or a test suite
 * is *potentially expensive*, so the caller must announce it, and every run is
 * bounded by a timeout and a captured-output cap.
 *
 * Usage:
 *   node measure-command.mjs --cmd "pnpm test" [--root <dir>] [--reps 3]
 *                            [--warmup 1] [--timeout 300] [--label test]
 * Zero dependencies. Node >= 22.
 */

import { spawnSync } from "node:child_process";
import { findRepoRoot, loadConfig } from "./config.mjs";
import { redact } from "./redact.mjs";

/** @param {number[]} xs */
function stats(xs) {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const variance = sorted.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  return {
    runs: n,
    meanMs: Math.round(mean),
    medianMs: Math.round(median),
    minMs: sorted[0],
    maxMs: sorted[n - 1],
    stdDevMs: Math.round(Math.sqrt(variance)),
    spreadMs: sorted[n - 1] - sorted[0],
  };
}

/**
 * @param {string} command
 * @param {{ root?: string, reps?: number, warmup?: number, timeoutSeconds?: number,
 *           maxOutputKb?: number, label?: string, env?: Record<string,string> }} [opts]
 */
export function measureCommand(command, opts = {}) {
  const root = opts.root ?? findRepoRoot();
  const { config } = loadConfig(root);
  const reps = opts.reps ?? config.performance?.repetitions ?? 3;
  const warmup = opts.warmup ?? config.performance?.warmup_runs ?? 1;
  const timeout = (opts.timeoutSeconds ?? config.limits?.command_timeout_seconds ?? 300) * 1000;
  const maxOutput = (opts.maxOutputKb ?? config.limits?.max_command_output_kb ?? 512) * 1024;

  /** @type {number[]} */
  const durations = [];
  /** @type {{ phase: string, ms: number, exitCode: number | null, timedOut: boolean }[]} */
  const runs = [];
  let lastStderrTail = "";
  let lastExit = null;
  let anyFailure = false;
  let anyTimeout = false;

  const once = (phase) => {
    const started = process.hrtime.bigint();
    const res = spawnSync(command, {
      cwd: root,
      shell: true,
      encoding: "utf8",
      timeout,
      maxBuffer: maxOutput,
      env: { ...process.env, ...(opts.env ?? {}), CI: "1" },
    });
    const ms = Number((process.hrtime.bigint() - started) / 1000000n);
    const timedOut = res.error?.code === "ETIMEDOUT" || res.signal === "SIGTERM";
    if (timedOut) anyTimeout = true;
    if (res.status !== 0) anyFailure = true;
    lastExit = res.status;
    // Keep only the shortest decisive line, never the whole log.
    const stderr = (res.stderr ?? "").split("\n").filter(Boolean);
    lastStderrTail = redact(stderr.slice(-3).join(" | ").slice(0, 400));
    runs.push({ phase, ms, exitCode: res.status, timedOut });
    return ms;
  };

  for (let i = 0; i < warmup; i++) once("warmup");
  for (let i = 0; i < reps; i++) durations.push(once("measure"));

  const summary = stats(durations);
  const unstable =
    summary !== null && summary.meanMs > 0 && summary.spreadMs / summary.meanMs > 0.25;

  return {
    schema: "repo-cleanup/measurement@1",
    label: opts.label ?? command,
    command: redact(command),
    root,
    environment: {
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      cpus: globalThis.navigator?.hardwareConcurrency ?? null,
    },
    warmupRuns: warmup,
    ...summary,
    runs,
    exitCode: lastExit,
    succeeded: !anyFailure && !anyTimeout,
    timedOut: anyTimeout,
    stderrTail: anyFailure || anyTimeout ? lastStderrTail : null,
    cacheState: warmup > 0 ? "warm (warmup runs executed first)" : "UNKNOWN — no warmup run",
    stability: unstable
      ? "UNSTABLE — spread exceeds 25% of the mean; treat any delta smaller than the spread as no effect"
      : "stable",
    caveats: [
      warmup === 0 ? "no warmup run: the first measured run may include cold caches" : null,
      anyFailure
        ? "at least one run exited non-zero — timings of a failing command measure the failure path"
        : null,
      anyTimeout ? `at least one run hit the ${timeout / 1000}s timeout and was killed` : null,
      "wall-clock on a shared developer machine; other load is not controlled for",
    ].filter(Boolean),
  };
}

/** Convert a measurement into a baseline metric (see baseline.mjs). */
export function metricFromMeasurement(m) {
  return {
    key: `perf.${m.label}`,
    value: m.medianMs,
    unit: "ms",
    method: `measure-command.mjs — median of ${m.runs?.filter((r) => r.phase === "measure").length ?? 0} runs after ${m.warmupRuns} warmup`,
    exact: true,
    spread: m.spreadMs,
    higherIsBetter: false,
    note: m.stability,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n) => {
    const i = process.argv.indexOf(n);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const cmd = arg("--cmd");
  if (!cmd) {
    process.stderr.write('measure-command.mjs: --cmd "<command>" is required\n');
    process.exit(2);
  }
  const out = measureCommand(cmd, {
    root: arg("--root"),
    reps: arg("--reps") ? Number(arg("--reps")) : undefined,
    warmup: arg("--warmup") ? Number(arg("--warmup")) : undefined,
    timeoutSeconds: arg("--timeout") ? Number(arg("--timeout")) : undefined,
    label: arg("--label"),
  });
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
