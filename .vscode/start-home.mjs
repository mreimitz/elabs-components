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
import { ensureCopy, serveCopy } from "./storybook-copy.mjs";

const PORT = process.env.HOME_PORT ?? "3000";
const ORIGIN = `http://localhost:${PORT}`;
// Cheap and served only once the app is up; `/` compiles for ~10 s on a cold start.
const PROBE = `${ORIGIN}/favicon.ico`;
const READY_TIMEOUT_MS = 180_000;
const POLL_MS = 300;

// Which Storybook the site's /storybook/ links and story frames show: a packaged copy of THIS
// checkout's stories, built when stale and served on STORYBOOK_COPY_PORT (default 6007) — see
// .vscode/storybook-copy.mjs for why not the dev Storybook. An explicit STORYBOOK_ORIGIN always
// wins: https://storybook.elabs-ai.com for the published release, http://localhost:6006 for the
// dev Storybook (live edits, but slow pages).
const COPY_PORT = process.env.STORYBOOK_COPY_PORT ?? "6007";
const COPY_ORIGIN = `http://localhost:${COPY_PORT}`;
const storybookOrigin = process.env.STORYBOOK_ORIGIN ?? COPY_ORIGIN;
const usesCopy = storybookOrigin === COPY_ORIGIN;

// Next reads STORYBOOK_ORIGIN once, at startup, so a website server started against ANOTHER
// Storybook cannot be reused — it would keep showing it. This file is how the reuse path below
// can tell which one the running server was given (`.vscode/*` is git-ignored).
const ORIGIN_STATE_FILE = resolve(".vscode/.dev-storybook-origin");
const wantedStorybook = storybookOrigin;
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
const listener = (port = PORT) => {
  try {
    const pid = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
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

// A debug Restart (or Stop, then Run) starts this while the previous session's "stop: home"
// is still running; anything found on the port now is about to be killed. Wait for that stop
// to finish first — see the header of .vscode/stop-app.mjs.
const stopInFlight = () => {
  try {
    return Boolean(
      execFileSync("pgrep", ["-f", "stop-app\\.mjs.*home:"], { encoding: "utf8" }).trim(),
    );
  } catch {
    return false; // Nothing matched, or no pgrep (Windows).
  }
};
const stopDeadline = Date.now() + 15_000;
while (stopInFlight() && Date.now() < stopDeadline) await sleep(POLL_MS);
console.log(
  usesCopy
    ? `The site's examples come from the packaged Storybook copy on ${COPY_ORIGIN}.`
    : `The site's examples come from ${storybookOrigin} (STORYBOOK_ORIGIN).`,
);

const root = resolve(process.cwd());

// The copy is served and (re)built alongside the website's own start-up; READY waits for both.
// The build runs in its own process group, so however this wrapper ends ("stop: home" kills it,
// or next dev exits) it must stop that group itself or the build runs on unowned.
let build = null;
process.on("exit", () => {
  if (build && build.exitCode === null) {
    try {
      process.kill(-build.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
});
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, () => process.exit(1));
const startCopy = async () => {
  try {
    await serveCopy(COPY_PORT);
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    // Another wrapper from THIS checkout already serves the same folder; anything else does not.
    const held = listener(COPY_PORT);
    if (held.folder && held.folder !== root) {
      console.error(
        `Port ${COPY_PORT} is held by another process (PID ${held.pid}, running from\n  ${held.folder}).\n` +
          `The website's examples need it for the packaged Storybook copy. Stop it (kill ${held.pid}), ` +
          `or set STORYBOOK_COPY_PORT, then Run again.`,
      );
      process.exit(1);
    }
  }
  await ensureCopy({ onChild: (child) => (build = child) });
};
const copyReady = usesCopy
  ? startCopy().catch((error) =>
      console.error(`Could not serve the Storybook copy: ${error.message}`),
    )
  : Promise.resolve();

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
    await copyReady;
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
  env: { ...process.env, STORYBOOK_ORIGIN: storybookOrigin },
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

// Chrome opens on READY; before the copy is in place every example would say "unavailable".
await copyReady;
console.log(`__HOME_READY__ ${ORIGIN}`);
// Stay alive so next dev keeps streaming its log into this task terminal;
// Shift+F5 runs the "stop: home" task.
