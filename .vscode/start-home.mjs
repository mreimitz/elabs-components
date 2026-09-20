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
// - A server from THIS checkout can be broken while its static files still answer:
//   it outlived a branch switch or a `pnpm install` that regenerated apps/home/themes/,
//   and Turbopack keeps serving the failed build (`/favicon.ico` 200, `/` 500). It is
//   reused only if `/` renders; otherwise it is stopped and started fresh.
// - `pnpm dev` goes through turbo, which drops env vars. This spawns `next dev`
//   directly with an explicit port so Next never slides to 3001 behind Chrome's back.
//
// HOME_PORT overrides the port (default 3000).

import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PORT = process.env.HOME_PORT ?? "3000";
const ORIGIN = `http://localhost:${PORT}`;
// Cheap and served only once the app is up; `/` compiles for ~10 s on a cold start.
const PROBE = `${ORIGIN}/favicon.ico`;
const READY_TIMEOUT_MS = 180_000;
const POLL_MS = 300;

// Which Storybook the site's /storybook/ links and story frames show. A LOCAL dev Storybook wins
// whenever one is running — or is starting, as in the "🏠 Home + 📕 Storybook" compound, where its
// task wrapper is alive before the port is — so the site shows THIS checkout's stories instead of
// the published release, which is what made new stories look missing. An explicit STORYBOOK_ORIGIN
// always wins.
const STORYBOOK_PORT = process.env.STORYBOOK_PORT ?? "6006";
const PUBLISHED_STORYBOOK = "published";

const localStorybookComing = () => {
  try {
    const pid = execFileSync("lsof", ["-nP", `-iTCP:${STORYBOOK_PORT}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    }).trim();
    if (pid) return true;
  } catch {
    // Nothing listening, or no lsof (Windows).
  }
  try {
    // Both tasks start at once in the compound, so the wrapper exists before the port does.
    return Boolean(
      execFileSync("pgrep", ["-f", "start-storybook\\.mjs"], { encoding: "utf8" }).trim(),
    );
  } catch {
    return false;
  }
};

const storybookOrigin =
  process.env.STORYBOOK_ORIGIN ??
  (localStorybookComing() ? `http://localhost:${STORYBOOK_PORT}` : null);

// Next reads STORYBOOK_ORIGIN once, at startup, so a website server started against the OTHER
// Storybook cannot be reused — it would keep showing it. This file is how the reuse path below
// can tell which one the running server was given (`.vscode/*` is git-ignored).
const ORIGIN_STATE_FILE = resolve(".vscode/.dev-storybook-origin");
const wantedStorybook = storybookOrigin ?? PUBLISHED_STORYBOOK;
const runningStorybook = () => {
  try {
    return readFileSync(ORIGIN_STATE_FILE, "utf8").trim();
  } catch {
    return "";
  }
};

const isUp = async () => {
  try {
    const response = await fetch(PROBE);
    return response.ok;
  } catch {
    return false;
  }
};

// The page itself, not just a static file: a failed build answers 500 here.
const renders = async () => {
  try {
    const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(60_000) });
    return response.status < 500;
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Stop a broken server of ours: next-server plus the `next dev` parent that would
// otherwise respawn it. The task wrapper that started them exits with its child.
const stopServer = async (pid) => {
  const pids = [pid];
  try {
    const parent = execFileSync("ps", ["-o", "ppid=", "-p", pid], { encoding: "utf8" }).trim();
    const command = execFileSync("ps", ["-o", "command=", "-p", parent], { encoding: "utf8" });
    if (command.includes("next dev")) pids.unshift(parent);
  } catch {
    // No ps (Windows) or the parent is gone: stopping the server alone is enough.
  }
  for (const target of pids) {
    try {
      process.kill(Number(target), "SIGTERM");
    } catch {
      // Already gone.
    }
  }
  const deadline = Date.now() + 10_000;
  while (listener().pid && Date.now() < deadline) await sleep(POLL_MS);
  if (listener().pid) process.kill(Number(pid), "SIGKILL");
};

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
console.log(
  storybookOrigin
    ? `The site's /storybook/ shows the local Storybook on ${storybookOrigin}.`
    : `The site's /storybook/ shows the PUBLISHED Storybook (no local one is running).`,
);

const root = resolve(process.cwd());
const held = listener();
if (held.pid) {
  // Exact match only: worktrees live INSIDE this folder, so a prefix test would accept them.
  const ours = held.folder === root || held.folder === join(root, "apps", "home");
  if (!ours) {
    console.error(
      `Port ${PORT} is held by another process (PID ${held.pid}${held.folder ? `, running from\n  ${held.folder}` : ""}).\n` +
        `It is not this checkout's website. Stop it (kill ${held.pid}), then Run again.`,
    );
    process.exit(1);
  }
  if (runningStorybook() !== wantedStorybook) {
    console.log(
      `The website on ${ORIGIN} (PID ${held.pid}) was started against a different Storybook ` +
        `(${runningStorybook() || "unknown"}, wanted ${wantedStorybook}); restarting it.`,
    );
    await stopServer(held.pid);
  } else if ((await isUp()) && (await renders())) {
    console.log(`Reusing the website already serving ${ORIGIN}`);
    console.log(`__HOME_READY__ ${ORIGIN}`);
    // Stay alive like the cold path, so VS Code sees one consistent task shape.
    while (await isUp()) await sleep(2000);
    console.log(`The website on ${ORIGIN} went away.`);
    process.exit(0);
  } else {
    console.log(`The website on ${ORIGIN} (PID ${held.pid}) is not rendering; restarting it.`);
    await stopServer(held.pid);
  }
}

writeFileSync(ORIGIN_STATE_FILE, `${wantedStorybook}\n`);
const child = spawn("pnpm", ["--filter", "@elabs-ai/home", "exec", "next", "dev", "-p", PORT], {
  stdio: "inherit",
  env: storybookOrigin ? { ...process.env, STORYBOOK_ORIGIN: storybookOrigin } : process.env,
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
