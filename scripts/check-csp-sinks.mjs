#!/usr/bin/env node
/**
 * Trusted-Types sink gate.
 *
 * WHY. A renderer under `require-trusted-types-for 'script'` (a sandboxed
 * Electron renderer, where an XSS is an RCE) throws on every assignment to
 * `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `document.write`. React
 * performs `dangerouslySetInnerHTML` inside `setInitialProperties` — during
 * COMMIT, not render — so no error boundary catches it and React tears down the
 * ROOT. The observable failure is a BLANK WINDOW, not a broken component.
 *
 * Nothing else in this repo can see it: jsdom enforces no CSP, so the unit suite
 * stays green; and a component that only mounts its sink on interaction (a Select
 * viewport, which renders on first dropdown OPEN) screenshots perfectly and dies
 * on use. Hence a static gate.
 *
 * Note the empty string is NOT a carve-out: Chromium throws on `innerHTML = ""`
 * too, which is how `@number-flow/react` reaches the same sink.
 *
 * THREE RUNGS:
 *  1. OUR SOURCE is a ratchet. Four modules legitimately render engine output as
 *     an HTML/SVG string (KaTeX math, two Mermaid surfaces, schema-display) and
 *     cannot simply stop; they are recorded so a strict-CSP consumer knows
 *     exactly which components to avoid or to cover with a policy, and so a NEW
 *     one fails. Static markup — the Radix scrollbar rules that started this —
 *     is never in that category: it belongs in a stylesheet.
 *  2. THE PATCHED PACKAGES must stay patched. `@radix-ui/react-scroll-area` and
 *     `@radix-ui/react-select` each shipped an unconditional
 *     `<style dangerouslySetInnerHTML>` carrying nothing but static scrollbar
 *     rules; `patches/` removes it and `packages/tokens/src/radix-viewport.css`
 *     ships the rules instead. A version bump that silently drops a patch would
 *     re-break every consumer under a strict CSP — this is the rung that catches
 *     it, and it is the reason this gate exists at all.
 *  3. THIRD-PARTY DEPENDENCIES are a ratchet. Packages that already carry a sink
 *     are recorded in scripts/csp-sinks-baseline.json with the components that
 *     reach them, so a consumer can see what to avoid; a NEW one fails.
 *
 * HONEST LIMIT: rung 3 scans the dist of each DIRECT runtime dependency of a
 * distributable package. It is not a full transitive fixpoint over the installed
 * tree, so a sink reached only through a transitive dep is not caught yet. The
 * consuming app that reported this (qlabs-answers-desktop) built exactly that
 * fixpoint and offered it; adopting it is the follow-up. Do not describe this
 * gate as proving a module graph clean — it proves our source clean, the patches
 * intact, and the direct-dependency set unchanged.
 *
 * Usage: node scripts/check-csp-sinks.mjs [--update]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const BASELINE = join(here, "csp-sinks-baseline.json");

/** Assignments a Trusted-Types policy makes fatal. */
export const SINK_PATTERNS = [
  /dangerouslySetInnerHTML/,
  /\.innerHTML\s*=/,
  /\.outerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /document\s*\.\s*write(?:ln)?\s*\(/,
];

/** Packages whose sink we removed with a patch — they must STAY at zero. */
export const PATCHED_PACKAGES = ["@radix-ui/react-scroll-area", "@radix-ui/react-select"];

/**
 * Strip comments so a MENTION of a sink in prose is not read as a sink.
 *
 * A module that documents why it does NOT write HTML names the sink in its own
 * doc comment — `packages/viewer/src/adapters/docx/docx-model.ts` explains that
 * mammoth's HTML string is parsed and thrown away precisely so nothing reaches
 * `dangerouslySetInnerHTML` — and a raw `re.test(text)` flagged it as a sink.
 * That is a false positive in the one direction this gate must not have one:
 * it makes the gate cry wolf, and the cheapest way to silence it is `--update`,
 * which records a non-sink in the baseline as though it were real debt.
 *
 * Deliberately conservative — it errs toward KEEPING text (a false positive is
 * loud, a false negative is a blank window in a consumer's app):
 *  - string and template literals are preserved verbatim, so a sink inside a
 *    string still counts,
 *  - escapes are copied in pairs, so a regex literal like `/\/\//` cannot be
 *    mistaken for the start of a line comment,
 *  - only `//` and `/* … *\/` in CODE position are removed.
 */
export function stripComments(text) {
  let out = "";
  let quote = null;
  for (let i = 0; i < text.length; ) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "\\") {
      out += c + (next ?? "");
      i += 2;
      continue;
    }
    if (quote) {
      out += c;
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export function findSinks(text) {
  const code = stripComments(text);
  return SINK_PATTERNS.filter((re) => re.test(code)).map((re) => re.source);
}

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".turbo" || entry.name === "dist")
        continue;
      walk(p, test, out);
    } else if (test(p)) out.push(p);
  }
  return out;
}

const isOurSource = (p) =>
  /\.(tsx?|jsx?)$/.test(p) && !/\.(test|stories)\.[jt]sx?$/.test(p) && !p.endsWith(".d.ts");

