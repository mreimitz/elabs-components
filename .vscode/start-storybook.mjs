// Wrapper behind the "dev: storybook" task (see tasks.json / launch.json).
//
// Why this exists instead of running `pnpm storybook` directly: the debug profile
// needs a RELIABLE "the server is up" signal. Sniffing Storybook's own banner with
// a background problemMatcher is fragile — Storybook 10 prints
// "Storybook ready!" / "- Local: …" / "N ms for manager and M ms for preview", and
// any beginsPattern that also matches a line printed AFTER the ready banner re-arms
// the matcher, so the task never goes inactive and F5 hangs on
// "Waiting for preLaunchTask 'dev: storybook'…".
//
// So the readiness signal is ours, not Storybook's: this script prints
// __STORYBOOK_BOOT__ once at the start and __STORYBOOK_READY__ exactly once, when
// http://localhost:6006/index.json actually answers. tasks.json matches only those
// two markers, so the handshake no longer depends on Storybook's output format.
//
// It also makes F5 idempotent: `storybook dev` runs with --exact-port and EXITS 1
// when :6006 is taken (a leftover server, or one a Claude agent started), printing
// no banner at all. Rather than fail, reuse the server that is already answering.

import { spawn } from "node:child_process";

const ORIGIN = "http://localhost:6006";
const PROBE = `${ORIGIN}/index.json`;
const READY_TIMEOUT_MS = 180_000;
const POLL_MS = 300;

const isUp = async () => {
  try {
    const response = await fetch(PROBE);
    return response.ok;
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log(`__STORYBOOK_BOOT__ probing ${ORIGIN}`);

if (await isUp()) {
  console.log(`Reusing the Storybook already serving ${ORIGIN}`);
  console.log(`__STORYBOOK_READY__ ${ORIGIN}`);
  // Deliberately do NOT exit here. A background task that ends immediately makes VS Code
  // race its own "task is ready" bookkeeping against the debug launch; keeping this
  // process alive makes the reuse path behave exactly like the cold path (a task that
  // runs until the server goes away), so the debug session sees one consistent shape.
  while (await isUp()) await sleep(2000);
  console.log(`Storybook on ${ORIGIN} went away.`);
  process.exit(0);
}

const child = spawn("pnpm", ["storybook"], { stdio: "inherit" });
child.on("error", (error) => {
  console.error(`Could not start Storybook: ${error.message}`);
  process.exit(1);
});
// If Storybook dies (port taken, build error), fail the task instead of hanging.
child.on("exit", (code) => process.exit(code ?? 1));

const deadline = Date.now() + READY_TIMEOUT_MS;
let ready = false;
while (Date.now() < deadline) {
  await sleep(POLL_MS);
  if (await isUp()) {
    ready = true;
    break;
  }
}

if (!ready) {
  console.error(
    `Storybook did not answer on ${ORIGIN} within ${READY_TIMEOUT_MS / 1000}s. ` +
      `Free the port (run the "stop: storybook" task) and try again.`,
  );
  child.kill();
  process.exit(1);
}

console.log(`__STORYBOOK_READY__ ${ORIGIN}`);
// Stay alive so the dev server keeps streaming its log into this task terminal;
// Shift+F5 runs the "stop: storybook" task, which frees the port.
