#!/usr/bin/env node
/**
 * gen-registry.mjs — derive `registry/registry.json` from the block source.
 *
 * WHY: the manifest used to be hand-written, so it could disagree with the
 * files it describes and nothing noticed. It did. `sidebar-02` declared
 * `registryDependencies: ["avatar","button","collapsible","dropdown-menu",
 * "sidebar"]` — copied verbatim from shadcn's own sidebar-02 — while its files
 * import none of them, so `shadcn add sidebar-02` installed five primitives the
 * copied code never uses. A `registry:ui` `button` item shadowed the upstream
 * shadcn name with a stale fork of `@elabs/components-ui`'s Button. Both are
 * the same class of bug: a hand-maintained description of code that drifted
 * from the code.
 *
 * So identity and prose are AUTHORED in `registry/registry.items.json`
 * (name / type / title / description / root / categories), and everything that
 * is a fact ABOUT the source is DERIVED here:
 *
 *   - `files[]`          — walking the item's `root`
 *   - `files[].target`   — the source tree MIRRORS the install tree, so a
 *                          file's target is `components/<item>/<path-from-root>`
 *                          (an item may override per file, e.g. a `registry:page`)
 *   - `dependencies`     — the bare import specifiers its files actually use
 *   - `registryDependencies` — the `@/components/<item>/…` imports its files
 *                          actually make, resolved against the other items
 *
 * The mirrored layout is load-bearing. `scripts/check-registry-resolve.mjs`
 * resolves every RELATIVE import against both the repo tree and the install
 * tree, and it builds the install tree from one item's own targets — so a
 * relative import may never cross an item boundary. Cross-item references go
 * through the `@/` alias instead (shadcn rewrites it to the consumer's alias;
 * the resolve gate ignores non-relative specifiers). `apps/docs` maps the same
 * alias to `registry/blocks` so Storybook renders the shipped file.
 *
 * Usage:
 *   node scripts/gen-registry.mjs           write registry/registry.json
 *   node scripts/gen-registry.mjs --check   fail if it is stale
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ITEMS_PATH = join(REPO_ROOT, "registry/registry.items.json");
const OUT_PATH = join(REPO_ROOT, "registry/registry.json");

const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";
const ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";

/** Files that document or test a block — never part of what a consumer installs. */
const EXCLUDED_FILE_RE = /\.(stories|test|spec)\.(ts|tsx|js|jsx)$/;

/**
 * Bare specifiers every consumer already has, so listing them as a dependency
 * would be noise. Deliberately short: anything else a block imports is
 * something the consumer must actually install.
 */
const AMBIENT_PACKAGES = new Set(["react", "react-dom"]);

/** `from "x"` / `import("x")` / `require("x")` / bare `import "x"`. */
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']/g;

const BRAND_SCOPE = "@elabs/";

/**
 * Map every `@elabs/*` package name to its declared peerDependencies, read from
 * the workspace manifests. A block that imports `@elabs/components-editor` does
 * not work unless the consumer also installs that package's peers — they are
 * not transitive installs, that is what "peer" means — so the registry item has
 * to name them even though no copied file imports them directly.
 */
