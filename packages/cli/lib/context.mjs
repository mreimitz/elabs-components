/**
 * @qlik-coe-emea/qlabs-components-cli — `brand-ui context` generator (WP-03 #82).
 *
 * Generates the manifest's ground truth into the files coding agents read,
 * as the AgnosticUI `ag context` pattern: a portable, MCP-free, version-controlled
 * context surface usable by ANY agent (Claude, Cursor, Copilot, Windsurf, Gemini)
 * with zero setup and no running server.
 *
 * BOUNDARY: this lane writes only NEW generated files. `CLAUDE.md` / `AGENTS.md`
 * are owned by another lane; the marker-block writer below is designed so that
 * when those targets are wired in, hand-written prose OUTSIDE the markers is
 * preserved verbatim (the issue's hard requirement). For now `context` emits:
 *
 *   apps/docs/public/brand-ui-context.md ← portable Markdown (served by docs build)
 *
 * (The Cursor `.cursor/rules/brand-ui.mdc` target was deprecated/removed — 023cc89.)
 *
 * Every target is marker-wrapped and stale-gated (`brand-ui context --check`).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { loadManifest } from "./core.mjs";
import { renderContextBlock } from "./render-docs.mjs";

export const CONTEXT_START = "<!-- brand-ui:context:start -->";
export const CONTEXT_END = "<!-- brand-ui:context:end -->";

/**
 * Core marker-block writer: replace the content delimited by `start`/`end` in
 * `existing` with `block`, preserving everything outside the markers.
 *
 * `appendIfMissing` controls the no-markers case:
 *   - true  (legacy `brand-ui:context:*` behaviour) — append the block, keeping
 *     hand-written content above it (so a brand-new context file gets seeded).
 *   - false (the named `brand-ui:gen:*` regions) — DO NOT blind-append. These
 *     regions are placed by hand in the target docs at a precise position; if the
 *     markers are absent the caller wants to know, not silently dump a table at
 *     the end of the file. Throws so the omission is loud.
 *
 * @param {string|null} existing
 * @param {string} block
 * @param {{ start: string, end: string, appendIfMissing?: boolean, label?: string }} opts
 * @returns {string}
 */
function writeMarkerBlock(existing, block, { start, end, appendIfMissing = true, label }) {
  const wrapped = `${start}\n${block}\n${end}`;
  if (existing == null || existing === "") {
    if (appendIfMissing) return wrapped + "\n";
    throw new Error(
      `writeMarkerBlock: target for ${label ?? start} is empty and markers are absent`,
    );
  }
  const s = existing.indexOf(start);
  const e = existing.indexOf(end);
  if (s !== -1 && e !== -1 && e > s) {
    const before = existing.slice(0, s);
    const after = existing.slice(e + end.length);
    return before + wrapped + after;
  }
  if (!appendIfMissing) {
    throw new Error(
      `writeMarkerBlock: markers ${start} … ${end} not found in target (${label ?? "doc"}). ` +
        "Place the empty marker pair where the generated block should live, then re-run.",
    );
  }
  // No (valid) markers — append, keeping hand-written content above.
  const sep = existing.endsWith("\n") ? "\n" : "\n\n";
  return existing + sep + wrapped + "\n";
}

/**
 * Insert/replace the legacy `brand-ui:context:*` marker block in `existing`,
 * preserving everything outside the markers. Thin wrapper over writeMarkerBlock
 * (append-if-missing, the original behaviour for the shipped context surface).
 *
 * @param {string|null} existing  current file content (null = new file)
 * @param {string} block          the generated block body (without markers)
 * @returns {string}
 */
export function applyMarkerBlock(existing, block) {
  return writeMarkerBlock(existing, block, {
    start: CONTEXT_START,
    end: CONTEXT_END,
    appendIfMissing: true,
    label: "brand-ui:context",
  });
}

/**
 * Insert/replace a NAMED generated region (`brand-ui:gen:<name>:start` … `:end`)
 * in `existing`, preserving everything outside it. Unlike the legacy context
 * writer this NEVER blind-appends: the named regions are hand-placed in the
 * target docs, so a missing pair is an error (loud), not a silent append.
 *
 * Comment syntax is format-aware: Markdown uses HTML comments
 * (`<!-- brand-ui:gen:<name>:start -->`); MDX does NOT support HTML comments
 * (they break Storybook's MDX indexer), so `.mdx` targets use MDX expression
 * comments instead. Pass `{ mdx: true }` for MDX files.
 *
 * @param {string|null} existing  current file content
 * @param {string} name           the artifact name (e.g. "packages", "decisions")
 * @param {string} block          the generated block body (without markers)
 * @param {{ mdx?: boolean }} [opts]
 * @returns {string}
 */
export function applyNamedMarkerBlock(existing, name, block, { mdx = false } = {}) {
  const [start, end] = mdx
    ? [`{/* brand-ui:gen:${name}:start */}`, `{/* brand-ui:gen:${name}:end */}`]
    : [`<!-- brand-ui:gen:${name}:start -->`, `<!-- brand-ui:gen:${name}:end -->`];
  return writeMarkerBlock(existing, block, {
    start,
    end,
    appendIfMissing: false,
    label: `brand-ui:gen:${name}`,
  });
}

/**
 * The generated targets for `brand-ui context`. Each is { file, seed?, render }.
 * `seed` is the initial content for a brand-new file; on an existing file the
 * marker block is replaced in place and `seed` is ignored.
 *
 * Note: the Cursor `.cursor/rules/brand-ui.mdc` target was deprecated and removed
 * (commit 023cc89); portable agent context now lives only in
 * `apps/docs/public/brand-ui-context.md`.
 * @param {string} root  repo root
 */
export function contextTargets(root) {
  return [
    {
      file: join(root, "apps/docs/public/brand-ui-context.md"),
      seed: "",
    },
  ];
}

/**
 * Compute each target's expected content from the current manifest.
 * @returns {{ file: string, content: string }[]}
 */
export function computeContext(root) {
  const manifest = loadManifest(root);
  const block = renderContextBlock(manifest);
  return contextTargets(root).map(({ file, seed }) => {
    const existing = existsSync(file) ? readFileSync(file, "utf8") : (seed ?? "");
    return { file, content: applyMarkerBlock(existing === "" ? (seed ?? "") : existing, block) };
  });
}

/** Write the context files. Returns the list of written paths. */
export function writeContext(root) {
  const written = [];
  for (const { file, content } of computeContext(root)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    written.push(file);
  }
  return written;
}

/**
 * Stale-check: are all context targets up to date? Returns the list of stale
 * file paths (empty = fresh). Same contract as the manifest/inventory gates.
 */
export function checkContext(root) {
  const stale = [];
  for (const { file, content } of computeContext(root)) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current !== content) stale.push(file);
  }
  return stale;
}
