// Wrapper behind the "dev: diagram" task (see tasks.json / launch.json). Same shape as
// start-storybook.mjs — read its header for why the readiness signal is ours, not
// the dev server's.
//
// Diagram-specific traps it handles:
// - It runs the app's own `dev` script (copy the themes, then Vite on :5180 with
//   --strictPort), so Vite never slides to another port behind Chrome's back; a taken
//   port fails the task instead.
// - Agents run this app in their .claude/worktrees/* copies too. A server on :5180 from
//   another checkout serves THAT branch's app, so it is never reused or killed; the task
//   fails with its folder and PID so you can stop it yourself.

import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";

const PORT = "5180"; // apps/diagram/package.json `dev`
const ORIGIN = `http://localhost:${PORT}`;
// Vite's own client module: only a Vite dev server answers it, so some other app
// holding the port never passes as ready.
const PROBE = `${ORIGIN}/@vite/client`;
const READY_TIMEOUT_MS = 120_000;
const POLL_MS = 300;
const ROOT = resolve(process.cwd());
const APP = resolve(ROOT, "apps", "diagram");

const isUp = async () => {
  try {
    const response = await fetch(PROBE);
    return response.ok;
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = (cmd, args) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8" }).trim();
  } catch {
    return ""; // Nothing matched, or the tool is missing (e.g. no lsof/pgrep on Windows).
  }
};

const serverPid = () => run("lsof", ["-nP", `-iTCP:${PORT}`, "-sTCP:LISTEN", "-t"]).split("\n")[0];

// Which folder the server on the port runs from; `null` when it can't be told (no lsof),
// and then reuse stays the fallback.
const serverFolder = (pid) => {
  if (!pid) return null;
  const cwdLine = run("lsof", ["-p", pid, "-a", "-d", "cwd", "-Fn"])
    .split("\n")
    .find((line) => line.startsWith("n"));
  return cwdLine ? resolve(cwdLine.slice(1)) : null;
};

console.log(`__DIAGRAM_BOOT__ probing ${ORIGIN}`);

// A debug Restart (or Stop, then Run) starts this while the previous session's
// "stop: diagram" is still running; wait for it — see the header of .vscode/stop-app.mjs.
const stopDeadline = Date.now() + 15_000;
while (run("pgrep", ["-f", "stop-app\\.mjs.*diagram:"]) && Date.now() < stopDeadline) {
  await sleep(POLL_MS);
}

if (await isUp()) {
  const pid = serverPid();
  const folder = serverFolder(pid);
  // Exact match only: worktrees live INSIDE this folder, so a prefix test would accept them.
  if (folder && folder !== ROOT && folder !== APP) {
    console.error(
      `The diagram app on ${ORIGIN} (PID ${pid}) runs from another checkout:\n  ${folder}\n` +
        `It shows that checkout's code, not this folder's. Stop it where it was started ` +
        `(or \`kill ${pid}\`), then Run again.`,
    );
    process.exit(1);
  }
  console.log(`Reusing the diagram app already serving ${ORIGIN}`);
  console.log(`__DIAGRAM_READY__ ${ORIGIN}`);
  // Stay alive while it is up, like the cold path — see start-storybook.mjs for why a
  // background task that exits at once races the debug launch.
  while (await isUp()) await sleep(2000);
  console.log(`The diagram app on ${ORIGIN} went away.`);
  process.exit(0);
}

const child = spawn("pnpm", ["run", "dev"], { cwd: APP, stdio: "inherit" });
child.on("error", (error) => {
  console.error(`Could not start the diagram app: ${error.message}`);
  process.exit(1);
});
// If Vite dies (port taken, config error), fail the task instead of hanging.
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
    `The diagram app did not answer on ${ORIGIN} within ${READY_TIMEOUT_MS / 1000}s. ` +
      `Free the port (run the "stop: diagram" task) and try again.`,
  );
  child.kill();
  process.exit(1);
}

console.log(`__DIAGRAM_READY__ ${ORIGIN}`);
// Stay alive so Vite keeps streaming its log into this task terminal;
// Shift+F5 runs the "stop: diagram" task, which frees the port.
