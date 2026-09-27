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

  /**
   * Validate a YAML text: every issue with a 1-based line/col, `ok` when no error.
   * @param {string} text
   */
  async function validate(text) {
    const surface = await load();
    const checked = surface.checkDiagram(text);
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
        .map((i) => `- ${i.line ? `line ${i.line}: ` : ""}${i.message} (${i.code} at ${i.path})`);
      throw new Error(`Nothing was written: the YAML has errors.\n${lines.join("\n")}`);
    }
    return checked.issues;
  }

  return { load, validate, assertValid };
}
