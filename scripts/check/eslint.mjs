/**
 * eslint.mjs — run ESLint rules programmatically and return check findings.
 *
 * Resolves `eslint` + `typescript-eslint` from the workspace (the eslint-config
 * package, falling back to packages/ui) — no new dependency. Only the rules you
 * pass are enabled (everything else off), so a finding count is exactly "messages
 * from these rules" plus any fatal parse error (never silently skipped).
 *
 * Rule ids are `<plugin>/<rule>`; the plugin prefix resolves through PLUGINS.
 * Add a local plugin here when you port an ESLint-backed gate.
 */
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Plugin prefix → module path (repo-relative) exporting an ESLint plugin object. */
export const PLUGINS = {
  brand: "packages/eslint-config/rules/brand-tokens.js",
  "sidebar-a11y": "packages/eslint-config/rules/sidebar-ink.js",
  conventions: "packages/eslint-config/rules/product-conventions.js",
};

const RESOLVE_FROM = ["packages/eslint-config/package.json", "packages/ui/package.json"];

async function importFromWorkspace(specifier) {
  for (const from of RESOLVE_FROM) {
    try {
      const path = createRequire(join(REPO_ROOT, from)).resolve(specifier);
      return await import(pathToFileURL(path).href);
    } catch {
      /* try the next workspace package */
    }
  }
  throw new Error(`check/eslint: cannot resolve ${specifier} from ${RESOLVE_FROM.join(", ")}`);
}

let engine;
async function loadEngine() {
  if (!engine) {
    const [eslintMod, tseslintMod] = await Promise.all([
      importFromWorkspace("eslint"),
      importFromWorkspace("typescript-eslint"),
    ]);
    const ESLint = eslintMod.ESLint ?? eslintMod.default?.ESLint;
    const parser = (tseslintMod.default ?? tseslintMod).parser;
    engine = { ESLint, parser };
  }
  return engine;
}

/** `{ "brand/no-raw-color": "error" }` or `["brand/no-raw-color"]` → normalized rules object. */
function normalizeRules(rules) {
  return Array.isArray(rules) ? Object.fromEntries(rules.map((r) => [r, "error"])) : rules;
}

async function makeEslint(rules, cwd = REPO_ROOT) {
  const { ESLint, parser } = await loadEngine();
  const normalized = normalizeRules(rules);
  const plugins = {};
  for (const id of Object.keys(normalized)) {
    const prefix = id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : null;
    if (!prefix || plugins[prefix]) continue;
    if (!PLUGINS[prefix]) throw new Error(`check/eslint: unknown plugin prefix "${prefix}"`);
    const mod = await import(pathToFileURL(join(REPO_ROOT, PLUGINS[prefix])).href);
    plugins[prefix] = mod.default ?? mod;
  }
  return new ESLint({
    cwd,
    overrideConfigFile: true,
    allowInlineConfig: true,
    overrideConfig: [
      {
        files: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
        languageOptions: {
          parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        linterOptions: { reportUnusedDisableDirectives: "off" },
        plugins,
        rules: normalized,
      },
    ],
  });
}

function toFindings(results, root, rules) {
  const wanted = new Set(Object.keys(normalizeRules(rules)));
  const out = [];
  for (const r of results) {
    const file = relative(root, r.filePath).split("\\").join("/");
    for (const m of r.messages) {
      if (m.fatal || m.ruleId === null) {
        out.push({ file, line: m.line ?? 1, msg: `parse error: ${m.message}` });
      } else if (wanted.has(m.ruleId)) {
        out.push({ file, line: m.line ?? 1, msg: `${m.ruleId}: ${m.message}` });
      }
    }
  }
  return out;
}

/** Lint repo files (repo-relative paths) on disk. */
export async function lintFiles({ root = REPO_ROOT, rules, files }) {
  if (files.length === 0) return [];
  const eslint = await makeEslint(rules, root);
  const results = await eslint.lintFiles(files.map((f) => join(root, f)));
  return toFindings(results, root, rules);
}

/** Lint in-memory texts (fixtures): `texts = [{ file, text }]`. */
export async function lintTexts({ rules, texts }) {
  if (texts.length === 0) return [];
  const eslint = await makeEslint(rules);
  const results = [];
  for (const { file, text } of texts) {
    results.push(...(await eslint.lintText(text, { filePath: join(REPO_ROOT, file) })));
  }
  return toFindings(results, REPO_ROOT, rules);
}
