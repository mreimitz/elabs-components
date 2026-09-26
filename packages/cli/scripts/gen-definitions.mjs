#!/usr/bin/env node
/**
 * gen-definitions.mjs (ADR 0042 §7, RM-178) — the committed snapshot of every component
 * definition, and the codemod map generated from their alias rows.
 *
 * Inputs (dev time only):
 *   packages/charts/src/definitions/registry.ts   every chart, part and surface definition
 *   the component source files                    the TSDoc each component is declared with
 *
 * Outputs:
 *   packages/cli/lib/definitions.generated.json
 *       Keyed by package, then by definition id: `{ "@elabs-ai/components-charts": { "BarChart":
 *       { … } } }`. Each entry is the ui base's `toSnapshot(def)` plus the definition's `kind`
 *       (and a chart's `specTypes` and `contract`), the kind defaults of `codeOnly` props
 *       (`codeOnlyDefaults`), the repo-relative `module` that declares the component, and
 *       `prose` joined from that declaration's TSDoc: the `summary` text, every `@dataShape` and
 *       the `@avoidWhen`. The manifest, the A2UI catalog, `chart_for`, the doc regions and the
 *       codemod map read this file. Flow joins it under its own package key.
 *   packages/cli/lib/chart-codemod-map.generated.json
 *       One `props` mapping per alias row of a charts definition, in the `{ mappings }` shape
 *       `brand-ui codemod <map.json>` reads. Empty until the rename items add alias rows.
 *
 *   node packages/cli/scripts/gen-definitions.mjs          write both
 *   node packages/cli/scripts/gen-definitions.mjs --check  exit 1 if either is stale
 *
 * The registry is TypeScript, so this step bundles it with esbuild (a cli devDependency) and
 * imports the bundle in memory. Only this dev-time script does that: the shipped CLI reads the
 * two JSON files and never bundles anything. Runs BEFORE the `manifest` step of `pnpm gen`.
 * Output is byte-deterministic: sorted keys, no timestamps, repo-relative paths only, and
 * Prettier-formatted like every other committed JSON file.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";
import prettier from "prettier";

import { collectBarrelExports, declaringModule, extractChartDataShapes } from "../lib/core.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const DEFINITIONS_PATH = "packages/cli/lib/definitions.generated.json";
export const CHART_CODEMOD_MAP_PATH = "packages/cli/lib/chart-codemod-map.generated.json";

const CHARTS = "@elabs-ai/components-charts";

/**
 * The packages that publish definitions — one row each. `registry` is the module that lists
 * them, `exports` the registry maps it exports, and `barrel` the package entry whose exports
 * name the components the definitions describe (a definition's id is its component's name).
 * The flow track adds its row here.
 */
export const DEFINITION_SOURCES = [
  {
    pkg: CHARTS,
    registry: "packages/charts/src/definitions/registry.ts",
    exports: ["CHART_DEFINITIONS", "PART_DEFINITIONS", "SURFACE_DEFINITIONS"],
    barrel: "packages/charts/src/index.ts",
  },
];

/** Definition keys `toSnapshot` leaves out that the snapshot still carries, when present. */
const EXTRA_KEYS = ["kind", "specTypes", "contract"];

/** A sorted-key, function-free JSON copy of `value` (`undefined` when nothing is left). */
export function canonical(value) {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(canonical).filter((v) => v !== undefined);
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const json = canonical(value[key]);
      if (json !== undefined) out[key] = json;
    }
    return out;
  }
  return undefined;
}

/**
 * Bundles one package's registry with esbuild and imports it in memory. Returns the registry
 * maps named in `source.exports` and the ui base's `toSnapshot` from the same bundle.
 */
