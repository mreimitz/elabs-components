/**
 * DG-21 — `atlasWorkspace()`: the Vite dev-server plugin that is Atlas's whole backend (plan
 * V5; the app is dev-only). It mounts `/api/workspace/*` on the dev server's Connect stack and
 * streams file changes over SSE. Every file operation is `workspace-fs.mjs`; this file only
 * speaks HTTP. Localhost only (Vite's default host), no auth (plan §9.1).
 *
 * Routes (JSON errors `{ error, code? }` with 400 / 404 / 409 / 413 / 500):
 *   GET  /api/workspace/tree                     → { folders, files }
 *   GET  /api/workspace/file?path=               → the raw text, header `X-Workspace-Mtime`
 *   PUT  /api/workspace/file?path=[&overwrite=1|&base=<mtime>|&create=1]  body: text
 *                                                → { path, mtime, size }
 *   POST /api/workspace/mkdir   { path }         → { path }
 *   POST /api/workspace/move    { from, to, overwrite? } → { from, to }
 *   POST /api/workspace/trash   { path }         → { path, trashedTo }
 *   POST /api/workspace/thumb   { path, png }    → { path, size }  (png: a base64 data URL)
 *   GET  /api/workspace/versions?path=           → { versions: [{ sha, date, subject }] }
 *   GET  /api/workspace/version?path=&sha=       → the raw text at that commit
 *   GET  /api/workspace/events                   → SSE, `data: { type, path, mtime? }`
 */
import { Buffer } from "node:buffer";
import { clearInterval, clearTimeout, setInterval, setTimeout } from "node:timers";
import { promises as fs } from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { refuseNonLocal } from "./local-guard.mjs";
import * as workspace from "./workspace-fs.mjs";

/** The watcher's burst window: an atomic write is several events for one path. */
const DEBOUNCE_MS = 100;
/** A comment line keeps idle SSE connections open through anything that times them out. */
const KEEPALIVE_MS = 25_000;
/** JSON bodies: a thumbnail is the largest (base64 is 4/3 of its bytes). */
const MAX_JSON_BYTES = Math.ceil((workspace.MAX_THUMB_BYTES * 4) / 3) + 64 * 1024;

const CONTENT_TYPES = {
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
};

function send(res, status, body, headers = {}) {
  const json = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, {
    "Content-Type": json ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(json ? JSON.stringify(body) : body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= limit) chunks.push(chunk);
    });
    req.on("end", () => {
      if (size > limit) reject(new workspace.WorkspaceError(413, "The request body is too large."));
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

async function readJson(req) {
  try {
    const body = JSON.parse(await readBody(req, MAX_JSON_BYTES));
    if (body && typeof body === "object") return body;
  } catch (error) {
    if (error instanceof workspace.WorkspaceError) throw error;
  }
  throw new workspace.WorkspaceError(400, "The body must be a JSON object.");
}

function fail(res, error) {
  if (error instanceof workspace.WorkspaceError) {
    send(res, error.status, { error: error.message, ...error.extra });
  } else if (error?.code === "ENOENT") {
    send(res, 404, { error: "Not found." });
  } else {
    send(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

/** One SSE hub: the watcher's events, debounced per path, fanned out to every client. */
function createEvents(watcher) {
  const clients = new Set();
  const pending = new Map();

  function broadcast(event) {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of clients) res.write(frame);
  }

  /** One burst for one path: `first` and `last` are the watcher's event names. */
  async function flush(rel, { first, last }) {
    pending.delete(rel);
    if (last === "addDir" || last === "unlinkDir") {
      broadcast({ type: last, path: rel });
      return;
    }
    const stat = await fs.stat(path.join(workspace.ROOT, ...rel.split("/"))).catch(() => null);
    if (!stat?.isFile()) {
      broadcast({ type: "unlink", path: rel });
      return;
    }
    // A new file is `add` (then usually `change`); an atomic rename over a file can read as
    // unlink + add, but the file was there before: `change`.
    broadcast({ type: first === "add" ? "add" : "change", path: rel, mtime: stat.mtimeMs });
  }

  const listeners = ["add", "change", "unlink", "addDir", "unlinkDir"].map((type) => {
    const listener = (abs) => {
      const rel = workspace.relOf(abs);
      if (rel === null) return;
      const entry = pending.get(rel) ?? { first: type, last: type, timer: undefined };
      entry.last = type;
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => void flush(rel, entry), DEBOUNCE_MS);
      pending.set(rel, entry);
    };
    watcher.on(type, listener);
    return [type, listener];
  });

  return {
    connect(req, res) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      res.write("retry: 2000\n: connected\n\n");
      clients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), KEEPALIVE_MS);
      req.on("close", () => {
        clearInterval(ping);
        clients.delete(res);
      });
    },
    close() {
      for (const [type, listener] of listeners) watcher.off(type, listener);
      for (const { timer } of pending.values()) clearTimeout(timer);
      for (const res of clients) res.end();
      clients.clear();
    },
  };
}

