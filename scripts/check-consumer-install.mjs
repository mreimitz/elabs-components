#!/usr/bin/env node
/**
 * check-consumer-install.mjs — the published-artifact gate.
 *
 * WHY THIS EXISTS: nothing else in the repo consumes `dist/`. Every app and
 * every gate resolves `@elabs-ai/components-*` to TypeScript SOURCE through the `exports` map
 * (the Turborepo just-in-time-package pattern), while external consumers get
 * `publishConfig.exports` → `dist/`. That blind spot hid four real defects at
 * once: stripped "use client" directives, fonts copied one level too deep,
 * esbuild-orphaned stylesheets, and a subpath still pointing at raw `.ts`.
 *
 * So this gate does what a consumer does, for real:
 *
 *   1. `pnpm pack` every distributable package (which applies publishConfig and
 *      rewrites `workspace:*` to concrete versions, exactly like publishing).
 *   2. Copy fixtures/consumer-smoke/ to a temp dir OUTSIDE the workspace and
 *      point each @elabs-ai/components-* dependency at its tarball.
 *   3. `pnpm install` then `vite build`.
 *   4. Assert the installed artifact is actually usable (see CHECKS below).
 *
 * A failure here means the tarball is broken for every downstream project —
 * treat it as release-blocking.
 *
 * Flags:
 *   --keep    leave the temp workspace on disk and print the path (debugging).
 *   --quiet   suppress child-process output; only print the verdict.
 *
 * Dependency-free; ESM; cwd-independent.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const FIXTURE = join(REPO_ROOT, "fixtures", "consumer-smoke");

const argv = process.argv.slice(2);
const KEEP = argv.includes("--keep");
const QUIET = argv.includes("--quiet");

const log = (m) => console.log(m);
const run = (cmd, args, cwd, extraEnv) =>
  execFileSync(cmd, args, {
    cwd,
    stdio: QUIET ? "pipe" : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });

/**
 * The fixture bundles every package at once, so its module graph carries Monaco,
 * MapLibre, mermaid, shiki, visx and Milkdown together. That exceeded Node's
 * default heap on a 7 GB GitHub runner ("Ineffective mark-compacts near heap
 * limit") while passing on a dev machine — a gate whose result depends on which
 * machine runs it is worthless, so raise the ceiling explicitly. Paired with
 * minify:false in the fixture's vite config, which is the real memory peak.
 */
const BUILD_ENV = {
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=4096"].filter(Boolean).join(" "),
};

/**
 * Packages that ship to consumers: anything under packages/ declaring
 * `publishConfig.exports`. Derived, never hard-coded, so a new package is
 * covered the day it is added and a rename can't silently drop one.
 *
 * DELIBERATELY NARROWER than the release predicate in
 * `scripts/lib/distributables.mjs` (`publishConfig || !private`, #295): this gate
 * installs each tarball into a throwaway Vite app and imports from it, so it only
 * covers packages that expose a consumer IMPORT surface. `@elabs-ai/components-cli`
 * publishes (it is on the release train and gets packed, published and version-bumped
 * like the rest) but ships a `bin`, not `publishConfig.exports` — there is nothing for
 * the smoke app to import, so it is out of scope here by design, not by drift.
 */
export function distributablePackages(
  packagesDir,
  readJson = (p) => JSON.parse(readFileSync(p, "utf8")),
) {
  const out = [];
  for (const name of readdirSync(packagesDir)) {
    const pj = join(packagesDir, name, "package.json");
    if (!existsSync(pj)) continue;
    const json = readJson(pj);
    if (!json.publishConfig?.exports) continue;
    out.push({ dir: join(packagesDir, name), name: json.name, version: json.version });
  }
  return out;
}

/** `@elabs-ai/components-ui` @ 1.9.0 → `brand-ui-1.9.0.tgz` (pnpm's pack naming). */
export function tarballName(pkgName, version) {
  return `${pkgName.replace(/^@/, "").replace(/\//g, "-")}-${version}.tgz`;
}

/**
 * Rewrite each distributable dependency to its packed tarball. Everything else
 * (react, vite, tailwind…) resolves from the registry like a real consumer's.
 */
export function pinToTarballs(pkgJson, packed) {
  const deps = { ...pkgJson.dependencies };
  const missing = [];
  for (const key of Object.keys(deps)) {
    const hit = packed.find((p) => p.name === key);
    if (hit) deps[key] = `file:${hit.tarball}`;
    else if (key.startsWith("@elabs-ai/components-")) missing.push(key);
  }
  return { pkgJson: { ...pkgJson, dependencies: deps }, missing };
}

// ─────────────────────────────── CHECKS ───────────────────────────────────────

