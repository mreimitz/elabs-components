/**
 * DG-21 — the Atlas workspace on disk (plan V5, V6, §3, §9.1–9.2). Node ESM, no HTTP: the Vite dev middleware (`workspace-plugin.mjs`) and, later, the MCP
 * server (DG-35, plan §11) call the same functions, so both get the same safety.
 *
 * Safety rules, enforced here and nowhere else:
 * - every path is relative to `ROOT`; `..`, absolute paths and symlinks that resolve outside
 *   `ROOT` are refused with a 400 (`safe`);
 * - nothing is ever removed: `trash` moves to `_trash/<timestamp>-<name>` (git-ignored);
 * - `write` and `move` never replace an existing file with different content unless the call
 *   says so (`overwrite`, or `base` = the mtime the caller last saw);
 * - writes are atomic: a dot-named `.tmp` file beside the target, then `rename`.
 */
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import process from "node:process";
import { isAlias, isScalar, parseDocument } from "yaml";

const run = promisify(execFile);

/** The workspace folder: `apps/diagram/workspace`. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../workspace");
/** Where `trash` moves things. Git-ignored (`apps/diagram/.gitignore`). */
export const TRASH = "_trash";
/** Where a reusable diagram naturally lives (`ref: ws/components/…`); it cannot be moved or trashed. */
export const COMPONENTS = "components";
/** A diagram's text; the same cap as the app's share links (`io/share-url.ts`). */
export const MAX_TEXT_BYTES = 1_000_000;
/** A thumbnail PNG (a small raster: a few dozen KB; the cap only refuses a runaway). */
export const MAX_THUMB_BYTES = 1_000_000;

const DIAGRAM_FILE = /\.ya?ml$/i;
const THUMB_SUFFIX = ".thumb.png";
const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA = /^[0-9a-f]{7,40}$/i;

/** A refusal with an HTTP status; `extra` is merged into the JSON error body. */
export class WorkspaceError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {Record<string, unknown>} [extra]
   */
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const refuse = (message) => new WorkspaceError(400, message);
const notFound = (rel) => new WorkspaceError(404, `Not found: ${rel}`);

/** `examples/a.yaml` → `examples/a.thumb.png`. */
export function thumbPathOf(rel) {
  return rel.replace(DIAGRAM_FILE, THUMB_SUFFIX);
}

/** Read the top-level string title using the same YAML rules as the editor. Invalid or
 * non-string titles fall back to the file name; never expose raw block-scalar syntax. */
export function titleOf(text) {
  try {
    const doc = parseDocument(text);
    if (doc.errors.length > 0) return null;
    const node = doc.get("title", true);
    // Resolve a single scalar alias without expanding collections. Cycles, unresolved aliases
    // and alias-heavy collections cannot trigger recursive expansion in this metadata read.
    const title = isAlias(node) ? node.resolve(doc) : node;
    return isScalar(title) && typeof title.value === "string" ? title.value.trim() || null : null;
  } catch {
    return null;
  }
}

let realRoot;
async function rootReal() {
  realRoot ??= await fs.realpath(ROOT);
  return realRoot;
}

