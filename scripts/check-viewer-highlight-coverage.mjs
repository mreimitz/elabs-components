#!/usr/bin/env node
/**
 * check-viewer-highlight-coverage.mjs — `capabilities.highlight` is a PROMISE (ADR 0025).
 *
 * A viewer adapter declares which {@link DocumentAddressKind}s it can honour on its
 * EAGER manifest, so an app can gate a "show citation" affordance without downloading
 * the parser. Nothing else in the repo checks that the renderer keeps that promise: a
 * manifest can claim `rect` forever while the renderer ignores the prop, and the only
 * symptom is a citation that silently does nothing.
 *
 * Four rungs, per adapter under `packages/viewer/src/adapters/<id>/`:
 *
 *   (a) DECLARATION VALIDITY — every declared kind is a real kind (read from
 *       `packages/ui/src/lib/document-address.ts`, so the two cannot drift), with no
 *       duplicates, and `quote` implies `capabilities.text === true`. A quote is
 *       located by the PROVIDER against `AdapterDocument.text`; an adapter that
 *       publishes no text has made a promise nothing can keep.
 *   (b) THE RENDERER READS IT — the adapter module must reference the `highlights`
 *       renderer prop, and an adapter declaring `rect` must also reference `rects`
 *       (geometry is not paintable through the text path).
 *   (c) THE CONVERSE — an adapter whose renderer reads `highlights` but whose manifest
 *       declares nothing fails too, so a capability cannot quietly vanish from the
 *       eager manifest while the painting code stays behind.
 *   (d) A TEST COVERS EACH KIND — the adapter's `*-adapter.test.tsx` must build an
 *       address literal for each declared kind and assert on something PAINTED (a
 *       `<mark>` query, the `match-highlight-mark` slot, or a `highlight-rect`
 *       overlay). `quote` is satisfied by a `range` case as well, and deliberately:
 *       the provider resolves a quote to offsets BEFORE the renderer ever sees it, so
 *       what an adapter can prove is that it paints located offsets.
 *
 * What this gate CANNOT prove: that the painted mark lands on the right characters,
 * that `rect` boxes are positioned correctly, or that the quote locator agrees with
 * the adapter's own text projection. Those are the unit tests' job — this gate proves
 * the wiring exists at all, which is precisely what silent drift removes.
 *
 * Flags:
 *   --warn   never exit non-zero (dev-hook mode); still prints findings.
 *
 * Dependency-free; ESM; locates the workspace relative to this file (cwd-independent).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const ADAPTERS_DIR = join(REPO_ROOT, "packages", "viewer", "src", "adapters");
const ADDRESS_MODULE = join(REPO_ROOT, "packages", "ui", "src", "lib", "document-address.ts");

/**
 * Strip comments so a kind named in prose is never mistaken for evidence.
 * Regex-level (the same idiom as `check-charts-test-double.mjs`), not a real parse.
 * @param {string} src
 */
export function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The canonical kind list, read from `DOCUMENT_ADDRESS_KINDS` in `ui` rather than
 * copied — a hand-kept second list is how a new kind ships unenforced.
 * @param {string} src contents of `document-address.ts`
 * @returns {string[]}
 */