function flag(value) {
  return value === "1" || value === "true";
}

async function route(req, res, url, events) {
  const at = url.searchParams.get("path");
  switch (`${req.method} ${url.pathname}`) {
    case "GET /tree":
      return send(res, 200, await workspace.list());
    case "GET /file": {
      const file = await workspace.read(at);
      const type =
        CONTENT_TYPES[path.extname(file.path).toLowerCase()] ?? "text/plain; charset=utf-8";
      // A thumbnail is binary: send the bytes, never a UTF-8 round trip of them.
      return send(res, 200, type === "image/png" ? file.bytes : file.text, {
        "Content-Type": type,
        "X-Workspace-Mtime": String(file.mtime),
      });
    }
    case "PUT /file": {
      const text = await readBody(req, workspace.MAX_TEXT_BYTES);
      const baseParam = url.searchParams.get("base");
      const base = baseParam === null ? null : Number(baseParam);
      if (base !== null && !Number.isFinite(base)) {
        throw new workspace.WorkspaceError(400, "base must be an mtime (a number).");
      }
      const overwrite = flag(url.searchParams.get("overwrite"));
      const exclusive = flag(url.searchParams.get("create"));
      return send(res, 200, await workspace.write(at, text, { overwrite, base, exclusive }));
    }
    case "POST /mkdir":
      return send(res, 200, await workspace.mkdir((await readJson(req)).path));
    case "POST /move": {
      const body = await readJson(req);
      return send(
        res,
        200,
        await workspace.move(body.from, body.to, { overwrite: body.overwrite === true }),
      );
    }
    case "POST /trash":
      return send(res, 200, await workspace.trash((await readJson(req)).path));
    case "POST /thumb": {
      const body = await readJson(req);
      return send(res, 200, await workspace.writeThumb(body.path, body.png));
    }
    case "GET /versions":
      return send(res, 200, { versions: await workspace.versions(at) });
    case "GET /version":
      return send(res, 200, await workspace.readVersion(at, url.searchParams.get("sha")), {
        "Content-Type": "text/yaml; charset=utf-8",
      });
    case "GET /events":
      return events.connect(req, res);
    default:
      return send(res, 404, { error: `No route ${req.method} /api/workspace${url.pathname}.` });
  }
}

/** @returns {import("vite").Plugin} */
export function atlasWorkspace() {
  return {
    name: "atlas-workspace",
    apply: "serve",
    configureServer(server) {
      // Vite already watches its root (the app); adding ROOT makes the dependency explicit.
      server.watcher.add(workspace.ROOT);
      const events = createEvents(server.watcher);
      server.httpServer?.once("close", () => events.close());
      server.middlewares.use("/api/workspace", (req, res) => {
        // Plugin middleware runs before Vite's host check and CORS (local-guard.mjs): without
        // this, any web page open in the browser could write, move or trash workspace files.
        const refused = refuseNonLocal(req);
        if (refused) return send(res, 403, { error: refused });
        const url = new URL(req.url ?? "/", "http://localhost");
        route(req, res, url, events).catch((error) => fail(res, error));
      });
    },
    // Workspace files are documents, not modules: a `?raw` import of one (the store's seed,
    // `src/state/diagram-store.ts`) must not hot-reload the page on every autosave. The app
    // hears about changes over `/api/workspace/events` instead.
    handleHotUpdate({ file }) {
      if (file.startsWith(workspace.ROOT + path.sep)) return [];
    },
  };
}