async function statOrNull(abs) {
  try {
    return await fs.stat(abs);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

/**
 * Resolve a workspace-relative path. Refuses (400) a non-string, NUL, an absolute path, any
 * `..` segment, and a path whose deepest existing ancestor is a symlink resolving outside ROOT.
 * @param {unknown} rel
 * @param {{ allowRoot?: boolean }} [options]
 * @returns {Promise<{ abs: string, rel: string }>}
 */
export async function safe(rel, { allowRoot = false } = {}) {
  if (typeof rel !== "string") throw refuse("A path is required.");
  if (rel.includes("\0")) throw refuse("The path contains a NUL character.");
  const slashed = rel.replace(/\\/g, "/");
  if (path.isAbsolute(rel) || slashed.startsWith("/") || /^[a-zA-Z]:/.test(slashed)) {
    throw refuse("Absolute paths are not allowed.");
  }
  const parts = slashed.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.includes("..")) throw refuse("'..' is not allowed in a workspace path.");
  if (parts.length === 0 && !allowRoot) throw refuse("A path is required.");
  const abs = path.join(ROOT, ...parts);
  const root = await rootReal();
  for (let probe = abs; ; probe = path.dirname(probe)) {
    let real;
    try {
      real = await fs.realpath(probe);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
      if (path.dirname(probe) === probe) break;
      continue;
    }
    if (real !== root && !real.startsWith(root + path.sep)) {
      throw refuse("The path leaves the workspace.");
    }
    break;
  }
  return { abs, rel: parts.join("/") };
}

/**
 * An absolute path the watcher reported → its workspace path, or `null` when it is outside
 * ROOT, ROOT itself, inside `_trash/`, or a dotfile (atomic-write temp files, `.gitkeep`).
 */
export function relOf(abs) {
  const rel = path.relative(ROOT, abs);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const parts = rel.split(path.sep);
  if (parts[0] === TRASH || parts.some((part) => part.startsWith("."))) return null;
  return parts.join("/");
}

function refuseTrash(rel) {
  if (rel.split("/")[0] === TRASH) throw refuse(`Nothing is written into ${TRASH}/ directly.`);
}

/** Write through a temp file and a rename. DG-24's `catalog-fs.mjs` writes with it too. */
export async function atomicWrite(abs, text) {
  const tmp = path.join(
    path.dirname(abs),
    `.${path.basename(abs)}.${process.pid}.${Date.now()}.tmp`,
  );
  await fs.writeFile(tmp, text, "utf8");
  await fs.rename(tmp, abs);
}

/**
 * Every folder and diagram, sorted; `_trash/`, dotfiles and symlinks are skipped.
 * @returns {Promise<{ folders: string[], files: Array<{ path: string, title: string | null,
 *   kind: "diagram" | "component", mtime: number, size: number, hasThumb: boolean }> }>}
 */
export async function list() {
  const folders = [];
  const files = [];
  async function walk(dirAbs, dirRel) {
    const entries = (await fs.readdir(dirAbs, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const names = new Set(entries.map((entry) => entry.name));
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
      const abs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        if (rel === TRASH) continue;
        folders.push(rel);
        await walk(abs, rel);
      } else if (entry.isFile() && DIAGRAM_FILE.test(entry.name)) {
        const [stat, text] = await Promise.all([fs.stat(abs), fs.readFile(abs, "utf8")]);
        files.push({
          path: rel,
          title: titleOf(text),
          kind: rel.startsWith(`${COMPONENTS}/`) ? "component" : "diagram",
          mtime: stat.mtimeMs,
          size: stat.size,
          hasThumb: names.has(thumbPathOf(entry.name)),
        });
      }
    }
  }
  await walk(ROOT, "");
  return { folders, files };
}

/**
 * A file's content and mtime (any regular file inside ROOT: diagrams, thumbnails, README).
 * `text` is the UTF-8 text; a thumbnail is binary, so `bytes` carries the raw content.
 */
export async function read(rel) {
  const { abs, rel: clean } = await safe(rel);
  const stat = await statOrNull(abs);
  if (!stat?.isFile()) throw notFound(clean);
  const bytes = await fs.readFile(abs);
  return {
    path: clean,
    text: bytes.toString("utf8"),
    bytes,
    mtime: stat.mtimeMs,
    size: stat.size,
  };
}

/**
 * Write a diagram atomically. An existing file with different content is replaced only when
 * `overwrite` is set, or when `base` equals its current mtime (the autosave's check that
 * nobody else wrote it since); otherwise 409 `{ error, code: "exists" | "changed", mtime }`.
 * With `base` and no file on disk: 409 `code: "missing"` (it was moved or trashed meanwhile).
 * `exclusive` (a new file): any existing file is a 409 `exists`, even with the same text.
 * @param {string} rel
 * @param {string} text
 * @param {{ overwrite?: boolean, base?: number | null, exclusive?: boolean }} [options]
 */
export async function write(rel, text, { overwrite = false, base = null, exclusive = false } = {}) {
  const { abs, rel: clean } = await safe(rel);
  if (!DIAGRAM_FILE.test(clean)) throw refuse("Only .yaml and .yml files can be written.");
  refuseTrash(clean);
  if (typeof text !== "string") throw refuse("The body must be the file's text.");
  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    throw new WorkspaceError(413, `The text is larger than ${MAX_TEXT_BYTES} bytes.`);
  }
  const stat = await statOrNull(abs);
  if (stat && !stat.isFile()) throw new WorkspaceError(409, `${clean} is a folder.`);
  if (stat && exclusive) {
    throw new WorkspaceError(409, `${clean} already exists.`, {
      code: "exists",
      mtime: stat.mtimeMs,
    });
  }
  if (!stat && base !== null) {
    throw new WorkspaceError(409, `${clean} is no longer on disk.`, { code: "missing" });
  }
  if (stat && !overwrite && stat.mtimeMs !== base) {
    const current = await fs.readFile(abs, "utf8");
    if (current === text) return { path: clean, mtime: stat.mtimeMs, size: stat.size };
    throw base === null
      ? new WorkspaceError(409, `${clean} already exists.`, { code: "exists", mtime: stat.mtimeMs })
      : new WorkspaceError(409, `${clean} changed on disk.`, {
          code: "changed",
          mtime: stat.mtimeMs,
        });
  }
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await atomicWrite(abs, text);
  const after = await fs.stat(abs);
  return { path: clean, mtime: after.mtimeMs, size: after.size };
}