export function parseAddressKinds(src) {
  const m = stripComments(src).match(/DOCUMENT_ADDRESS_KINDS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([a-z-]+)["']/g)].map((k) => k[1]);
}

/**
 * The body of the balanced `{…}` that follows `<key>:`, or `""`.
 *
 * Counted rather than matched with `[\s\S]*?\}`, which stops at the FIRST `}` —
 * so the day a manifest nests an object inside `capabilities`, a lazy match
 * would silently see a truncated block, find fewer declarations, and let the
 * gate pass while claiming to have checked them.
 *
 * @param {string} code source with comments already stripped
 * @param {string} key the property whose object body to return
 * @returns {string}
 */
export function balancedBlockAfter(code, key) {
  const at = code.search(new RegExp(`\\b${key}\\s*:\\s*\\{`));
  if (at === -1) return "";
  const open = code.indexOf("{", at);
  let depth = 0;
  for (let index = open; index < code.length; index += 1) {
    if (code[index] === "{") depth += 1;
    else if (code[index] === "}" && --depth === 0) return code.slice(open + 1, index);
  }
  return "";
}

/**
 * The `capabilities` a manifest declares.
 * @param {string} src contents of a `*-manifest.ts`
 * @returns {{ text: boolean, highlight: string[] | null }}
 */
export function parseCapabilities(src) {
  const code = stripComments(src);
  const body = balancedBlockAfter(code, "capabilities");
  const highlight = body.match(/highlight\s*:\s*\[([\s\S]*?)\]/);
  return {
    text: /\btext\s*:\s*true\b/.test(body),
    highlight: highlight ? [...highlight[1].matchAll(/["']([a-z-]+)["']/g)].map((k) => k[1]) : null,
  };
}

/** `true` when the source references the `highlights` renderer prop. @param {string} src */
export function readsHighlights(src) {
  return /\bhighlights\b/.test(stripComments(src));
}

/** `true` when the source references a rect address's `rects`. @param {string} src */
export function readsRects(src) {
  return /\brects\b/.test(stripComments(src));
}

/** `true` when a test asserts on something the highlight layer actually painted. */
function assertsOnPaint(code) {
  return (
    /querySelectorAll\(\s*["'`]\s*mark/.test(code) ||
    /querySelector\(\s*["'`]\s*mark/.test(code) ||
    /(?:getAllByRole|getByRole|queryAllByRole)\(\s*["']mark["']/.test(code) ||
    /match-highlight-mark/.test(code) ||
    /highlight-rect/.test(code) ||
    /highlight-block/.test(code)
  );
}

/** `true` when a test builds an address literal of this kind. */
function buildsAddress(code, kind) {
  return new RegExp(`kind\\s*:\\s*["']${kind}["']`).test(code);
}

/**
 * Rungs (a)–(d) for one adapter.
 * @param {{ id: string, manifestSrc: string, adapterSrc: string, testSrc: string | null,
 *           validKinds: readonly string[] }} input
 * @returns {string[]} problems, empty when the adapter is clean
 */
export function checkAdapter({ id, manifestSrc, adapterSrc, testSrc, validKinds }) {
  const problems = [];
  const { text, highlight } = parseCapabilities(manifestSrc);

  // (c) the converse — painting code with no declaration.
  if (highlight === null) {
    if (readsHighlights(adapterSrc)) {
      problems.push(
        `${id}: the renderer reads the \`highlights\` prop but the manifest declares no ` +
          "`capabilities.highlight` — an app cannot gate a citation affordance on a promise " +
          "that is not published.",
      );
    }
    return problems;
  }

  if (highlight.length === 0) {
    problems.push(
      `${id}: \`capabilities.highlight\` is an empty array — omit the key instead, so ` +
        '"declares nothing" has one spelling.',
    );
    return problems;
  }

  // (a) declaration validity.
  for (const kind of highlight) {
    if (!validKinds.includes(kind)) {
      problems.push(
        `${id}: declares the address kind "${kind}", which is not one of ` +
          `${validKinds.map((k) => `"${k}"`).join(", ")} (DOCUMENT_ADDRESS_KINDS).`,
      );
    }
  }
  const seen = new Set();
  for (const kind of highlight) {
    if (seen.has(kind)) problems.push(`${id}: declares "${kind}" twice.`);
    seen.add(kind);
  }
  if (highlight.includes("quote") && !text) {
    problems.push(
      `${id}: declares "quote" without \`capabilities.text: true\` — a quote is located by ` +
        "the provider against `AdapterDocument.text`, so with no text it can never resolve.",
    );
  }

  // (b) the renderer reads it.
  if (!readsHighlights(adapterSrc)) {
    problems.push(
      `${id}: declares ${highlight.map((k) => `"${k}"`).join(", ")} but the adapter module ` +
        "never reads the `highlights` renderer prop — the declaration is unkeepable.",
    );
  }
  if (highlight.includes("rect") && !readsRects(adapterSrc)) {
    problems.push(
      `${id}: declares "rect" but the adapter module never reads a rect address's \`rects\` — ` +
        "geometry cannot be painted through the text path.",
    );
  }

  // (d) a test covers each kind.
  if (testSrc === null) {
    problems.push(
      `${id}: declares ${highlight.map((k) => `"${k}"`).join(", ")} but has no ` +
        "`*-adapter.test.tsx` to prove any of it.",
    );
    return problems;
  }
  const code = stripComments(testSrc);
  if (!assertsOnPaint(code)) {
    problems.push(
      `${id}: its test never asserts on a painted highlight (a \`mark\` query, the ` +
        "`match-highlight-mark` slot, or a `highlight-rect` overlay).",
    );
  }
  for (const kind of highlight) {
    // A `quote` reaches the renderer already resolved to offsets, so a `range` case IS
    // the quote paint path. Every other kind must be built in the test verbatim.
    const covered = buildsAddress(code, kind) || (kind === "quote" && buildsAddress(code, "range"));
    if (!covered) {
      problems.push(
        `${id}: declares "${kind}" but no test builds a \`kind: "${kind}"\` address` +
          (kind === "quote" ? ' (or a `kind: "range"` one, which resolves the same way).' : "."),
      );
    }
  }
  return problems;
}

/** Every adapter directory that ships a manifest. */
function adapterDirs() {
  if (!existsSync(ADAPTERS_DIR)) return [];
  return readdirSync(ADAPTERS_DIR)
    .filter((name) => statSync(join(ADAPTERS_DIR, name)).isDirectory())
    .sort();
}

/** First existing path among the candidates, or `null`. */
function firstFile(dir, suffixes) {
  for (const name of readdirSync(dir).sort()) {
    if (suffixes.some((s) => name.endsWith(s))) return join(dir, name);
  }
  return null;
}

export function main(argv = []) {
  const warnOnly = argv.includes("--warn");
  const validKinds = existsSync(ADDRESS_MODULE)
    ? parseAddressKinds(readFileSync(ADDRESS_MODULE, "utf8"))
    : [];
  if (validKinds.length === 0) {
    console.error(
      "✖ viewer-highlight gate FAILED: could not read DOCUMENT_ADDRESS_KINDS from " +
        `${relative(REPO_ROOT, ADDRESS_MODULE)}.`,
    );
    return warnOnly ? 0 : 1;
  }

  const problems = [];
  let declaring = 0;
  for (const id of adapterDirs()) {
    const dir = join(ADAPTERS_DIR, id);
    const manifestPath = firstFile(dir, ["-manifest.ts"]);
    const adapterPath = firstFile(dir, ["-adapter.tsx", "-adapter.ts"]);
    if (!manifestPath || !adapterPath) continue;
    const testPath = firstFile(dir, ["-adapter.test.tsx", "-adapter.test.ts"]);
    const manifestSrc = readFileSync(manifestPath, "utf8");
    if (parseCapabilities(manifestSrc).highlight !== null) declaring += 1;
    problems.push(
      ...checkAdapter({
        id,
        manifestSrc,
        adapterSrc: readFileSync(adapterPath, "utf8"),
        testSrc: testPath ? readFileSync(testPath, "utf8") : null,
        validKinds,
      }),
    );
  }

  if (problems.length) {
    const label = warnOnly ? "⚠ viewer-highlight" : "✖ viewer-highlight gate FAILED";
    console.error(`\n${label} (${problems.length}):`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      "\n  See docs/ADR/0025-document-highlighting-and-addressing.md and " +
        '.claude/rules/viewer-components.md § "Pointing at part of a document".',
    );
    return warnOnly ? 0 : 1;
  }

  console.log(
    `✔ viewer-highlight: ${declaring} adapter(s) declare address kinds; every declared kind ` +
      "is real, read by the renderer, and covered by a test that asserts on a painted mark.",
  );
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
