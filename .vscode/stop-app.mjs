// Backs the "stop: home" / "stop: storybook" / "stop: all apps" tasks (see tasks.json).
// Usage: node .vscode/stop-app.mjs home:3000 [storybook:6006 …]
//
// For each <name>:<port> it kills the task wrapper (.vscode/start-<name>.mjs) AND the server
// listening on the port, then WAITS until the port is free before exiting.
//
// Why not `npx --yes kill-port`: npx checks the registry on every run, so it took ~14 s even
// when cached. A debug Restart (or Stop, then Run) starts the next launch's "dev: *" task
// while that stop is still in flight: the new wrapper found the OLD server still answering,
// reused it and opened Chrome on it, and the late kill-port then shot it down — the page
// never loaded ("[vite] server connection lost" in the Storybook tab). This script returns
// only once the port is free, and the start wrappers wait for it to exit before probing.

import { execFileSync } from "node:child_process";

const WAIT_MS = 10_000;
const POLL_MS = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8" }).trim();
  } catch {
    return ""; // Nothing matched (pgrep/lsof exit 1), or the tool is missing.
  }
};

const hasLsof = Boolean(run("which", ["lsof"]));
const listeners = (port) =>
  run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])
    .split("\n")
    .filter(Boolean);

const kill = (pid, signal) => {
  try {
    process.kill(Number(pid), signal);
  } catch {
    // Already gone.
  }
};

const stop = async (name, port) => {
  if (!hasLsof) {
    // No lsof (e.g. Windows): fall back to the slow, portable path.
    run("npx", ["--yes", "kill-port", port]);
    return;
  }

  for (const pid of listeners(port)) {
    // `next dev` respawns its next-server child, so stop the parent too (same as
    // stopServer in start-home.mjs).
    const parent = run("ps", ["-o", "ppid=", "-p", pid]);
    if (parent && run("ps", ["-o", "command=", "-p", parent]).includes("next dev")) {
      kill(parent, "SIGTERM");
    }
    kill(pid, "SIGTERM");
  }

  const deadline = Date.now() + WAIT_MS;
  while (listeners(port).length && Date.now() < deadline) await sleep(POLL_MS);
  for (const pid of listeners(port)) kill(pid, "SIGKILL");
  while (listeners(port).length && Date.now() < deadline + 2_000) await sleep(POLL_MS);

  console.log(
    listeners(port).length
      ? `Port ${port} (${name}) is STILL held.`
      : `Stopped ${name} (:${port}).`,
  );
};

const targets = process.argv.slice(2).map((arg) => arg.split(":"));
if (!targets.length || targets.some(([name, port]) => !name || !port)) {
  console.error("Usage: node .vscode/stop-app.mjs <name>:<port> [<name>:<port> …]");
  process.exit(1);
}
// Every wrapper FIRST, before any (slow, ~0.2 s each) lsof: a wrapper the next launch starts
// while this runs must not be caught by a late pkill. The start wrappers wait for this
// script to exit before they look at the port (waitForStop in start-*.mjs).
for (const [name] of targets) run("pkill", ["-f", `start-${name}\\.mjs`]);
await Promise.all(targets.map(([name, port]) => stop(name, port)));
