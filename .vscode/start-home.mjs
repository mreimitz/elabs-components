// Wrapper behind the "dev: home" task (see tasks.json / launch.json). Same shape as
// start-storybook.mjs — read its header for why the readiness signal is ours, not
// the dev server's.
//
// Home-specific traps it handles:
// - `next dev` prints "✓ Ready" BEFORE its dev-lock check, so a second instance
//   in the same checkout prints Ready and then exits 1. Matching Next's banner would
//   attach Chrome to a dead port; this script only signals ready once the site answers.
// - A server left over from another checkout (e.g. a deleted .claude/worktrees/*)
//   still answers on the port and serves stale code. It is never reused or killed;
//   the task fails with its PID so you can stop it yourself.
// - `pnpm dev` goes through turbo, which drops env vars. This spawns `next dev`
//   directly with an explicit port so Next never slides to 3001 behind Chrome's back.
//
// HOME_PORT overrides the port (default 3000).

import { execFileSync, spawn } from "node:child_process";
import { join, resolve } from "node:path";

const PORT = process.env.HOME_PORT ?? "3000";
const ORIGIN = `http://localhost:${PORT}`;
// Cheap and served only once the app is up; `/` compiles for ~10 s on a cold start.
const PROBE = `${ORIGIN}/favicon.ico`;
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

// PID and folder of whatever listens on the port; `null` fields when it can't be told
// (no lsof, e.g. Windows).
const listener = () => {
  try {
    const pid = execFileSync("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    })
      .split("\n")[0]
      ?.trim();
    if (!pid) return { pid: null, folder: null };
    const cwdLine = execFileSync("lsof", ["-p", pid, "-a", "-d", "cwd", "-Fn"], {
      encoding: "utf8",
    })
      .split("\n")
      .find((line) => line.startsWith("n"));
    return { pid, folder: cwdLine ? resolve(cwdLine.slice(1)) : null };
  } catch {
    return { pid: null, folder: null };
  }
};

console.log(`__HOME_BOOT__ probing ${ORIGIN}`);

const root = resolve(process.cwd());
const held = listener();
if (held.pid) {
  // Exact match only: worktrees live INSIDE this folder, so a prefix test would accept them.
  const ours = held.folder === root || held.folder === join(root, "apps", "home");
  if (!ours || !(await isUp())) {
    console.error(
      `Port ${PORT} is held by another process (PID ${held.pid}${held.folder ? `, running from\n  ${held.folder}` : ""}).\n` +
        `It is not this checkout's website. Stop it (kill ${held.pid}), then Run again.`,
    );
    process.exit(1);
  }
  console.log(`Reusing the website already serving ${ORIGIN}`);
  console.log(`__HOME_READY__ ${ORIGIN}`);
  // Stay alive like the cold path, so VS Code sees one consistent task shape.
  while (await isUp()) await sleep(2000);
  console.log(`The website on ${ORIGIN} went away.`);
  process.exit(0);
}

const child = spawn("pnpm", ["--filter", "@elabs-ai/home", "exec", "next", "dev", "-p", PORT], {
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(`Could not start the website: ${error.message}`);
  process.exit(1);
});
// If next dev dies (port taken, dev lock, config error), fail the task instead of hanging.
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
    `The website did not answer on ${ORIGIN} within ${READY_TIMEOUT_MS / 1000}s. ` +
      `Run the "stop: home" task and try again.`,
  );
  child.kill();
  process.exit(1);
}

console.log(`__HOME_READY__ ${ORIGIN}`);
// Stay alive so next dev keeps streaming its log into this task terminal;
// Shift+F5 runs the "stop: home" task.