/** Client packages must carry the directive; server-safe leaves must not. */
export function checkUseClient(modules, violations) {
  const mustHave = [
    "@elabs-ai/components-tokens/dist/index.js",
    "@elabs-ai/components-ui/dist/index.js",
    "@elabs-ai/components-data/dist/index.js",
    "@elabs-ai/components-ai/dist/index.js",
    "@elabs-ai/components-flow/dist/index.js",
    "@elabs-ai/components-maps/dist/index.js",
    "@elabs-ai/components-charts/dist/index.js",
    "@elabs-ai/components-editor/dist/index.js",
    "@elabs-ai/components-viewer/dist/index.js",
  ];
  const mustNotHave = [
    "@elabs-ai/components-ui/dist/lib/cn.js",
    "@elabs-ai/components-editor/dist/markdown/parse.js",
    "@elabs-ai/components-editor/dist/markdown/frontmatter.js",
    "@elabs-ai/components-icons/dist/index.js",
    "@elabs-ai/components-marketing/dist/index.js",
  ];

  for (const rel of mustHave) {
    const f = join(modules, rel);
    if (!existsSync(f)) continue; // an absent package is reported by the exports check
    if (!/^\s*["']use client["']/.test(readFileSync(f, "utf8"))) {
      violations.push({
        rule: "missing-use-client",
        detail: `${rel} has no "use client" directive — every RSC/Next consumer breaks on the first hook`,
      });
    }
  }
  for (const rel of mustNotHave) {
    const f = join(modules, rel);
    if (!existsSync(f)) continue;
    if (/^\s*["']use client["']/.test(readFileSync(f, "utf8"))) {
      violations.push({
        rule: "spurious-use-client",
        detail: `${rel} is marked "use client" but is a pure/server-safe leaf — it must stay callable from a server component`,
      });
    }
  }
}

/** Every publishConfig export target must exist in the INSTALLED package. */
export function checkExportsResolve(modules, packed, violations) {
  for (const { name } of packed) {
    const installed = join(modules, name);
    const pj = join(installed, "package.json");
    if (!existsSync(pj)) {
      violations.push({ rule: "package-not-installed", detail: `${name} is not in node_modules` });
      continue;
    }
    const json = JSON.parse(readFileSync(pj, "utf8"));
    // pack already applied publishConfig, so `exports` IS the published map.
    const walk = (node, keyPath) => {
      if (typeof node === "string") {
        if (!existsSync(join(installed, node))) {
          violations.push({
            rule: "unresolved-export",
            detail: `${name} exports "${keyPath}" -> ${node}, which is not in the tarball (ERR_PACKAGE_PATH_NOT_EXPORTED for consumers)`,
          });
        }
        return;
      }
      if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) walk(v, keyPath === "" ? k : `${keyPath}.${k}`);
      }
    };
    walk(json.exports ?? {}, "");
  }
}