/** Create a folder (and its parents). 409 when a file is in the way. */
export async function mkdir(rel) {
  const { abs, rel: clean } = await safe(rel);
  refuseTrash(clean);
  const stat = await statOrNull(abs);
  if (stat && !stat.isDirectory()) throw new WorkspaceError(409, `${clean} is a file.`);
  await fs.mkdir(abs, { recursive: true });
  return { path: clean };
}

/**
 * Move or rename a diagram (with its thumbnail) or a folder. An existing target is replaced
 * only with `overwrite`, and then it is trashed first, never lost. `components/` itself stays.
 */
export async function move(from, to, { overwrite = false } = {}) {
  const source = await safe(from);
  const target = await safe(to);
  refuseTrash(target.rel);
  if (source.rel === COMPONENTS) throw refuse(`${COMPONENTS}/ cannot be moved.`);
  const stat = await statOrNull(source.abs);
  if (!stat) throw notFound(source.rel);
  if (stat.isFile() && !DIAGRAM_FILE.test(target.rel)) {
    throw refuse("A diagram must keep a .yaml or .yml name.");
  }
  if (target.rel === source.rel) return { from: source.rel, to: target.rel };
  if (target.rel.startsWith(`${source.rel}/`)) throw refuse("A folder cannot move into itself.");
  const existing = await statOrNull(target.abs);
  // A case-only rename on a case-insensitive disk finds the source itself at the target.
  const sameFile =
    existing !== null && (await fs.realpath(source.abs)) === (await fs.realpath(target.abs));
  if (existing && !sameFile) {
    if (!overwrite) {
      throw new WorkspaceError(409, `${target.rel} already exists.`, { code: "exists" });
    }
    await trash(target.rel);
  }
  await fs.mkdir(path.dirname(target.abs), { recursive: true });
  await fs.rename(source.abs, target.abs);
  if (stat.isFile()) {
    const thumb = path.join(path.dirname(source.abs), thumbPathOf(path.basename(source.abs)));
    if (await statOrNull(thumb)) {
      await fs.rename(
        thumb,
        path.join(path.dirname(target.abs), thumbPathOf(path.basename(target.abs))),
      );
    }
  }
  return { from: source.rel, to: target.rel };
}