export function readBrandPeers(
  root = REPO_ROOT,
  { readDir = readdirSync, readFile = (p) => readFileSync(p, "utf8") } = {},
) {
  const peers = new Map();
  const packagesDir = join(root, "packages");
  if (!existsSync(packagesDir)) return peers;
  for (const entry of readDir(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = join(packagesDir, entry.name, "package.json");
    if (!existsSync(manifest)) continue;
    try {
      const pkg = JSON.parse(readFile(manifest));
      if (pkg.name?.startsWith(BRAND_SCOPE))
        peers.set(pkg.name, Object.keys(pkg.peerDependencies ?? {}));
    } catch {
      /* a malformed manifest is `pnpm install`'s problem, not this gate's */
    }
  }
  return peers;
}

/**
 * Close a dependency set over the `@elabs/*` peer graph. Only BRAND peers are
 * added automatically: they are unconditional (nothing renders without
 * `-tokens`/`-ui`). A third-party peer like `monaco-editor` or `@xyflow/react`
 * is conditional on what the block actually renders, so it stays a judgment the
 * item declares via `extraDependencies` — or reaches the list by being imported.
 */
export function withBrandPeers(dependencies, brandPeers) {
  const out = new Set(dependencies);
  const queue = [...dependencies];
  while (queue.length > 0) {
    const dep = queue.shift();
    for (const peer of brandPeers.get(dep) ?? []) {
      if (!peer.startsWith(BRAND_SCOPE) || out.has(peer)) continue;
      out.add(peer);
      queue.push(peer);
    }
  }
  return [...out].sort();
}

/** Recursively collect an item's installable files, repo-relative and sorted. */
export function collectFiles(rootAbs, { readDir = readdirSync, stat = statSync } = {}) {
  const out = [];
  const walk = (dirAbs) => {
    for (const entry of readDir(dirAbs, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (entry.name.startsWith(".")) continue;
      const abs = join(dirAbs, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (!EXCLUDED_FILE_RE.test(entry.name) && stat(abs).isFile()) out.push(abs);
    }
  };
  walk(rootAbs);
  return out.sort();
}

/** Every import specifier in a source file, in source order. */
export function extractImports(source) {
  return [...source.matchAll(IMPORT_RE)].map((m) => m[1]);
}

/** Normalize a bare specifier to its installable package name (`a/b/c` → `a`). */
export function packageRoot(spec) {
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Split an item's imports into the npm packages it needs and the sibling
 * registry items it references through the `@/components/<item>/…` alias.
 */
export function classifyImports(specs, knownItems, selfName) {
  const dependencies = new Set();
  const registryDependencies = new Set();

  for (const spec of specs) {
    if (spec.startsWith(".")) continue; // intra-item; the resolve gate owns these
    if (spec.startsWith("node:")) continue;

    if (spec.startsWith("@/components/")) {
      const item = spec.slice("@/components/".length).split("/")[0];
      if (item && item !== selfName && knownItems.has(item)) registryDependencies.add(item);
      continue;
    }
    if (spec.startsWith("@/")) continue; // some other consumer-side alias

    const pkg = packageRoot(spec);
    if (!AMBIENT_PACKAGES.has(pkg)) dependencies.add(pkg);
  }

  return {
    dependencies: [...dependencies].sort(),
    registryDependencies: [...registryDependencies].sort(),
  };
}

/** Repo-relative POSIX path. */
const rel = (abs) => relative(REPO_ROOT, abs).split(sep).join(posix.sep);

/** Build one shadcn registry item from its authored entry + its source files. */
export function buildItem(
  authored,
  knownItems,
  { readFile = (p) => readFileSync(p, "utf8"), brandPeers = new Map() } = {},
) {
  const rootAbs = join(REPO_ROOT, authored.root);
  if (!existsSync(rootAbs))
    throw new Error(`item "${authored.name}": root not found: ${authored.root}`);

  const overrides = authored.fileOverrides ?? {};
  const specs = [];
  const files = collectFiles(rootAbs).map((abs) => {
    const fromRoot = relative(rootAbs, abs).split(sep).join(posix.sep);
    const override = overrides[fromRoot] ?? {};
    specs.push(...extractImports(readFile(abs)));
    return {
      path: rel(abs),
      type: override.type ?? "registry:component",
      target: override.target ?? posix.join("components", authored.name, fromRoot),
    };
  });

  if (files.length === 0)
    throw new Error(`item "${authored.name}": no installable files under ${authored.root}`);

  const { dependencies, registryDependencies } = classifyImports(specs, knownItems, authored.name);
  const allDependencies = withBrandPeers(
    [...dependencies, ...(authored.extraDependencies ?? [])],
    brandPeers,
  );

  return {
    $schema: ITEM_SCHEMA,
    name: authored.name,
    type: authored.type,
    title: authored.title,
    description: authored.description,
    ...(registryDependencies.length > 0 ? { registryDependencies } : {}),
    ...(allDependencies.length > 0 ? { dependencies: allDependencies } : {}),
    files,
    ...(authored.categories ? { categories: authored.categories } : {}),
  };
}

/** Render the whole registry from the authored sidecar. */
export function renderRegistry(authoredRegistry, deps = {}) {
  const knownItems = new Set(authoredRegistry.items.map((i) => i.name));
  const brandPeers = deps.brandPeers ?? readBrandPeers();
  return {
    $schema: REGISTRY_SCHEMA,
    name: authoredRegistry.name,
    // The shadcn CLI requires `homepage` on a ROOT registry (`shadcn build` refuses
    // without it). It is a published-location fact, not something derivable from
    // the source, so it is authored — and omitted rather than invented while this
    // repo has no canonical public URL.
    ...(authoredRegistry.homepage ? { homepage: authoredRegistry.homepage } : {}),
    items: authoredRegistry.items.map((item) =>
      buildItem(item, knownItems, { ...deps, brandPeers }),
    ),
  };
}

function main() {
  const check = process.argv.includes("--check");

  if (!existsSync(ITEMS_PATH)) {
    console.error(`✖ authored registry source not found: ${rel(ITEMS_PATH)}`);
    process.exit(1);
  }

  const authored = JSON.parse(readFileSync(ITEMS_PATH, "utf8"));
  const next = JSON.stringify(renderRegistry(authored), null, 2) + "\n";
  const existing = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, "utf8") : "";

  // Compare parsed values, not bytes — Prettier reflows the committed file.
  const same =
    existing !== "" && JSON.stringify(JSON.parse(existing)) === JSON.stringify(JSON.parse(next));

  if (check) {
    if (!same) {
      console.error(
        "✖ registry/registry.json is STALE — it disagrees with the block source.\n" +
          "  Run `pnpm gen:registry` and commit the result.\n" +
          "  `files`, `dependencies` and `registryDependencies` are derived; author\n" +
          "  name/title/description/root in registry/registry.items.json instead.",
      );
      process.exit(1);
    }
    console.log(`✔ registry/registry.json is fresh (${authored.items.length} items).`);
    return;
  }

  writeFileSync(OUT_PATH, next);
  console.log(`✔ registry/registry.json written — ${authored.items.length} items.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
