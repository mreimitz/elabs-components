/**
 * DG-21 — the typed client for the workspace service (`server/workspace-plugin.mjs`). One
 * function per route; every failure is a `WorkspaceApiError` carrying the HTTP status and the
 * server's `{ error, code }`. React-free.
 */

const BASE = "/api/workspace";

/** The SSE stream of file changes (`live-reload.ts`). */
export const WORKSPACE_EVENTS_URL = `${BASE}/events`;

export type WorkspaceFileKind = "diagram" | "component";

export interface WorkspaceFile {
  /** Workspace-relative, `/`-separated: `examples/lakehouse-aws.yaml`. */
  path: string;
  /** The YAML `title:`, or `null` when the file has none. */
  title: string | null;
  /** `component` for everything under `components/` (plan V1). */
  kind: WorkspaceFileKind;
  /** Milliseconds since the epoch (`fs.Stats.mtimeMs`). */
  mtime: number;
  size: number;
  /** A `<name>.thumb.png` sits beside it (`thumbPathOf`, `fileUrl`). */
  hasThumb: boolean;
}

export interface WorkspaceTree {
  /** Every folder, parents first: `components`, `examples`, `customers/acme`. */
  folders: string[];
  files: WorkspaceFile[];
}

export interface WorkspaceVersion {
  sha: string;
  /** ISO-like, from `git log --date=iso`: `2026-09-27 13:18:00 +0200`. */
  date: string;
  subject: string;
}

export interface WorkspaceWriteResult {
  path: string;
  mtime: number;
  size: number;
}

/** One SSE message: `add` / `change` carry the new mtime. */
export interface WorkspaceEvent {
  type: "add" | "change" | "unlink" | "addDir" | "unlinkDir";
  path: string;
  mtime?: number;
}

/** Why a write was refused with 409. */
export type WorkspaceConflictCode = "exists" | "changed" | "missing";

export class WorkspaceApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "WorkspaceApiError";
    this.status = status;
    this.code = code;
  }
}

async function check(response: Response): Promise<Response> {
  if (response.ok) return response;
  let message = `${response.status} ${response.statusText}`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    if (body.error) message = body.error;
    code = body.code;
  } catch {
    // Not JSON (the dev server is gone, a proxy answered): keep the status line.
  }
  throw new WorkspaceApiError(response.status, message, code);
}

async function json<T>(request: Promise<Response>): Promise<T> {
  return (await (await check(await request)).json()) as T;
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === false) continue;
    search.set(key, value === true ? "1" : String(value));
  }
  return search.toString();
}

function post<T>(route: string, body: object): Promise<T> {
  return json<T>(
    fetch(`${BASE}/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** `GET /tree` */
export function getTree(): Promise<WorkspaceTree> {
  return json<WorkspaceTree>(fetch(`${BASE}/tree`, { cache: "no-store" }));
}

/** The URL a file is served at (a thumbnail's `src`). */
export function fileUrl(path: string): string {
  return `${BASE}/file?${query({ path })}`;
}

/** `examples/a.yaml` → `examples/a.thumb.png` (`server/workspace-fs.mjs` `thumbPathOf`). */
export function thumbPathOf(path: string): string {
  return path.replace(/\.ya?ml$/i, ".thumb.png");
}

/** `GET /file`: the text and the mtime it was read at. */
export async function readFile(path: string): Promise<{ text: string; mtime: number }> {
  const response = await check(await fetch(fileUrl(path), { cache: "no-store" }));
  return {
    text: await response.text(),
    mtime: Number(response.headers.get("X-Workspace-Mtime")),
  };
}

export interface WriteOptions {
  /** Replace whatever is on disk. */
  overwrite?: boolean;
  /** Replace the file only if its mtime is still this one (else 409 `changed`). */
  base?: number | null;
  /** A new file only: any existing file is a 409 `exists`, even one with the same text. */
  create?: boolean;
}

/**
 * `PUT /file`. Without options an existing file is left alone (409 `exists`) unless it
 * already holds exactly `text`.
 */
export function writeFile(
  path: string,
  text: string,
  options: WriteOptions = {},
): Promise<WorkspaceWriteResult> {
  const { overwrite, base, create } = options;
  return json<WorkspaceWriteResult>(
    fetch(`${BASE}/file?${query({ path, overwrite, base, create })}`, {
      method: "PUT",
      headers: { "Content-Type": "text/yaml; charset=utf-8" },
      body: text,
    }),
  );
}

/**
 * Write `text` to a new file `<folder>/<name>.yaml`, adding `-2`, `-3`, … while the name is
 * taken (`create`: never an overwrite, never an existing file). Returns the path.
 */
export async function createUniqueFile(
  folder: string,
  name: string,
  text: string,
): Promise<string> {
  const stem = name.replace(/\.ya?ml$/i, "");
  for (let n = 1; n < 100; n += 1) {
    const file = `${n === 1 ? stem : `${stem}-${n}`}.yaml`;
    const path = folder === "" ? file : `${folder}/${file}`;
    try {
      await writeFile(path, text, { create: true });
      return path;
    } catch (error) {
      if (!(error instanceof WorkspaceApiError && error.code === "exists")) throw error;
    }
  }
  throw new WorkspaceApiError(409, `No free name for ${stem}.yaml.`, "exists");
}

/** `POST /mkdir` */
export function makeFolder(path: string): Promise<{ path: string }> {
  return post("mkdir", { path });
}

/** `POST /move`: a diagram (with its thumbnail) or a folder. */
export function moveEntry(
  from: string,
  to: string,
  options: { overwrite?: boolean } = {},
): Promise<{ from: string; to: string }> {
  return post("move", { from, to, overwrite: options.overwrite === true });
}

/** `POST /trash`: moves to `_trash/<timestamp>-<name>`; nothing is deleted. */
export function trashEntry(path: string): Promise<{ path: string; trashedTo: string }> {
  return post("trash", { path });
}

/** `POST /thumb`: `<name>.thumb.png` beside the diagram; `png` is a base64 data URL. */
export function writeThumb(path: string, png: string): Promise<{ path: string; size: number }> {
  return post("thumb", { path, png });
}

/** `GET /versions`: newest first, at most 30, `[]` outside Git. */
export async function getVersions(path: string): Promise<WorkspaceVersion[]> {
  const body = await json<{ versions: WorkspaceVersion[] }>(
    fetch(`${BASE}/versions?${query({ path })}`, { cache: "no-store" }),
  );
  return body.versions;
}

/** `GET /version`: the file's text at a commit. */
export async function readVersion(path: string, sha: string): Promise<string> {
  const response = await check(
    await fetch(`${BASE}/version?${query({ path, sha })}`, { cache: "no-store" }),
  );
  return response.text();
}
