/**
 * @qlik-coe-emea/qlabs-components-cli — resolved prop tables via `react-docgen-typescript` (WP-03 #79).
 *
 * This is the INHERITED-prop-resolution half of #79 (ADR 0013). The
 * dependency-free regex extractor (`extractPropTable`/`extractVariants` in
 * core.mjs) is the FLOOR — it captures a component's own-declared props, the
 * `extends` clause and the cva variant values without any deps. This module is a
 * STRICTLY ADDITIVE, FAIL-SAFE enrichment on top of it: it spins a real TS
 * program (the same engine Storybook autodocs uses) to resolve inherited prop
 * types, default values and TSDoc descriptions — so an agent reading the manifest
 * sees the expanded inherited surface, not just `extends ButtonHTMLAttributes<…>`.
 *
 * SAFETY (this code feeds `generateManifest`, the single input every derived doc
 * reads, so it MUST be incapable of breaking manifest generation):
 *
 *   1. Guarded dynamic import. `react-docgen-typescript` is a *devDependency*
 *      loaded via `await import(...)` inside try/catch. When it is ABSENT (the
 *      default until a human runs `pnpm install`) or throws, `resolveProps`
 *      returns null and the caller produces EXACTLY the same manifest as today.
 *   2. Additive only. The caller merges resolved fields INTO the existing prop
 *      entries; this module never restructures the manifest schema.
 *   3. Deterministic. Output is a plain map keyed by component name with stable
 *      field order; no timestamps (the manifest stale-gate diffs content).
 *
 * The runtime read path (`brand-ui info/search/docs/context`) never imports this
 * module — only `generateManifest` does, during `pnpm manifest` (a maintainer/CI
 * build step). The committed manifest stays the artifact consumers read.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG_PKGS = new Set([
  "@qlik-coe-emea/qlabs-components-eslint-config",
  "@qlik-coe-emea/qlabs-components-typescript-config",
  "@qlik-coe-emea/qlabs-components-cli",
]);

/**
 * Best-effort: load `react-docgen-typescript` if installed. Returns the module
 * or null. A missing/broken dep is a clean no-op (the no-dep path is the floor).
 */
async function loadDocgen() {
  // #79 enrichment: the resolution is now BOUNDED. `resolveProps` used to expand
  // EVERY inherited DOM/aria prop (unbounded) — ballooning the manifest to ~30 MB
  // and OOM-ing the generator. The `propFilter` below (drop `node_modules`-declared
  // props) + `sanitizeType` (strip machine-specific absolute import paths) fix that:
  // measured output is ~1 MB and byte-deterministic on a fixed lockfile (only the
  // `generatedAt` timestamp varies, which the manifest stale-gate already normalizes).
  //
  // We still keep the dependency-free regex floor the DEFAULT (opt in with
  // `BRAND_UI_ENRICH_MANIFEST=1`) for two reasons that are environmental, not code:
  //   1. The existing test suite + committed manifest are built around the floor;
  //      flipping the default means committing the enriched manifest and updating
  //      those tests.
  //   2. `manifest:check` regenerates-and-diffs in CI, so the committed enriched
  //      manifest must reproduce byte-for-byte on CI's OS/TS. That is LIKELY (types
  //      are toolchain-derived and paths are sanitized) but unproven cross-OS.
  // Enabling-by-default is therefore a clean, CI-determinism-gated follow-up — no
  // longer an engine blocker. See WP-03 #79.
  if (process.env.BRAND_UI_ENRICH_MANIFEST !== "1") return null;
  try {
    return await import("react-docgen-typescript");
  } catch {
    return null;
  }
}

