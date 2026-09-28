/**
 * DG-35 — runs the app's React-free spec code in Node, through the dev server's own module
 * pipeline: `server.ssrLoadModule` (Vite 6, `ViteDevServer`) transforms and evaluates
 * `src/server-surface.ts` and everything it imports, exactly as the browser build sees them.
 *
 * No cache here: Vite's SSR module runner keeps the evaluated module, and a file change
 * invalidates it (the watcher's `change` → `moduleGraph.onFileChange`), so the next call
 * returns the edited code. Load lazily, per call — never inside `configureServer` itself,
 * where the server is not listening yet.
 */
import { read } from "./workspace-fs.mjs";
import { readAll } from "./catalog-fs.mjs"; // DG-26 (1b): catalog references need the catalog

/** Served path of the surface module (root-relative, like a browser import). */
export const SURFACE = "/src/server-surface.ts";

/**
 * @param {import("vite").ViteDevServer} server
 */
export function createSpecBridge(server) {
  /** @returns {Promise<Record<string, any>>} the surface's exports */
  function load() {
    return server.ssrLoadModule(SURFACE, { fixStacktrace: true });
  }

  /** DG-26 (1b.5) — the catalog as it is now (read fresh per call). */
  async function catalogEntries() {
    const surface = await load();
    return (await readAll(surface.ICON_NAMES)).entries;
  }

  /**
   * `checkDiagram`, with `ref: catalog/…` resolved against the current catalog (readAll's
   * entries) — the same result the browser gets once the catalog has loaded. Every MCP tool
   * that checks or writes the TEXT it was given goes through this, never `surface.checkDiagram`
   * directly. The one exception (review round 0 F10): `diagram_write`'s "leave a newer dialect
   * alone" guard reads the version of the file already ON DISK, before any catalog resolution
   * is relevant, so it calls `bridge.load()` then `surface.checkDiagram` itself.
   * @param {string} text
   */
  async function check(text) {
    const surface = await load();
    return surface.checkDiagramResolved(
      text,
      async (path) => {
        try {
          return await read(path);
        } catch (error) {
          return error.status === 404 ? null : { error: error.message };
        }
      },
      await catalogEntries(),
    );
  }

  /**
   * DG-26 (1b.5) — a hint per node `ids` names whose `icon:` names a catalog item and has no
   * `ref:`; `[]` when the text has no AST (an unparseable diagram gets no hints).
   * @param {string} text
   * @param {readonly string[]} ids
   */
  async function refHints(text, ids) {
    const surface = await load();
    const entries = await catalogEntries();
    const { ast } = surface.checkDiagram(text, entries);
    return ast ? surface.refHints(ast, surface.catalogLookupOf(entries), new Set(ids)) : [];
  }

  /**
   * Validate a YAML text: every issue with a 1-based line/col, `ok` when no error.
   * @param {string} text
   */
  async function validate(text) {
    const checked = await check(text);
    return {
      ok: checked.ok,
      issues: checked.issues.map((i) => ({
        severity: i.severity,
        code: i.code,
        path: i.path,
        message: i.message,
        ...(i.range ? { line: i.range.start.line, col: i.range.start.col } : {}),
        ...(i.suggestion ? { suggestion: i.suggestion } : {}),
      })),
    };
  }

  /**
   * The gate every write passes: throws (nothing is written) when the text has an error;
   * returns the other issues (warnings, info) for the tool's result.
   * @param {string} text
   */
  async function assertValid(text) {
    const checked = await validate(text);
    if (!checked.ok) {
      const lines = checked.issues
        .filter((i) => i.severity === "error")
        .map(
          (i) =>
            `- ${i.line ? `line ${i.line}: ` : ""}${i.message} (${i.code}${i.path ? ` at ${i.path}` : ""})`,
        );
      throw new Error(`Nothing was written: the YAML has errors.\n${lines.join("\n")}`);
    }
    return checked.issues;
  }

  return { load, catalogEntries, check, refHints, validate, assertValid };
}
