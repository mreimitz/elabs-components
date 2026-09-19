#!/usr/bin/env node
/**
 * bundle-budget.mjs — the `/` route's initial JavaScript, read from a `next build` (RM-104).
 *
 * The INITIAL set is what a first visit to `/` downloads before any interaction: Next's
 * `rootMainFiles`, the client entry chunks of `app/layout` + `app/page` (RSC client manifest),
 * and every chunk the prerendered `index.html` references (SSR'd `next/dynamic` preloads). The
 * `noModule` polyfill is excluded — modern browsers never fetch it. Sizes are gzip (level 9).
 *
 * Turbopack's production chunks carry no module paths, so heavy engines are found by CODE
 * markers — strings only that engine's runtime contains (checked against the lazy chunks of a
 * real build, never a package name, which also appears in the generated docs data).
 *
 * `analyzeHomeBundle(io)` is pure over an `io` of `{ read, exists, list }` so the
 * `home-bundle` check rule (scripts/check/rules/home-bundle.mjs) runs it over fixtures too.
 * CLI: `node scripts/bundle-budget.mjs [--out <file>]` prints the report and writes JSON
 * (default `.next/bundle-budget.json`, uploaded by CI).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";

export const NEXT_DIR = "apps/home/.next";

/** Engines that must load per section, never on first paint (standing rule, RM-094). */
export const HEAVY_MARKERS = [
  { name: "@xyflow", re: /react-flow__renderer|xyflow__viewport/ },
  {
    name: "monaco-editor",
    re: /monaco-editor-background|MonacoEnvironment|vs\/editor\/editor\.main/,
  },
  { name: "maplibre-gl", re: /maplibregl-canvas|maplibregl-map/ },
  { name: "@milkdown", re: /package:"@milkdown\// },
  { name: "components-process", re: /process-kpi-strip|variant-explorer-row/ },
  {
    name: "components-terminal",
    re: /terminal-banner-capabilit|xterm-helper-textarea|xterm-viewport/,
  },
];

const gz = (text) => gzipSync(Buffer.from(text, "utf8"), { level: 9 }).length;
export const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** The object literal assigned to `__RSC_MANIFEST["/page"]` (Next writes it as JSON). */
function pageClientManifest(src) {
  const at = src.indexOf('["/page"]');
  if (at === -1) return { entryJSFiles: {} };
  return JSON.parse(
    src
      .slice(src.indexOf("=", at) + 1)
      .trim()
      .replace(/;\s*$/, ""),
  );
}

/**
 * @param {{ read(rel: string): string, exists(rel: string): boolean, list(rel: string): string[] }} io
 *   paths relative to the `.next` directory
 * @returns {null | { initial, initialGzipBytes, heavyInInitial, lazy }} null when there is no build
 */
export function analyzeHomeBundle(io) {
  if (!io.exists("build-manifest.json")) return null;
  const build = JSON.parse(io.read("build-manifest.json"));
  const polyfills = new Set(build.polyfillFiles ?? []);
  const files = new Set(build.rootMainFiles ?? []);
  const rsc = "server/app/page_client-reference-manifest.js";
  if (io.exists(rsc))
    for (const [entry, chunks] of Object.entries(
      pageClientManifest(io.read(rsc)).entryJSFiles ?? {},
    ))
      if (/\/app\/(layout|page)$/.test(entry)) for (const c of chunks) files.add(c);
  const html = "server/app/index.html";
  if (io.exists(html))
    for (const m of io.read(html).matchAll(/static\/chunks\/[^"'\\\s]+?\.js/g)) files.add(m[0]);
  for (const p of polyfills) files.delete(p);

  const initial = [...files]
    .filter((f) => io.exists(f))
    .map((file) => {
      const text = io.read(file);
      return {
        file,
        gzipBytes: gz(text),
        heavy: HEAVY_MARKERS.filter((h) => h.re.test(text)).map((h) => h.name),
      };
    })
    .sort((a, b) => b.gzipBytes - a.gzipBytes);
  const initialSet = new Set(initial.map((c) => c.file));

  // Per-tab / per-section chunks (reported, not budgeted): each `next/dynamic` group of the page.
  const loadable = "server/app/page/react-loadable-manifest.json";
  const lazy = io.exists(loadable)
    ? Object.values(JSON.parse(io.read(loadable)))
        .map((g) => {
          const own = (g.files ?? []).filter((f) => !initialSet.has(f) && io.exists(f));
          const texts = own.map((f) => io.read(f));
          return {
            id: String(g.id),
            files: own,
            gzipBytes: texts.reduce((s, t) => s + gz(t), 0),
            engines: HEAVY_MARKERS.filter((h) => texts.some((t) => h.re.test(t))).map(
              (h) => h.name,
            ),
          };
        })
        .filter((g) => g.files.length > 0)
        .sort((a, b) => b.gzipBytes - a.gzipBytes)
    : [];

  // Where each engine lives instead (React.lazy / plain import() chunks are not in the
  // loadable manifest, so every non-initial chunk is scanned).
  const engines = Object.fromEntries(
    HEAVY_MARKERS.map((h) => [
      h.name,
      io
        .list("static/chunks")
        .filter((f) => f.endsWith(".js") && !initialSet.has(`static/chunks/${f}`))
        .filter((f) => h.re.test(io.read(`static/chunks/${f}`)))
        .map((f) => `static/chunks/${f}`),
    ]),
  );

  return {
    initial,
    initialGzipBytes: initial.reduce((s, c) => s + c.gzipBytes, 0),
    heavyInInitial: initial.filter((c) => c.heavy.length > 0),
    lazy,
    engines,
  };
}

/** Human-readable report lines. */
export function formatReport(report, budgetBytes) {
  const lines = [
    `/ initial JS: ${kb(report.initialGzipBytes)} gzip in ${report.initial.length} chunks` +
      (budgetBytes ? ` (budget ${kb(budgetBytes)})` : ""),
    ...report.initial.slice(0, 5).map((c) => `  ${c.file}  ${kb(c.gzipBytes)}`),
    `heavy engines in initial chunks: ${
      report.heavyInInitial.map((c) => `${c.file} (${c.heavy.join(", ")})`).join("; ") || "none"
    }`,
    `engines in lazy chunks: ${Object.entries(report.engines)
      .map(([name, files]) => `${name} ×${files.length}`)
      .join(", ")}`,
    `lazy groups (reported, not budgeted): ${report.lazy.length}`,
    ...report.lazy.map(
      (g) =>
        `  #${g.id}  ${kb(g.gzipBytes)}  ${g.engines.join(", ") || "-"}  (${g.files.length} files)`,
    ),
  ];
  return lines;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const home = join(dirname(fileURLToPath(import.meta.url)), "..");
  const next = join(home, ".next");
  const report = analyzeHomeBundle({
    read: (rel) => readFileSync(join(next, rel), "utf8"),
    exists: (rel) => existsSync(join(next, rel)),
    list: (rel) => (existsSync(join(next, rel)) ? readdirSync(join(next, rel)) : []),
  });
  if (!report) {
    console.error(
      "bundle-budget: no build at apps/home/.next — run `pnpm --filter @elabs-ai/home build`",
    );
    process.exit(1);
  }
  const baseline = JSON.parse(
    readFileSync(join(home, "../../scripts/check/baseline.json"), "utf8"),
  );
  const budget = baseline["home-bundle"]?.[`${NEXT_DIR}/server/app/index.html`];
  for (const line of formatReport(report, budget)) console.log(line);
  const outAt = process.argv.indexOf("--out");
  const out = outAt > -1 ? process.argv[outAt + 1] : join(next, "bundle-budget.json");
  writeFileSync(
    out,
    JSON.stringify({ budgetGzipBytes: budget ?? null, ...report }, null, 2) + "\n",
  );
  console.log(`report: ${out}`);
}