/** Every relative url() in the installed token CSS must resolve (the fonts bug). */
export function checkFontAssets(modules, violations) {
  const css = join(modules, "@elabs-ai/components-tokens/dist/themes.css");
  if (!existsSync(css)) return;
  const text = readFileSync(css, "utf8");
  const base = dirname(css);
  for (const m of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)')\s*\)/g)) {
    const ref = (m[1] ?? m[2] ?? "").replace(/[?#].*$/, "");
    if (!ref.startsWith(".")) continue;
    if (!existsSync(resolve(base, ref))) {
      violations.push({
        rule: "unresolved-font",
        detail: `@elabs-ai/components-tokens themes.css references ${ref}, which is not in the tarball — text silently falls back`,
      });
    }
  }
}

/**
 * A context-carrying engine resolved at two different VERSIONS is a broken app.
 *
 * Counting directories is wrong: pnpm's isolated layout legitimately materialises
 * the same version many times under `.pnpm/`. What actually breaks `useReactFlow`
 * or `globalThis.MonacoEnvironment` is two *distinct versions* being live — which
 * is exactly what @elabs-ai/components-flow's ^12.11.1 vs @elabs-ai/components-ai's ^12.3.6 could produce.
 *
 * Searches the layouts real installers produce, rather than walking everything:
 *   <modules>/<dep>                       hoisted / top level
 *   <modules>/.pnpm/<key>/node_modules/<dep>   pnpm isolated
 *   <modules>/<pkg>/node_modules/<dep>     npm/yarn nesting (incl. scoped pkgs)
 */
export function checkSingletons(modules, violations) {
  const versionAt = (dir) => {
    const pj = join(dir, "package.json");
    if (!existsSync(pj)) return null;
    try {
      return JSON.parse(readFileSync(pj, "utf8")).version ?? "unknown";
    } catch {
      return "unknown";
    }
  };
  const dirsIn = (dir) => {
    if (!existsSync(dir)) return [];
    try {
      return readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      return [];
    }
  };

  // Every directory that could host a node_modules containing the dep.
  const hosts = [modules];
  for (const key of dirsIn(join(modules, ".pnpm"))) {
    hosts.push(join(modules, ".pnpm", key, "node_modules"));
  }
  for (const name of dirsIn(modules)) {
    if (name === ".pnpm") continue;
    if (name.startsWith("@")) {
      for (const inner of dirsIn(join(modules, name))) {
        hosts.push(join(modules, name, inner, "node_modules"));
      }
    } else {
      hosts.push(join(modules, name, "node_modules"));
    }
  }

  for (const dep of ["@xyflow/react", "maplibre-gl", "monaco-editor"]) {
    const versions = new Map(); // version -> example path
    for (const host of hosts) {
      const candidate = join(host, dep);
      const v = versionAt(candidate);
      if (v && !versions.has(v)) versions.set(v, candidate);
    }
    if (versions.size > 1) {
      violations.push({
        rule: "duplicate-singleton",
        detail:
          `${dep} resolved at ${versions.size} different versions (${[...versions.keys()].join(", ")}) — ` +
          `it owns a global/React context, so two live copies break at runtime`,
      });
    }
  }
}

// ──────────────────────────────── CLI ─────────────────────────────────────────
function main() {
  if (!existsSync(FIXTURE)) {
    console.error(`✖ consumer-install: missing fixture at ${FIXTURE}`);
    return 1;
  }

  const packages = distributablePackages(join(REPO_ROOT, "packages"));
  if (packages.length === 0) {
    console.error("✖ consumer-install: no distributable packages found (publishConfig.exports).");
    return 1;
  }

  const work = mkdtempSync(join(tmpdir(), "brand-ui-consumer-"));
  const tarDir = join(work, "tarballs");
  const app = join(work, "app");

  try {
    log(`• packing ${packages.length} package(s) …`);
    const packed = packages.map(({ dir, name, version }) => {
      run("pnpm", ["pack", "--pack-destination", tarDir], dir);
      const tarball = join(tarDir, tarballName(name, version));
      if (!existsSync(tarball)) throw new Error(`pack produced no ${tarball} for ${name}`);
      return { name, version, tarball };
    });

    log("• installing the tarballs into a throwaway app …");
    cpSync(FIXTURE, app, { recursive: true });
    const fixturePkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8"));
    const { pkgJson, missing } = pinToTarballs(fixturePkg, packed);
    if (missing.length > 0) {
      console.error(
        `✖ consumer-install: fixture depends on unpacked package(s): ${missing.join(", ")}`,
      );
      return 1;
    }
    // Pin the SAME package manager the repo pins. Without this the fixture picks
    // up whatever pnpm is on PATH (a machine here had 11.8.0 while the repo pins
    // 9.15.4), and newer pnpm turns "ignored build scripts" into a non-zero exit
    // — a gate that fails or passes based on the developer's shell is worthless.
    // Injected rather than hard-coded so it can never drift from the root.
    const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
    if (rootPkg.packageManager) pkgJson.packageManager = rootPkg.packageManager;

    writeFileSync(join(app, "package.json"), JSON.stringify(pkgJson, null, 2) + "\n");
    // An isolated store-linked install: no workspace, no root .npmrc hoisting.
    writeFileSync(join(app, ".npmrc"), "node-linker=isolated\n");
    run("pnpm", ["install", "--ignore-workspace", "--no-frozen-lockfile"], app);

    log("• building it with Vite …");
    run("pnpm", ["build"], app, BUILD_ENV);

    log("• inspecting the installed artifact …");
    const modules = join(app, "node_modules");
    const violations = [];
    checkExportsResolve(modules, packed, violations);
    checkUseClient(modules, violations);
    checkFontAssets(modules, violations);
    checkSingletons(modules, violations);

    if (violations.length > 0) {
      console.error("\n✖ consumer-install: the packed artifact is broken for consumers:");
      for (const v of violations) console.error(`  ${v.rule}: ${v.detail}`);
      console.error(
        "\n  These only reproduce through dist/ — the workspace resolves src/, so\n" +
          "  typecheck/test/build all stay green while consumers are broken.",
      );
      return 1;
    }

    log(
      `\n✔ consumer-install: ${packed.length} packed package(s) install, build with Vite, and pass\n` +
        "  the artifact checks (exports resolve, use-client boundaries correct, fonts\n" +
        "  present, no duplicated singleton engines).",
    );
    return 0;
  } catch (err) {
    console.error(`\n✖ consumer-install: ${err.message}`);
    return 1;
  } finally {
    if (KEEP) log(`\n  temp workspace kept at ${work}`);
    else rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main());
}
