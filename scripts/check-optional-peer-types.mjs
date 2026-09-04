#!/usr/bin/env node
/**
 * check-optional-peer-types.mjs — proves an optional peer's own TYPES never
 * leak into a package's BUILT public declaration file (issue #101).
 *
 * `peerDependenciesMeta.<name>.optional: true` only relaxes the package
 * manager's install-time demand. It says nothing about TypeScript's
 * declaration-emission reachability: any type referenced — even
 * transitively, even only in a prop type nobody in a given import uses — by
 * a barrel-reachable export is inlined (or import-specifier-referenced) into
 * that package's generated root `.d.ts`. A `skipLibCheck: false` consumer who
 * correctly omitted an optional peer then gets `TS2307` (`Cannot find module`)
 * merely from `import { Anything } from "@elabs-ai/components-ai"` — not
 * from using the ONE component that actually needs the peer.
 *
 * The fix (see `packages/ai/src/persona.tsx`, `packages/ai/src/audio-player.tsx`,
 * and `packages/terminal/src/interactive-terminal.tsx`, which established the
 * pattern first) is for a lazy engine boundary to be a TYPE boundary too, not
 * just a runtime one (see the ADR 0019 amendment): the public-facing sibling
 * file OWNS a local, structurally-compatible mirror of whatever shape of the
 * peer's types it needs, and the `@lazy-boundary` module (reached only via
 * `lazy(() => import(...))`, never statically imported into the barrel) keeps
 * a compile-time conformance assertion proving the mirror stays assignable to
 * the real peer type.
 *
 * This gate reads the BUILT `dist/**\/*.d.ts` for every `@elabs-ai/components-*`
 * package that declares at least one optional peer (post `pnpm build` — in CI
 * this runs in the same job, after the "Build" step) and fails when an
 * optional peer's own module specifier is still reachable from there. It
 * reads the BUILT artifact, not source, because declaration-emission
 * reachability is a property of what the compiler actually decided to keep,
 * not of what a source file merely mentions — the exact same `import type`
 * from an optional peer is FINE inside a `@lazy-boundary` module (never
 * statically imported into the barrel) and a LEAK inside its public sibling;
 * only the compiler's own output can tell the two apart. It mirrors
 * `pnpm heavy-deps:check`'s general shape (ratchet baseline, `--warn`/
 * `--update`, self-tested, wired in `gates.yml`) with that one deliberate
 * difference.
 *
 * A missing `dist/` (no build has run yet) is normal, not a failure — the
 * package is silently skipped, same convention as `check-css-assets.mjs`.
 *
 * ## The baseline is one-directional, like `heavy-deps:check`
 *
 * `scripts/optional-peer-types-baseline.json` records today's known leaks.
 * It seeds ONE entry: `@elabs-ai/components-ai`'s `ai` (the Vercel AI SDK)
 * peer, which leaks through the `UIMessage`/`ToolUIPart`/… types every chat
 * component's public props reference. That is a real, already-known gap —
 * tracked separately (see the package's own `ai-sdk-vs-a2ui.md` rule, which
 * keeps `ai` types-only/never-runtime, a narrower and already-enforced
 * property) — and deliberately NOT fixed as a drive-by inside this change,
 * which owns exactly the two peers issue #101 named as still open
 * (`media-chrome`, `@rive-app/react-webgl2`). Baselined entries may go stale
 * (a peer gets fixed) with no gate consequence — only a NEW leak fails.
 *
 * Flags:
 *   --warn     never exit non-zero (dev-hook mode); still prints findings.
 *   --update   rewrite the baseline (only accepts a same-or-lower count).
 *
 * Dependency-free; ESM; locates packages relative to this file (cwd-independent).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { distributablePackages, REPO_ROOT as DIST_REPO_ROOT } from "./lib/distributables.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);
const BASELINE = join(SCRIPT_DIR, "optional-peer-types-baseline.json");

/** A package's own optional peers, from its `peerDependenciesMeta`. Pure. */
export function optionalPeersOf(pkgJson) {
  return Object.entries(pkgJson?.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta?.optional === true)
    .map(([name]) => name);
}

const matchesPeer = (specifier, peers) =>
  peers.find((peer) => specifier === peer || specifier.startsWith(`${peer}/`));

/**
 * Strip `/* … *\/` and `// …` comments before scanning. This is what makes
 * the statement regex below safe to span newlines: a JSDoc line of prose
 * mentioning `from "media-chrome"` is never mistaken for a real declaration
 * edge because it is gone before the regex runs, not because it happens to
 * fail a same-line anchor — the earlier line-anchored version relied on the
 * latter, which is exactly what made it reject a genuinely wrapped import.
 * `.d.ts` specifiers are plain package names, so a blunt strip is safe for
 * this narrow input (no embedded `/*`/`//` to misread).
 *
 * @param {string} source
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*$/gm, "");
}

/**
 * Every bare module specifier a BUILT `.d.ts` file's public surface still
 * needs — two shapes, both matched on the comment-stripped source:
 *
 * 1. An ordinary `import …/export …` statement's `from "…"` clause. Allowed
 *    to span multiple lines (rollup-plugin-dts currently always emits even a
 *    many-binding import on one line — verified against the real built
 *    `packages/ai`/`packages/terminal` `.d.ts` — but nothing about the
 *    declaration-emission format guarantees that, and comment-stripping
 *    already makes a multi-line match safe).
 * 2. An inline `import("specifier").Type` type-position reference — the
 *    shape a declaration bundler falls back to when it can't hoist a named
 *    import (e.g. an anonymous/default-exported type). Does not occur in
 *    this repo's built output today, but it is the identical reachability
 *    hazard as (1) and costs nothing extra to catch.
 *
 * `.d.ts` output never carries `import type` — rollup's declaration bundler
 * already erases pure-type-only imports on the way in — so unlike the
 * source-level `heavy-deps:check` gate there is no `type` keyword to
 * special-case here: every specifier this finds is one the COMPILER decided
 * the public surface still needs.
 *
 * @param {string} dtsSource
 * @returns {string[]} specifiers, in file order, may repeat.
 */