/** Move a diagram (with its thumbnail) or a folder to `_trash/<timestamp>-<name>`. */
export async function trash(rel) {
  const { abs, rel: clean } = await safe(rel);
  if (clean === COMPONENTS) throw refuse(`${COMPONENTS}/ cannot be trashed.`);
  refuseTrash(clean);
  const stat = await statOrNull(abs);
  if (!stat) throw notFound(clean);
  const bin = path.join(ROOT, TRASH);
  await fs.mkdir(bin, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  let name = `${stamp}-${path.basename(abs)}`;
  for (let n = 2; await statOrNull(path.join(bin, name)); n += 1) {
    name = `${stamp}-${n}-${path.basename(abs)}`;
  }
  await fs.rename(abs, path.join(bin, name));
  if (stat.isFile()) {
    const thumb = path.join(path.dirname(abs), thumbPathOf(path.basename(abs)));
    if (await statOrNull(thumb)) await fs.rename(thumb, path.join(bin, thumbPathOf(name)));
  }
  return { path: clean, trashedTo: `${TRASH}/${name}` };
}

/**
 * Save `<name>.thumb.png` beside an existing diagram. `png` is a `data:image/png;base64,…`
 * URL (the request body is JSON). A PNG, not the exporter's SVG: the SVG inlines fonts and
 * icons (180–280 KB each), and thumbnails are committed with the diagrams (plan §9.2).
 */
export async function writeThumb(rel, png) {
  const { abs, rel: clean } = await safe(rel);
  if (!DIAGRAM_FILE.test(clean)) throw refuse("A thumbnail belongs to a .yaml diagram.");
  refuseTrash(clean);
  if (!(await statOrNull(abs))?.isFile()) throw notFound(clean);
  const match = typeof png === "string" ? PNG_DATA_URL.exec(png) : null;
  const bytes = match ? Buffer.from(match[1], "base64") : null;
  if (!bytes || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw refuse("The thumbnail must be a PNG data URL.");
  }
  if (bytes.length > MAX_THUMB_BYTES) {
    throw new WorkspaceError(413, `The thumbnail is larger than ${MAX_THUMB_BYTES} bytes.`);
  }
  const thumb = thumbPathOf(clean);
  await atomicWrite(path.join(ROOT, ...thumb.split("/")), bytes);
  return { path: thumb, size: bytes.length };
}

async function gitLog(abs) {
  const { stdout } = await run(
    "git",
    [
      "log",
      "--follow",
      "-n",
      "30",
      "--date=iso",
      "--format=%x1e%H%x1f%ad%x1f%s",
      "--name-only",
      "--",
      abs,
    ],
    { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 },
  );
  return stdout
    .split("\x1e")
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [head, ...rest] = record.split("\n");
      const [sha, date, subject] = head.split("\x1f");
      // `--follow` crosses renames: the file's repo path at that commit, for `git show`.
      const file = rest.map((line) => line.trim()).find(Boolean) ?? null;
      return { sha, date, subject, file };
    });
}

/**
 * The last 30 commits that touched a file, newest first, across renames (`--follow`: the
 * examples keep their `src/examples/` history). `[]` outside Git or for an untracked file.
 * @returns {Promise<Array<{ sha: string, date: string, subject: string }>>}
 */
export async function versions(rel) {
  const { abs } = await safe(rel);
  try {
    return (await gitLog(abs)).map(({ sha, date, subject }) => ({ sha, date, subject }));
  } catch {
    return [];
  }
}

/** The file's text at `sha` (a commit from `versions`). */
export async function readVersion(rel, sha) {
  const { abs, rel: clean } = await safe(rel);
  if (typeof sha !== "string" || !SHA.test(sha)) throw refuse("sha must be a commit hash.");
  let log;
  try {
    log = await gitLog(abs);
  } catch {
    throw new WorkspaceError(404, "The workspace is not in Git.");
  }
  const entry = log.find((version) => version.sha.startsWith(sha.toLowerCase()));
  if (!entry?.file) throw new WorkspaceError(404, `${clean} has no version ${sha}.`);
  const { stdout } = await run("git", ["show", `${entry.sha}:${entry.file}`], {
    cwd: ROOT,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}