export async function loadRegistry(source, root = REPO_ROOT) {
  const registryDir = dirname(join(root, source.registry));
  const registryFile = `./${source.registry.split("/").pop().replace(/\.ts$/, "")}`;
  const contents = [
    `export { ${source.exports.join(", ")} } from ${JSON.stringify(registryFile)};`,
    'export { toSnapshot } from "@elabs-ai/components-ui/definition";',
    "",
  ].join("\n");
  const result = await build({
    stdin: { contents, resolveDir: registryDir, loader: "ts", sourcefile: "entry.ts" },
    absWorkingDir: root,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    charset: "ascii",
    legalComments: "none",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

/** `export [default] [async] function|const|let|class <name>` at the start of a line. */
function declarationOf(name) {
  return new RegExp(
    `^export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|const|let|class)\\s+${name}\\b`,
    "m",
  );
}

/** The docblock (`/** … *\/`) right before `name`'s exported declaration in `src`, or null. */
function docblockBefore(src, name) {
  // The same adjacency rule as `extractChartDataShapes` in lib/core.mjs: only whitespace may
  // sit between the block and the declaration.
  const decl = declarationOf(name).exec(src);
  if (!decl) return null;
  const before = src.slice(0, decl.index);
  const close = before.lastIndexOf("*/");
  if (close === -1 || before.slice(close + 2).trim() !== "") return null;
  const open = before.lastIndexOf("/**", close);
  return open === -1 ? null : before.slice(open, close + 2);
}

/**
 * The summary of a docblock: its text before the first block tag (`@dataShape`, `@example`, …),
 * as paragraphs. Wrapped lines are joined with a space; a blank line starts a new paragraph; a
 * list item keeps its own line; a fenced code block is kept verbatim. Empty → `undefined`.
 */
export function docSummary(block) {
  if (!block) return undefined;
  const lines = block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, "").replace(/\s+$/, ""));
  const paragraphs = [];
  let current = [];
  let fence = null;
  const flush = () => {
    if (current.length) paragraphs.push(current.join("\n"));
    current = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (fence) {
      fence.push(line);
      if (trimmed.startsWith("```")) {
        paragraphs.push(fence.join("\n"));
        fence = null;
      }
      continue;
    }
    if (trimmed.startsWith("```")) {
      flush();
      fence = [trimmed];
      continue;
    }
    if (/^@\w/.test(trimmed)) break;
    if (!trimmed) {
      flush();
      continue;
    }
    if (current.length && !/^(?:[-*+]|\d+\.)\s/.test(trimmed)) {
      current[current.length - 1] += ` ${trimmed}`;
    } else {
      current.push(trimmed);
    }
  }
  if (fence) paragraphs.push(fence.join("\n"));
  flush();
  const text = paragraphs.join("\n\n").trim();
  return text || undefined;
}

/** A barrel's sibling source files (no tests or stories), for a component found via its barrel. */
function barrelSiblings(root, module) {
  if (!/(^|\/)index\.tsx?$/.test(module)) return [];
  const dir = dirname(module);
  let entries = [];
  try {
    entries = readdirSync(join(root, dir));
  } catch {
    return [];
  }
  return entries
    .sort()
    .filter((e) => /\.tsx?$/.test(e) && !/\.(test|stories)\.tsx?$/.test(e))
    .map((e) => `${dir}/${e}`)
    .filter((p) => p !== module);
}

/**
 * Where the component `name` is declared and the prose its TSDoc carries. `exported` is the
 * package barrel's export list (`collectBarrelExports`). Throws when the package does not
 * export a component of that name: a definition must describe a real component.
 */
export function componentProse(root, exported, name) {
  const hit = exported.find((e) => e.name === name && e.kind === "value");
  if (!hit) throw new Error(`gen-definitions: no exported component named "${name}"`);
  const candidates = [
    ...new Set([
      declaringModule(root, hit.module, name),
      hit.module,
      ...barrelSiblings(root, hit.module),
    ]),
  ];
  for (const module of candidates) {
    let src;
    try {
      src = readFileSync(join(root, module), "utf8");
    } catch {
      continue;
    }
    if (!declarationOf(name).test(src)) continue;
    const summary = docSummary(docblockBefore(src, name));
    const tags = extractChartDataShapes(src, name) ?? {};
    return { module, prose: { ...(summary ? { summary } : {}), ...tags } };
  }
  return { module: hit.module, prose: {} };
}

/**
 * The snapshot entry of one definition. `toSnapshot` folds kind defaults into `fields`; a kind
 * default for a prop no field describes (a `codeOnly` prop) would be lost, so it is kept under
 * `codeOnlyDefaults` (functions are dropped).
 */
function entryFor(def, toSnapshot, located) {
  const snapshot = toSnapshot(def);
  const extras = {};
  for (const key of EXTRA_KEYS) if (def[key] !== undefined) extras[key] = def[key];
  const codeOnlyDefaults = {};
  for (const [key, value] of Object.entries(def.defaults ?? {})) {
    if (!(key in snapshot.fields) && value !== undefined) codeOnlyDefaults[key] = value;
  }
  const kept = canonical(codeOnlyDefaults);
  return canonical({
    ...snapshot,
    ...extras,
    ...(Object.keys(kept).length ? { codeOnlyDefaults: kept } : {}),
    module: located.module,
    prose: located.prose,
  });
}

/** The whole snapshot, keyed by package, then by definition id. */
export async function buildDefinitionsSnapshot(root = REPO_ROOT, sources = DEFINITION_SOURCES) {
  const snapshot = {};
  for (const source of sources) {
    const mod = await loadRegistry(source, root);
    const exported = collectBarrelExports(join(root, source.barrel), root);
    const entries = {};
    for (const exportName of source.exports) {
      const definitions = mod[exportName];
      if (!definitions) throw new Error(`gen-definitions: ${source.registry} has no ${exportName}`);
      for (const id of Object.keys(definitions)) {
        if (entries[id]) throw new Error(`gen-definitions: ${source.pkg} defines "${id}" twice`);
        const def = definitions[id];
        if (def.id !== id)
          throw new Error(`gen-definitions: "${id}" holds the "${def.id}" definition`);
        entries[id] = entryFor(def, mod.toSnapshot, componentProse(root, exported, id));
      }
    }
    snapshot[source.pkg] = entries;
  }
  return canonical(snapshot);
}

/**
 * The codemod map of one package: one `props` mapping per alias row, in the shape
 * `brand-ui codemod` reads (`source`/`target` name the component, `propRemap` the rename),
 * with the row itself under `alias`. Ordered by definition id, then by row as declared.
 */
export function codemodMapFrom(snapshot, pkg = CHARTS) {
  const entries = snapshot[pkg] ?? {};
  const mappings = [];
  for (const id of Object.keys(entries).sort()) {
    const entry = entries[id];
    for (const row of entry.aliases ?? []) {
      mappings.push({
        class: "props",
        pkg,
        kind: entry.kind,
        source: id,
        target: id,
        propRemap: { [row.from]: row.to },
        alias: row,
      });
    }
  }
  return canonical({ mappings });
}

async function formatJson(value, file, root) {
  const config = (await prettier.resolveConfig(join(root, file))) ?? {};
  return prettier.format(JSON.stringify(value, null, 2), {
    ...config,
    filepath: join(root, file),
  });
}

/** Both artifacts as `{ path: content }`, computed without touching the tree. */
export async function renderDefinitionArtifacts(root = REPO_ROOT) {
  const snapshot = await buildDefinitionsSnapshot(root);
  return {
    [DEFINITIONS_PATH]: await formatJson(snapshot, DEFINITIONS_PATH, root),
    [CHART_CODEMOD_MAP_PATH]: await formatJson(
      codemodMapFrom(snapshot, CHARTS),
      CHART_CODEMOD_MAP_PATH,
      root,
    ),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const check = argv.includes("--check");
  const artifacts = await renderDefinitionArtifacts();
  const stale = [];
  for (const [file, content] of Object.entries(artifacts)) {
    const abs = join(REPO_ROOT, file);
    const current = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    if (current === content) continue;
    if (check) {
      stale.push(file);
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`gen-definitions: wrote ${file}`);
  }
  if (stale.length) {
    console.error(`gen-definitions: stale — ${stale.join(", ")}. Run \`pnpm gen\`.`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