/** First tsconfig that exists for a package (used to scope the TS program). */
function findTsconfig(pkgDir) {
  for (const name of ["tsconfig.json", "tsconfig.build.json"]) {
    const p = join(pkgDir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * DETERMINISM: strip machine-specific absolute paths out of a resolved type
 * string. `react-docgen-typescript` renders some imported types as
 * `typeof import("<absolute path>")` — e.g. monaco's editor types resolve to
 * `import("/Users/<me>/…/node_modules/.pnpm/monaco-editor@x/…/monaco-editor/…")`.
 * That absolute prefix differs per machine and would make the committed manifest
 * un-reproducible (false stale-gate failures). We collapse every `import("…")` to
 * the bare module specifier: the segment after the LAST `node_modules/` (which
 * drops both the absolute prefix and pnpm's versioned `.pnpm/<pkg>@<ver>` wrapper),
 * or the repo-relative path if a local source path leaked. The result is identical
 * on every machine that shares the lockfile.
 * @param {string} type
 * @param {string} [repoRoot]
 */
export function sanitizeType(type, repoRoot) {
  if (typeof type !== "string") return type;
  return type.replace(/import\("([^"]*)"\)/g, (match, p) => {
    const nm = p.lastIndexOf("node_modules/");
    if (nm !== -1) return `import("${p.slice(nm + "node_modules/".length)}")`;
    if (repoRoot && p.startsWith(repoRoot))
      return `import("${p.slice(repoRoot.length).replace(/^\/+/, "")}")`;
    return match;
  });
}

/**
 * Normalize one react-docgen prop into the manifest's additive shape. Keys are
 * emitted in a stable order; absent fields are omitted (so a merge can't clobber
 * a richer existing value with an empty one). `repoRoot` lets us strip machine-
 * specific absolute paths out of resolved type strings (determinism).
 * @returns {{ type?: string, optional?: boolean, defaultValue?: string, description?: string }}
 */
function normalizeProp(p, repoRoot) {
  const out = {};
  const type = p?.type?.name;
  if (typeof type === "string" && type.trim()) out.type = sanitizeType(type.trim(), repoRoot);
  if (typeof p?.required === "boolean") out.optional = !p.required;
  // defaultValue is `{ value: <string|number|...> } | null`.
  const dv = p?.defaultValue?.value;
  if (dv !== undefined && dv !== null) out.defaultValue = String(dv);
  const desc = typeof p?.description === "string" ? p.description.trim() : "";
  if (desc) out.description = desc;
  return out;
}

/**
 * Resolve inherited prop types, defaults and descriptions for a package's
 * components via `react-docgen-typescript`. Best-effort and fail-safe: returns
 * `null` if the engine is absent or anything throws — the caller then keeps the
 * dependency-free table unchanged.
 *
 * Reuses ONE TS program (one `FileParser`) per package — the engine is scoped to
 * the package's tsconfig so it doesn't walk the whole monorepo, and parsing all
 * the package's component files through a single parser shares the program.
 *
 * `docgen` may be a pre-loaded `react-docgen-typescript` module (so the dynamic
 * import is shared across packages by `resolveAllProps`); when omitted it is
 * loaded here (guarded) so this stays usable standalone.
 *
 * @param {string} repoRoot   monorepo root (absolute)
 * @param {string} pkgDir     the package directory (absolute, e.g. <root>/packages/ui)
 * @param {{ name: string, module?: string }[]} components  the package's components (module = repo-relative source path)
 * @param {object} [docgen]   a pre-loaded react-docgen-typescript module (optional)
 * @returns {Promise<Record<string, Record<string, object>> | null>}
 *   map of ComponentName → { propName → { type?, optional?, defaultValue?, description? } }, or null on any failure
 */
export async function resolveProps(repoRoot, pkgDir, components, docgen) {
  if (!repoRoot || !pkgDir || !Array.isArray(components) || components.length === 0) return null;
  if (!docgen) docgen = await loadDocgen();
  if (!docgen || typeof docgen.withCompilerOptions !== "function") return null;

  try {
    const tsconfigPath = findTsconfig(pkgDir);
    const parserOptions = {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      savePropValueAsString: true,
      // BOUND the resolution (#79). Resolving EVERY inherited prop pulls the full
      // `React.HTMLAttributes`/`AriaAttributes`/`DOMAttributes` surface (~250 props
      // per component) — unbounded, that ballooned the manifest to ~30 MB and OOM'd
      // the generator. `propFilter` drops any prop whose declaration lives in
      // `node_modules` (the DOM/aria/React noise + cross-package re-exports), keeping
      // the component's OWN-declared props (resolved type + default + TSDoc) plus any
      // prop declared inside the monorepo source. That is the agent-meaningful surface
      // and it is small + deterministic. A prop with no `parent` (own-declared) is kept.
      propFilter: (prop) =>
        !(prop.parent && /node_modules/.test(String(prop.parent.fileName || ""))),
    };
    const compilerOptions = {
      // A minimal, JSX-capable set — enough for the parser to resolve types
      // without us hand-maintaining the package's full compiler config. The
      // parser still reads the package tsconfig below for path/lib resolution.
      jsx: docgen.ts?.JsxEmit?.React ?? 2,
      allowJs: true,
      esModuleInterop: true,
      skipLibCheck: true,
    };

    const parser = tsconfigPath
      ? docgen.withCustomConfig(tsconfigPath, parserOptions)
      : docgen.withCompilerOptions(compilerOptions, parserOptions);

    // De-dupe source files: many components share a module (flat-file packages).
    const fileToNames = new Map();
    for (const c of components) {
      if (!c?.module || !c?.name) continue;
      const abs = join(repoRoot, c.module);
      if (!existsSync(abs)) continue;
      if (!fileToNames.has(abs)) fileToNames.set(abs, new Set());
      fileToNames.get(abs).add(c.name);
    }
    if (fileToNames.size === 0) return null;

    const byComponent = {};
    for (const [abs, wantedNames] of fileToNames) {
      let parsed;
      try {
        parsed = parser.parse(abs);
      } catch {
        // A single un-parseable file must not abort the whole package — skip it.
        continue;
      }
      for (const comp of parsed || []) {
        // Only record components this package actually exports (by name) — the
        // parser may surface internal/helper components in the same file.
        if (!comp?.displayName || !wantedNames.has(comp.displayName)) continue;
        const propsOut = {};
        const propEntries = Object.entries(comp.props || {}).sort(([a], [b]) => a.localeCompare(b));
        for (const [propName, prop] of propEntries) {
          const norm = normalizeProp(prop, repoRoot);
          if (Object.keys(norm).length) propsOut[propName] = norm;
        }
        if (Object.keys(propsOut).length) byComponent[comp.displayName] = propsOut;
      }
    }

    return Object.keys(byComponent).length ? byComponent : null;
  } catch {
    // Any failure in the engine (a bad tsconfig, an OOM on a huge program, an
    // API shape change) falls back to the dependency-free table. NEVER crash.
    return null;
  }
}

/**
 * Additively merge a resolved prop map (from `resolveProps`) into the existing
 * dependency-free prop table (from `collectProps`/`extractPropTable`), in place.
 *
 * Rules (strictly additive — never lose information the regex extractor found):
 *   - Existing own-declared props: fill in `defaultValue` (regex never has it),
 *     and `description` ONLY when the regex extractor produced none. Keep the
 *     regex `type`/`optional` (its raw source text is the authored surface).
 *   - Inherited props (present in the resolved map but NOT own-declared): add
 *     them under `table.resolved` so an agent sees the expanded inherited
 *     surface without us mutating the own-declared list or the schema shape.
 *
 * Returns the same `table` object (mutated) for convenience.
 *
 * @param {{ extends: string[], props: {name:string,optional:boolean,type:string,description?:string}[], resolved?: object }} table
 * @param {Record<string, object>} resolvedMap  propName → resolved fields
 */
export function mergeResolvedProps(table, resolvedMap) {
  if (!table || !resolvedMap || typeof resolvedMap !== "object") return table;
  const ownNames = new Set((table.props || []).map((p) => p.name));

  // 1) Enrich own-declared props in place (defaultValue + description only).
  for (const prop of table.props || []) {
    const res = resolvedMap[prop.name];
    if (!res) continue;
    if (res.defaultValue !== undefined && prop.defaultValue === undefined) {
      prop.defaultValue = res.defaultValue;
    }
    if (res.description && !prop.description) {
      prop.description = res.description;
    }
  }

  // 2) Record resolved INHERITED props (everything not own-declared) under a
  //    separate `resolved` map — additive, schema-stable, deterministic order.
  const inherited = {};
  for (const name of Object.keys(resolvedMap).sort((a, b) => a.localeCompare(b))) {
    if (ownNames.has(name)) continue;
    inherited[name] = resolvedMap[name];
  }
  if (Object.keys(inherited).length) {
    table.resolved = { ...(table.resolved || {}), ...inherited };
  }

  return table;
}

/**
 * Orchestrate the docgen pass across the whole monorepo: load the engine ONCE,
 * then resolve props per `@qlik-coe-emea/qlabs-components-*` package. Returns a map keyed by package name
 * (`@qlik-coe-emea/qlabs-components-ui` → { ComponentName → { propName → resolvedFields } }) — or `null`
 * if the engine is absent (the no-dep floor) or nothing resolved.
 *
 * `generateManifest` passes the returned map back into itself (as the `resolved`
 * option) so the merge is purely additive and the SYNC manifest path is unchanged
 * when this returns null. This is the one place the dynamic import happens, so a
 * missing `react-docgen-typescript` is a single clean no-op for the whole run.
 *
 * @param {string} repoRoot  monorepo root (absolute)
 * @returns {Promise<Record<string, Record<string, Record<string, object>>> | null>}
 */
export async function resolveAllProps(repoRoot) {
  if (!repoRoot) return null;
  const docgen = await loadDocgen();
  if (!docgen) return null; // dep absent → identical-to-today manifest (the floor)

  const pkgsDir = join(repoRoot, "packages");
  let entries;
  try {
    entries = readdirSync(pkgsDir);
  } catch {
    return null;
  }

  const byPackage = {};
  for (const entry of entries) {
    const pkgDir = join(pkgsDir, entry);
    const pkgJsonPath = join(pkgDir, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    let name;
    try {
      name = JSON.parse(readFileSync(pkgJsonPath, "utf8")).name;
    } catch {
      continue;
    }
    if (!name || !name.startsWith("@qlik-coe-emea/qlabs-components-") || CONFIG_PKGS.has(name))
      continue;

    // Discover the package's exported components the same way the manifest does:
    // walk the root barrel for `value` exports starting with an uppercase letter.
    const components = discoverComponents(repoRoot, pkgDir);
    if (!components.length) continue;

    let resolved;
    try {
      resolved = await resolveProps(repoRoot, pkgDir, components, docgen);
    } catch {
      resolved = null; // one package failing must not abort the others
    }
    if (resolved && Object.keys(resolved).length) byPackage[name] = resolved;
  }

  return Object.keys(byPackage).length ? byPackage : null;
}

/**
 * Lightweight component discovery for the docgen orchestrator: the root barrel's
 * uppercase `value` exports + their source module (repo-relative). Deliberately
 * small and self-contained — it must agree with the manifest's component set
 * (same predicate) but should not import core.mjs's internals; a near-empty or
 * mismatched list just means fewer resolutions, never a crash.
 */
function discoverComponents(repoRoot, pkgDir) {
  const seen = new Set();
  const out = [];
  const visit = (file, depth = 0) => {
    if (!file || seen.has(file) || depth > 3 || !existsSync(file)) return;
    seen.add(file);
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      return;
    }
    const dir = file.slice(0, file.lastIndexOf("/"));
    const modRel = file.replace(repoRoot + "/", "");
    const resolveRel = (rel) => {
      const base = join(dir, rel);
      for (const c of [
        base + ".tsx",
        base + ".ts",
        join(base, "index.tsx"),
        join(base, "index.ts"),
      ])
        if (existsSync(c)) return c;
      return null;
    };
    // export * from "./x"
    for (const m of src.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g))
      visit(resolveRel(m[1]), depth + 1);
    // export { A, B as C } from "./x"
    for (const m of src.matchAll(/export\s+\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const target = resolveRel(m[2]);
      const targetRel = target ? target.replace(repoRoot + "/", "") : modRel;
      for (const raw of m[1].split(",")) {
        const s = raw.trim();
        if (!s || /^type\b/.test(s)) continue;
        const asM = s.match(/\bas\s+([A-Za-z0-9_$]+)/);
        const nm = (asM ? asM[1] : s).replace(/\s+/g, "");
        if (/^[A-Z][A-Za-z0-9_$]*$/.test(nm)) out.push({ name: nm, module: targetRel });
      }
    }
    // export const/function/class X
    for (const m of src.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z0-9_$]+)/g)) {
      if (/^[A-Z]/.test(m[1])) out.push({ name: m[1], module: modRel });
    }
  };
  visit(resolveRel(pkgDir));

  // De-dupe by name (first module wins, matching barrel-precedence well enough).
  const byName = new Map();
  for (const c of out) if (!byName.has(c.name)) byName.set(c.name, c);
  return [...byName.values()];
}

/** Resolve `<pkgDir>/src/index.{tsx,ts}` (the root barrel). */
function resolveRel(pkgDir) {
  for (const c of [join(pkgDir, "src", "index.tsx"), join(pkgDir, "src", "index.ts")])
    if (existsSync(c)) return c;
  return null;
}