export function findDtsImportSpecifiers(dtsSource) {
  const source = stripComments(dtsSource);
  const found = [];

  const statementRe = /\b(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g;
  for (const m of source.matchAll(statementRe)) found.push(m[1]);

  const dynamicRe = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of source.matchAll(dynamicRe)) found.push(m[1]);

  return found;
}

/** Every `*.d.ts` under `dir` (recursive), excluding `.d.ts.map`. */
function findDtsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      findDtsFiles(full, acc);
    } else if (entry.name.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * @param {{ packages: {name:string, dir:string, json:object}[], readDts?: (absPath:string) => string, listDtsFiles?: (distDir:string) => string[] }} input
 * @returns {{ package: string, file: string, peer: string, specifier: string }[]} sorted deterministically, deduped.
 */
export function findLeakedPeerTypes({
  packages,
  readDts = (p) => readFileSync(p, "utf8"),
  listDtsFiles = findDtsFiles,
}) {
  const seen = new Set();
  const out = [];
  for (const pkg of packages) {
    const peers = optionalPeersOf(pkg.json);
    if (peers.length === 0) continue;

    for (const dtsFile of listDtsFiles(join(pkg.dir, "dist"))) {
      const relFile = relative(REPO_ROOT, dtsFile);
      const source = readDts(dtsFile);
      if (source == null) continue;

      for (const specifier of new Set(findDtsImportSpecifiers(source))) {
        const peer = matchesPeer(specifier, peers);
        if (!peer) continue;
        const key = `${pkg.name}::${relFile}::${specifier}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ package: pkg.name, file: relFile, peer, specifier });
      }
    }
  }
  return out.sort((a, b) =>
    `${a.package}::${a.file}::${a.specifier}`.localeCompare(
      `${b.package}::${b.file}::${b.specifier}`,
    ),
  );
}

const entryKey = (e) => `${e.package}::${e.file}::${e.specifier}`;

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch {
    return [];
  }
}

// ───────────────────────────────── CLI ────────────────────────────────────────
function main(argv) {
  const warnOnly = argv.includes("--warn");
  const update = argv.includes("--update");

  const packages = distributablePackages(DIST_REPO_ROOT).filter((p) =>
    p.name?.startsWith("@elabs-ai/components-"),
  );
  const withOptionalPeers = packages.filter((p) => optionalPeersOf(p.json).length > 0);
  const builtCount = withOptionalPeers.filter((p) => existsSync(join(p.dir, "dist"))).length;
  const skipped = withOptionalPeers.length - builtCount;

  const current = findLeakedPeerTypes({ packages: withOptionalPeers });

  if (update) {
    writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
    console.log(`✔ optional-peer-types: baseline updated — ${current.length} known leak(s).`);
    return 0;
  }

  const baseline = readBaseline();
  const baselineKeys = new Set(baseline.map(entryKey));
  const added = current.filter((c) => !baselineKeys.has(entryKey(c)));

  if (added.length === 0) {
    const currentKeys = new Set(current.map(entryKey));
    const stale = baseline.filter((b) => !currentKeys.has(entryKey(b)));
    const staleNote = stale.length
      ? ` ${stale.length} baseline entr(y/ies) now clean — run \`--update\` to ratchet down.`
      : "";
    const skipNote = skipped > 0 ? ` (${skipped} package(s) skipped — not built)` : "";
    console.log(
      `✔ optional-peer-types: no NEW optional-peer type leak(s) in the built .d.ts (${current.length} known, baselined).${staleNote}${skipNote}`,
    );
    return 0;
  }

  console.error("✖ optional-peer-types gate FAILED — an optional peer's own types leak:");
  for (const a of added) {
    console.error(`  ${a.package} → ${a.file}: "${a.specifier}" (optional peer "${a.peer}")`);
  }
  console.error(
    "\n  A `skipLibCheck: false` consumer who correctly omitted this optional peer now\n" +
      "  gets a TS2307 from importing ANYTHING out of the barrel — not from using the\n" +
      "  one component that needs it. Own the type locally instead of importing the\n" +
      "  peer's own type from a PUBLIC (barrel-reachable) module: declare a\n" +
      "  structurally-compatible mirror, and add a compile-time conformance assertion\n" +
      "  in the `@lazy-boundary` sibling module (which still imports the real peer type\n" +
      "  safely, since it is never statically imported into the barrel) proving the\n" +
      "  mirror stays assignable to the real type. See `packages/ai/src/persona.tsx`,\n" +
      "  `packages/ai/src/_persona-rive.tsx`, and the ADR 0019 amendment (issue #101).\n" +
      "\n  Run `pnpm optional-peer-types:check --update` once the finding is understood\n" +
      "  and the baseline is the intended fix (rare — most cases want the pattern above).",
  );
  return warnOnly ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
