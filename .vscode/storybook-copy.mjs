// The website's live examples in the debug profile come from a PACKAGED copy of this checkout's
// Storybook (`storybook build`), served by start-home.mjs on :6007 — not from the dev Storybook.
//
// Why not the dev Storybook on :6006: Vite serves every story frame as ~645 unbundled modules and
// makes the browser revalidate each one per frame, so a component page with 30 examples issued
// ~18,000 requests (each through apps/home/proxy.ts) and took 20–30 s to fill in a plain browser,
// far longer with the debugger attached. The packaged copy is what the live site embeds and
// fills the same page in a few seconds. The trade: a story edit reaches the website on the next
// debug start; the Storybook window (dev server, hot reload) still shows it immediately.
//
// A build takes ~1.5 min, so it is skipped when nothing the copy is built from has changed since
// the last one (`ensureCopy`).

import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(process.cwd());
export const COPY_DIR = join(ROOT, ".vscode/.storybook-copy");
// Built next to the live copy and swapped in only on success, so a failed build leaves the
// previous copy serving and a half-written one is never served.
const NEXT_DIR = `${COPY_DIR}.next`;
const STAMP = ".inputs-mtime";

// What `storybook build` reads (apps/docs/.storybook/main.ts): the docs app, every package's
// source (stories are co-located, and packages resolve to src/ inside the workspace), the
// registry blocks behind the `@/components` alias, and the installed dependencies.
const INPUTS = [
  "apps/docs",
  "registry/blocks",
  "pnpm-lock.yaml",
  ...readdirSync(join(ROOT, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => [`packages/${entry.name}/src`, `packages/${entry.name}/package.json`]),
];
const SKIP = new Set(["node_modules", "storybook-static", "dist", ".turbo", "coverage"]);

// Newest mtime under the inputs. Directories count too: deleting a file only touches its folder.
const newestInput = () => {
  let newest = 0;
  const walk = (path) => {
    let stat;
    try {
      stat = statSync(path);
    } catch {
      return; // Gone, or a package without that entry.
    }
    newest = Math.max(newest, stat.mtimeMs);
    if (!stat.isDirectory()) return;
    for (const name of readdirSync(path)) if (!SKIP.has(name)) walk(join(path, name));
  };
  for (const input of INPUTS) walk(join(ROOT, input));
  return newest;
};

const builtFrom = () => {
  try {
    return Number(readFileSync(join(COPY_DIR, STAMP), "utf8"));
  } catch {
    return 0;
  }
};

export const hasCopy = () => existsSync(join(COPY_DIR, "index.json"));

/**
 * Build the copy unless it is current. Resolves `true` when a current copy is in place, `false`
 * when the build failed (the previous copy, if any, keeps serving). `onChild` receives the build
 * process so the caller can stop it on shutdown.
 */
export const ensureCopy = async ({ onChild } = {}) => {
  // Read BEFORE building: an edit made while the build runs must count as newer next time.
  const inputs = newestInput();
  if (hasCopy() && builtFrom() >= inputs) {
    console.log(
      "The website's examples use the packaged Storybook copy (up to date, no build needed).",
    );
    return true;
  }
  console.log(
    "Packaging this checkout's Storybook for the website's examples (about 1.5 min; skipped next time if nothing changed)…",
  );
  const started = Date.now();
  rmSync(NEXT_DIR, { recursive: true, force: true });
  const code = await new Promise((done) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@elabs-ai/components-docs",
        "run",
        "build",
        "--output-dir",
        NEXT_DIR,
        "--quiet",
      ],
      // Own process group, so stopping the task can stop pnpm AND the storybook build under it.
      { stdio: "inherit", detached: true },
    );
    onChild?.(child);
    child.on("error", () => done(1));
    child.on("exit", (exitCode) => done(exitCode ?? 1));
  });
  if (code !== 0 || !existsSync(join(NEXT_DIR, "index.json"))) {
    console.error(
      hasCopy()
        ? "The Storybook build failed; the website keeps showing the previous packaged copy."
        : "The Storybook build failed and there is no earlier copy: the website's examples will say they are unavailable. Fix the build (`pnpm --filter @elabs-ai/components-docs build`), then restart.",
    );
    return false;
  }
  writeFileSync(join(NEXT_DIR, STAMP), String(inputs));
  rmSync(COPY_DIR, { recursive: true, force: true });
  renameSync(NEXT_DIR, COPY_DIR);
  console.log(`Packaged the Storybook copy in ${Math.round((Date.now() - started) / 1000)} s.`);
  return true;
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
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
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
};

/**
 * Serve COPY_DIR on `port`. Resolves once listening; rejects with EADDRINUSE if the port is taken.
 * Revalidation (Last-Modified → 304) keeps the ~90 files a story frame needs off the wire after
 * the first frame; Range requests let the media stories seek.
 */
export const serveCopy = (port) =>
  new Promise((ready, fail) => {
    const server = createServer((request, response) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url ?? "/", "http://copy").pathname);
      } catch {
        response.writeHead(400).end(); // A malformed %-escape must not take the server down.
        return;
      }
      let file = normalize(join(COPY_DIR, pathname));
      if (file !== COPY_DIR && !file.startsWith(COPY_DIR + sep)) {
        response.writeHead(403).end();
        return;
      }
      let stat;
      try {
        stat = statSync(file);
        if (stat.isDirectory()) {
          file = join(file, "index.html");
          stat = statSync(file);
        }
      } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      const modified = new Date(Math.floor(stat.mtimeMs / 1000) * 1000);
      const headers = {
        "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
        "Last-Modified": modified.toUTCString(),
        "Accept-Ranges": "bytes",
      };
      const since = Date.parse(request.headers["if-modified-since"] ?? "");
      if (!Number.isNaN(since) && modified.getTime() <= since) {
        response.writeHead(304, headers).end();
        return;
      }
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
        const end =
          range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
        if (start > end || start >= stat.size) {
          response.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Length": end - start + 1,
        });
        if (request.method === "HEAD") return void response.end();
        createReadStream(file, { start, end }).pipe(response);
        return;
      }
      response.writeHead(200, { ...headers, "Content-Length": stat.size });
      if (request.method === "HEAD") return void response.end();
      createReadStream(file).pipe(response);
    });
    server.once("error", fail);
    // "localhost", not 127.0.0.1: the website's server reaches the copy as http://localhost:…,
    // and Node may resolve that to ::1 first. Listening on the same name keeps both on one stack.
    server.listen(Number(port), "localhost", () => ready(server));
  });