/** Rung 1 — our own component source. */
export function scanOurSource(packagesDir) {
  const hits = [];
  for (const pkg of existsSync(packagesDir) ? readdirSync(packagesDir) : []) {
    for (const file of walk(join(packagesDir, pkg, "src"), isOurSource)) {
      const found = findSinks(readFileSync(file, "utf8"));
      // ABSOLUTE — the caller relativises. Slicing against the repo root here
      // silently produced "" whenever the scanned dir was not under it (a temp
      // dir in the self-test, whose path is SHORTER than the repo path on Linux
      // but longer on macOS — so it passed locally and failed in CI).
      if (found.length) hits.push({ file, patterns: found });
    }
  }
  return hits;
}

/** Read every JS artifact a package ships, shallowly (dist/ + package root). */
function packageCode(pkgDir) {
  const files = [];
  for (const sub of ["dist", "."]) {
    const d = join(pkgDir, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (!/\.(mjs|cjs|js)$/.test(f)) continue;
      try {
        if (statSync(p).isFile()) files.push(p);
      } catch {
        /* raced removal — ignore */
      }
    }
  }
  return files;
}

function resolvePkgDir(name, consumerDir) {
  for (const base of [join(consumerDir, "node_modules"), join(root, "node_modules")]) {
    const p = join(base, ...name.split("/"));
    if (existsSync(join(p, "package.json"))) return p;
  }
  return null;
}

/** Rungs 2 + 3 — direct runtime dependencies of every distributable package. */
export function scanDependencies(packagesDir) {
  const offenders = new Map();
  const patchedStillDirty = [];
  for (const pkg of existsSync(packagesDir) ? readdirSync(packagesDir) : []) {
    const manifestPath = join(packagesDir, pkg, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (!manifest.publishConfig && manifest.private) continue;
    for (const dep of Object.keys(manifest.dependencies || {})) {
      if (dep.startsWith("@elabs/")) continue;
      const dir = resolvePkgDir(dep, join(packagesDir, pkg));
      if (!dir) continue;
      const dirty = packageCode(dir).some((f) => findSinks(readFileSync(f, "utf8")).length > 0);
      if (!dirty) continue;
      if (PATCHED_PACKAGES.includes(dep)) patchedStillDirty.push(dep);
      const entry = offenders.get(dep) ?? { package: dep, reachedFrom: [] };
      if (!entry.reachedFrom.includes(manifest.name)) entry.reachedFrom.push(manifest.name);
      offenders.set(dep, entry);
    }
  }
  return {
    offenders: [...offenders.values()].sort((a, b) => a.package.localeCompare(b.package)),
    patchedStillDirty: [...new Set(patchedStillDirty)],
  };
}

const packagesDir = join(root, "packages");
const ourHits = scanOurSource(packagesDir);
const { offenders, patchedStillDirty } = scanDependencies(packagesDir);

if (process.argv.includes("--update")) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        $comment:
          "Modules and packages carrying a Trusted-Types-fatal sink. Ratchets DOWN only " +
          "(--update). This is precisely the set a renderer under " +
          "require-trusted-types-for 'script' must avoid or cover with a policy.",
        ourSource: ourHits.map((h) => relative(root, h.file)),
        packages: offenders,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `✔ csp-sinks: baseline updated — ${ourHits.length} own module(s), ${offenders.length} package(s).`,
  );
  process.exit(0);
}

const raw = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const baseline = raw.packages ?? [];
const knownOurs = new Set(raw.ourSource ?? []);
const known = new Set(baseline.map((p) => p.package));
const added = offenders.filter((o) => !known.has(o.package));
const addedOurs = ourHits.filter((h) => !knownOurs.has(relative(root, h.file)));

const problems = [];
if (addedOurs.length) {
  problems.push(
    `✖ csp-sinks: ${addedOurs.length} NEW file(s) in OUR source assign HTML — fatal under Trusted Types:\n` +
      addedOurs.map((h) => `  - ${relative(root, h.file)} (${h.patterns.join(", ")})`).join("\n") +
      "\n  Under a strict CSP this throws during COMMIT, so React tears down the ROOT:\n" +
      "  the consumer sees a BLANK WINDOW, and neither a unit test (jsdom enforces no\n" +
      "  CSP) nor a screenshot can see it. Static markup belongs in a stylesheet or as\n" +
      "  real JSX, never an HTML string. If an ENGINE genuinely returns HTML (KaTeX,\n" +
      "  Mermaid), record it with `--update` and document the escape hatch in\n" +
      "  docs/CSP-AND-NETWORK.md so a consumer can avoid that component.",
  );
}
if (patchedStillDirty.length) {
  problems.push(
    `✖ csp-sinks: a PATCHED package carries its sink again: ${patchedStillDirty.join(", ")}.\n` +
      "  A version bump almost certainly dropped the patch in patches/. Re-apply it\n" +
      "  (pnpm patch <pkg>@<version>) — every consumer under a strict CSP renders a\n" +
      "  BLANK WINDOW without it, with a fully green unit suite.",
  );
}
if (added.length) {
  problems.push(
    `✖ csp-sinks: ${added.length} NEW third-party package(s) carry a fatal sink:\n` +
      added.map((a) => `  - ${a.package} (reached from ${a.reachedFrom.join(", ")})`).join("\n") +
      "\n  Patch it, avoid it, or — if the component is genuinely optional for a\n" +
      "  strict-CSP consumer — record it with `--update` and document the escape hatch.",
  );
}

if (problems.length) {
  console.error("\n" + problems.join("\n\n") + "\n");
  process.exit(1);
}

console.log(
  `✔ csp-sinks: ${PATCHED_PACKAGES.length} patched package(s) still clean, ` +
    `${ourHits.length} known own module(s) + ${offenders.length} known third-party offender(s), none new.`,
);
