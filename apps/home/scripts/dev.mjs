#!/usr/bin/env node
/**
 * dev.mjs — `pnpm --filter @elabs-ai/home dev`: the site plus the newest Storybook it can find.
 *
 * Every live example on the site is a Storybook story embedded through the `/storybook/` rewrite.
 * The deployed Storybook only moves on a release, so a working tree that is ahead of it shows
 * "ships with the next Storybook release" for every story the release does not have. This
 * runner closes that gap locally:
 *
 *   1. It reads which story ids the site embeds (content/generated/catalog-pages.json).
 *   2. It counts how many of them the local static build (apps/docs/storybook-static) has and
 *      how many the deployed Storybook has, and serves whichever is missing fewer.
 *   3. It starts `next dev` with `STORYBOOK_ORIGIN` pointing at that choice.
 *
 * A STATIC build, not `storybook dev`: the dev server loads its modules by root-absolute URL
 * (`/@vite/client`, `/virtual:…`), which cannot sit behind the `/storybook/` sub-path.
 *
 *   node scripts/dev.mjs                    start the site (extra args go to `next dev`)
 *   node scripts/dev.mjs --build-stories    rebuild the local Storybook first (a few minutes)
 *   node scripts/dev.mjs --stories-only     rebuild the local Storybook and exit
 *
 * `STORYBOOK_ORIGIN=<url>` set by the caller always wins and skips all of the above.
 * `pickOrigin` and `createStaticServer` are exported for the unit test.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");
const REPO = join(APP, "..", "..");
const STATIC_DIR = join(REPO, "apps", "docs", "storybook-static");
const DEPLOYED = "https://storybook.elabs-ai.com";
const FIRST_PORT = 6106;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".pbf": "application/x-protobuf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** Every story id the site embeds, with the pre-retitle id that may stand in for it. */
export function embeddedStories(appDir = APP) {
  const generated = join(appDir, "content", "generated");
  const pages = JSON.parse(readFileSync(join(generated, "catalog-pages.json"), "utf8"));
  const aliases = JSON.parse(readFileSync(join(generated, "story-aliases.json"), "utf8"));
  const ids = new Set();
  for (const page of Object.values(pages))
    for (const story of page.stories ?? []) ids.add(story.id);
  return [...ids].map((id) => ({ id, alias: aliases[id] ?? null }));
}

/** How many embedded stories an index (`Set` of ids, or `null` when unreachable) lacks. */
export function countMissing(stories, ids) {
  if (!ids) return stories.length;
  return stories.filter((s) => !ids.has(s.id) && !(s.alias && ids.has(s.alias))).length;
}

/**
 * Local build or deployed Storybook: whichever lacks fewer embedded stories; a tie goes to the
 * local build (it works offline and matches the working tree's themes).
 */
export function pickOrigin({ stories, localIds, deployedIds }) {
  const local = localIds ? countMissing(stories, localIds) : null;
  const deployed = deployedIds ? countMissing(stories, deployedIds) : null;
  const useLocal = local !== null && (deployed === null || local <= deployed);
  return { use: useLocal ? "local" : "deployed", local, deployed, total: stories.length };
}

function idsOf(json) {
  return json?.entries ? new Set(Object.keys(json.entries)) : null;
}

function localIndex() {
  const file = join(STATIC_DIR, "index.json");
  if (!existsSync(file)) return null;
  try {
    return { ids: idsOf(JSON.parse(readFileSync(file, "utf8"))), builtAt: statSync(file).mtime };
  } catch {
    return null;
  }
}

async function deployedIndex() {
  try {
    const res = await fetch(`${DEPLOYED}/index.json`, { signal: AbortSignal.timeout(5000) });
    return res.ok ? idsOf(await res.json()) : null;
  } catch {
    return null;
  }
}

/** A small static file server for a Storybook build (GET/HEAD only, no directory listing). */
export function createStaticServer(root) {
  return createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (statSync(file).isDirectory()) file = join(file, "index.html");
      const stat = statSync(file);
      res.writeHead(200, {
        "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
        "content-length": stat.size,
        "cache-control": "no-cache",
      });
      if (req.method === "HEAD") res.end();
      else createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    }
  });
}

function listen(server, port, attempts = 20) {
  return new Promise((resolve, reject) => {
    const tryPort = (p, left) => {
      server.once("error", (error) => {
        if (error.code === "EADDRINUSE" && left > 0) tryPort(p + 1, left - 1);
        else reject(error);
      });
      server.listen(p, "127.0.0.1", () => resolve(p));
    };
    tryPort(port, attempts);
  });
}

/** Run a pnpm command to completion; `shell` so `pnpm.cmd` resolves on Windows. */
function run(args, env) {
  return new Promise((resolve) => {
    const child = spawn("pnpm", args, { cwd: REPO, env, stdio: "inherit", shell: true });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function buildStories() {
  console.log("\n  Storybook  building the local copy (this takes a few minutes)…\n");
  const env = { ...process.env, NODE_OPTIONS: "--max-old-space-size=6144" };
  const code = await run(
    ["--filter", "@elabs-ai/components-docs", "exec", "storybook", "build"],
    env,
  );
  if (code !== 0) {
    console.error("\n  Storybook  the build failed; the site will use the deployed Storybook.\n");
  }
  return code === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const take = (flag) => {
    const at = args.indexOf(flag);
    if (at === -1) return false;
    args.splice(at, 1);
    return true;
  };
  const storiesOnly = take("--stories-only");
  const build = take("--build-stories") || storiesOnly;

  let origin = process.env.STORYBOOK_ORIGIN;
  let server = null;

  if (origin && !storiesOnly) {
    console.log(`\n  Storybook  ${origin} (STORYBOOK_ORIGIN)\n`);
  } else {
    if (build) {
      const ok = await buildStories();
      if (storiesOnly) process.exit(ok ? 0 : 1);
    }
    const stories = embeddedStories();
    const local = localIndex();
    const choice = pickOrigin({
      stories,
      localIds: local?.ids ?? null,
      deployedIds: await deployedIndex(),
    });
    const of = (n) => `${n} of ${choice.total} live examples missing`;
    if (choice.use === "local") {
      server = createStaticServer(STATIC_DIR);
      const port = await listen(server, FIRST_PORT);
      origin = `http://127.0.0.1:${port}`;
      console.log(
        `\n  Storybook  local build from ${local.builtAt.toLocaleString()} — ${of(choice.local)}`,
      );
    } else {
      origin = DEPLOYED;
      console.log(
        `\n  Storybook  deployed release — ${choice.deployed === null ? "not reachable" : of(choice.deployed)}`,
      );
      if (choice.local !== null) console.log(`             (local build: ${of(choice.local)})`);
    }
    const missing = choice.use === "local" ? choice.local : choice.deployed;
    if (missing) {
      console.log(
        "             Stories newer than that Storybook show a notice instead of a preview.\n" +
          "             To build them now:  pnpm site:stories   (then start the site again)",
      );
    }
    console.log("");
  }

  const next = spawn("pnpm", ["exec", "next", "dev", ...(args.length ? args : ["-p", "3000"])], {
    cwd: APP,
    env: { ...process.env, STORYBOOK_ORIGIN: origin },
    stdio: "inherit",
    shell: true,
  });
  const stop = () => {
    server?.close();
    if (!next.killed) next.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.on("exit", (code) => {
    server?.close();
    process.exit(code ?? 0);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  await main();
}
