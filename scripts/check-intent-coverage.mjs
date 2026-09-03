#!/usr/bin/env node
/**
 * check-intent-coverage.mjs — per-component intent metadata coverage gate (WP-03 #60).
 *
 * `packages/cli/lib/intent.mjs` is the authored sidecar that gives an agent the
 * layer types cannot encode: a component's PURPOSE, RELATIONSHIPS, state→token map
 * and ANTI-PATTERNS. It is folded into `brand-ui.manifest.json` and rendered into
 * `brand-ui docs <C>`, the `brand-ui` MCP `docs` tool, and the per-package
 * `apps/docs/public/llms/<pkg>.txt` spokes.
 *
 * The failure this gate locks down (#60, the maintainer's 2026-06-08 note): the
 * spokes went LOPSIDED — four packages shipped zero `avoid:` lines because nobody
 * had authored intent for them, and nothing failed. Coverage was a reminder, not a
 * rule. This makes it a rule:
 *
 *   1. NO PHANTOM ENTRY   — every INTENT key is a real exported component (a typo or
 *                           a renamed export would silently stop being emitted).
 *   2. NO EMPTY SPOKE     — every manifest package has at least one component with
 *                           intent, so no shipped llms spoke has zero anti-patterns.
 *   3. SHAPE FLOOR        — every entry carries a `purpose`, a known `category`, and
 *                           at least one anti-pattern.
 *   4. COMPLEX-SURFACE BAR — an `ai` or `chart` entry carries >= 3 anti-patterns
 *                           (the maintainer's stated bar for the complex surfaces).
 *   5. TOKENS RESOLVE     — every utility class named in an entry's `stateTokens`
 *                           actually appears in that component's own module (or in a
 *                           declared INHERITED_MODULES parent it composes). This is
 *                           the one that catches HALLUCINATED ground truth: rules 1-4
 *                           validate entry KEYS, so `Artifact: bg-card` (really
 *                           `bg-background`), `Message assistant: bg-card` (really no
 *                           fill) and `AgentTimeline: border-s-info` (really the
 *                           Timeline node map) all shipped straight into
 *                           `brand-ui docs`, the manifest and the llms spokes.
 *   6. RELATIONSHIPS EXIST — every name in `relationships.usedInside/contains/pairsWith`
 *                           is a real exported component (`avoidNextTo` is prose and
 *                           is exempt).
 *   7. COVERAGE RATCHET   — rules 2 and 4 only bind entries that already exist, so a
 *                           NEW `ai`/`charts` surface could still ship with zero
 *                           anti-patterns and nothing would fail. Every uncovered ROOT
 *                           SURFACE of a gated package (see GATED_PACKAGES) must
 *                           therefore either carry intent or be listed in the frozen
 *                           baseline `scripts/intent-coverage-baseline.json`. The
 *                           baseline only ratchets DOWN (`--update`; raising it needs
 *                           `--force`). "Root SURFACE" excludes a family member whose
 *                           module already carries intent and a verbatim third-party
 *                           re-export — see `uncoveredRoots`.
 *
 * Rules 5 and 6 are deliberately about the CONTENT of an entry, not its shape: the
 * deliverable here IS the anti-hallucination ground truth, so a confidently-wrong
 * token or a phantom sibling is worse than a missing entry.
 *
 * WHAT THIS GATE DOES *NOT* CLAIM (#60 is still open on it). The maintainer's
 * 2026-06-08 bar is "≥3 avoid-lines per complex ai/charts component". The gate proves
 * that no spoke is empty, that no shipped entry is thin/wrong, and that the gap cannot
 * GROW — it does not prove the gap is CLOSED. The remaining uncovered surfaces are
 * listed, not hidden: every run prints the residual count, `--residual` prints the list
 * grouped by package, and the baseline file is the tracked inventory. Do not read a
 * green run as "#60 satisfied".
 *
 * Run via `pnpm intent:check`; the self-test (`pnpm intent:check:test`) plants a bad
 * fixture and asserts the gate fails, so the gate itself can't rot.
 *
 * Dependency-free; resolves the repo root relative to this file (cwd-independent).
 *
 * Flags:
 *   --update   rewrite the coverage baseline from the current tree (ratchet down).
 *   --force    allow --update to raise the baseline (rare — justify in the PR).
 *   --residual print the still-uncovered surfaces grouped by package, then exit 0.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { INTENT } from "../packages/cli/lib/intent.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(HERE); // scripts/ -> repo root
export const BASELINE_PATH = join(HERE, "intent-coverage-baseline.json");

/**
 * Packages whose ROOT exports are ratcheted (rule 7). These are the two the
 * maintainer's "≥3 anti-patterns per complex surface" bar names (#60), and the two
 * whose llms spokes went empty. Widening this to every package is a welcome
 * follow-up ratchet, not a precondition.
 */
export const GATED_PACKAGES = ["@elabs-ai/components-ai", "@elabs-ai/components-charts"];

/** The documented `category` enum (intent.mjs schema header). */
export const CATEGORIES = new Set([
  "action",
  "input",
  "overlay",
  "layout",
  "data",
  "feedback",
  "navigation",
  "display",
  "ai",
  "chart",
  "flow",
  "terminal",
]);

/** Categories whose surfaces are complex enough to require the 3-anti-pattern bar. */
export const COMPLEX_CATEGORIES = new Set(["ai", "chart"]);

/** Minimum anti-patterns for a complex (ai/chart) surface. */
export const COMPLEX_MIN_ANTI_PATTERNS = 3;

/**
 * Tailwind utility FAMILIES a `stateTokens` value may name. Deliberately limited to
 * the colour/edge-bearing ones (a state→token map is about colour and edges) so
 * ordinary prose can't be mistaken for a class. Gradient families (`from-`/`via-`/
 * `to-`) are excluded on purpose — they are unused here and `to-do` would false-fire.
 */
const CLASS_FAMILIES =
  "bg|text|border|ring|fill|stroke|shadow|outline|divide|accent|caret|placeholder";

/**
 * Matches a utility class inside a prose `stateTokens` value: a family, a
 * lowercase-initial name, optional extra segments, optional `/opacity` modifier.
 * The lookbehind keeps `--background` (a CSS variable) and the tail of a longer
 * class from matching. Variant prefixes are fine — `group-[.is-user]:bg-chat-user`
 * yields `bg-chat-user`, which is exactly the substring the module must contain.
 */
const CLASS_RE = new RegExp(
  `(?<![\\w/-])((?:${CLASS_FAMILIES})-[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:/\\d{1,3})?)`,
  "g",
);

/**
 * Components whose `stateTokens` legitimately name classes declared by a COMPOSED
 * child in ANOTHER module — the visual is inherited, not local. The class must still
 * resolve (a typo fails), it may just resolve against the listed parent(s). Keep this
 * list short and reasoned: it is an escape hatch for real composition, NOT a way to
 * silence rule 5.
 */
export const INHERITED_MODULES = {
  AlertDialog: {
    modules: ["packages/ui/src/components/button/button.tsx"],
    reason: "AlertDialogAction/AlertDialogCancel are rendered with buttonVariants",
  },
  Combobox: {
    modules: [
      "packages/ui/src/components/button/button.tsx",
      "packages/ui/src/components/command/command.tsx",
    ],
    reason: "Combobox is a Popover + Command assembly over a Button trigger",
  },
  AppShell: {
    modules: ["packages/ui/src/components/sidebar/sidebar.tsx"],
    reason: "the chrome recess (bg-sidebar) belongs to the composed Sidebar",
  },
  ChartCard: {
    modules: ["packages/ui/src/components/card/card.tsx"],
    reason: "ChartCard IS a Card — it adds layout, not a surface (ADR 0012)",
  },
  AgentTimeline: {
    modules: ["packages/ui/src/components/timeline/timeline.tsx"],
    reason: "the rail node styles are the ui Timeline's NODE_STYLE map (#190/#192)",
  },
  // The React Flow parts reach their engine through ONE dynamic-import boundary
  // (ADR 0019 / `_flow-lazy.ts`), so each public module is a `lazy()` wrapper of
  // ~20 lines that renders no classes at all — every class these entries name is
  // declared in that single boundary module.
  Controls: {
    modules: ["packages/ai/src/_flow-boundary.tsx"],
    reason: "the public module is the ADR 0019 lazy wrapper; the classes are the boundary's",
  },
  Edge: {
    modules: ["packages/ai/src/_flow-boundary.tsx"],
    reason: "the public module is the ADR 0019 lazy wrapper; the classes are the boundary's",
  },
  Panel: {
    modules: ["packages/ai/src/_flow-boundary.tsx"],
    reason: "the public module is the ADR 0019 lazy wrapper; the classes are the boundary's",
  },
};

/**
 * Does `src` render the utility class `c` as a WHOLE class token?
 *
 * A bare `src.includes(c)` is NOT enough: it accepts any claim that is a PREFIX of a
 * longer real class. That is exactly how `DataTable.stateTokens.header: "… +
 * border-border"` survived this gate while the module really renders
 * `border-b border-border-strong` — `"border-border-strong".includes("border-border")`
 * is `true`. That claim is semantically load-bearing (ADR 0010 /
 * .claude/rules/styling-and-tokens.md make subtle-vs-strong a WCAG 1.4.11 decision),
 * so the loose match shipped the NON-compliant rung as ground truth. Other live prefix
 * pairs it would also wave through: `text-primary` vs `text-primary-foreground`,
 * `bg-chat-user` vs `bg-chat-user-foreground`, `bg-muted` vs `bg-muted-foreground`,
 * `border-b` vs `border-border`.
 *
 * So the match is anchored on BOTH sides at a class boundary:
 *   - left  `(?<![A-Za-z0-9_-])` — a variant prefix (`hover:`, `focus-visible:`,
 *     `group-[.is-user]:`) or whitespace/quote still resolves; the tail of a longer
 *     class does not.
 *   - right `(?![A-Za-z0-9-])` — a `/60` opacity modifier of the SAME utility still
 *     resolves (`bg-surface-muted` against `bg-surface-muted/60`), because that is the
 *     same token at reduced alpha; another `-segment` does not.
 */
export function classResolves(c, src) {
  const escaped = c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9-])`).test(src);
}

/** Every utility class named in an entry's `stateTokens` values, de-duped. */
export function classesInStateTokens(stateTokens) {
  const found = new Set();
  for (const value of Object.values(stateTokens ?? {})) {
    if (typeof value !== "string") continue;
    for (const m of value.matchAll(CLASS_RE)) found.add(m[1]);
  }
  return [...found];
}

/**
 * The ROOT exports of a gated package — the surfaces rule 7 ratchets.
 *
 * A compound component's sub-parts (`MessageContent`, `ToolHeader`, `PieSlice`) are
 * exported from the SAME module as their root and are covered by the root's entry, so
 * "sub-part" is defined structurally: another export in the same module is a strict
 * prefix of this name. That keeps `BarChart` (its own `bar-chart.tsx`) a root even
 * though a bare `Bar` is exported elsewhere. SCREAMING_SNAKE constants and lowercase
 * helpers are not surfaces and are skipped.
 *
 * @param {{name: string, module?: string}[]} components
 * @returns {string[]} sorted root export names
 */
export function rootExports(components) {
  const roots = (components ?? [])
    .filter((c) => c?.name && /^[A-Z][a-zA-Z0-9]*$/.test(c.name))
    .filter(
      (c) =>
        !components.some(
          (o) => o?.name && o.name !== c.name && o.module === c.module && c.name.startsWith(o.name),
        ),
    )
    .map((c) => c.name);
  return [...new Set(roots)].sort((a, b) => a.localeCompare(b));
}

/**
 * Is `name` a member of a component FAMILY that already carries intent?
 *
 * `rootExports` folds a sub-part into its root only when the root's name is a strict
 * PREFIX of it (`Message` → `MessageContent`). That is an approximation of the real
 * rule — "the module's entry documents the family" — and it misses every sibling that
 * does not share the prefix: `UserMessage`/`AgentMessage` (presets of `Message`, which
 * per @.claude/rules/component-api.md deliberately keep the BASE `data-slot`),
 * `AgentStep` (a part of `AgentTimeline`), `EvidenceChip` (`InlineCitation`),
 * `ChartFallback` (`AutoChart`), `SankeyNode`/`SankeyLink` (`SankeyChart`). Counting
 * those as uncovered SURFACES inflates the coverage gap with parts whose ground truth
 * already ships in the same module's entry.
 *
 * So the structural test is widened from "prefix" to "same module": if any OTHER
 * export of this module has intent, the family is documented.
 */
export function familyDocumented(name, components, intent) {
  const own = (components ?? []).find((c) => c?.name === name);
  if (!own?.module) return false;
  return (components ?? []).some(
    (c) => c?.name && c.name !== name && c.module === own.module && Boolean(intent[c.name]),
  );
}

/** Bare (non-relative, non-workspace) import specifier → a third-party package. */
const THIRD_PARTY_RE = /^(?!\.)(?!@elabs-ai\/)/;

/**
 * Is `name` a verbatim RE-EXPORT of a third-party symbol?
 *
 * `packages/charts/src/charts/index.ts` re-exports visx's gradient/pattern primitives
 * (`GradientTealBlue`, `PatternLines`, …) so a chart author does not have to add a
 * second dependency. They are not brand-ui surfaces, cannot carry brand-ui
 * anti-patterns, and the gate's own `--force` note already names them as the honest
 * reason a baseline would have to be RAISED. Recognising them structurally is better
 * than freezing them in a baseline that is supposed to mean "still owed".
 */
export function isThirdPartyReExport(name, src) {
  if (!src) return false;
  const re = /export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    if (!THIRD_PARTY_RE.test(m[2])) continue;
    const exported = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.includes(" as ") ? s.split(" as ").pop().trim() : s));
    if (exported.includes(name)) return true;
  }
  return false;
}

/**
 * The root exports of every gated package that are genuinely UNCOVERED surfaces, as
 * `pkg::Name` keys — i.e. no intent of their own, no documented family in the same
 * module, and not a third-party re-export.
 */
export function uncoveredRoots({
  intent,
  manifest,
  gated = GATED_PACKAGES,
  readModule = defaultReadModule,
}) {
  const keys = [];
  const srcCache = new Map();
  const sourceOf = (path) => {
    if (!path) return null;
    if (!srcCache.has(path)) srcCache.set(path, readModule(path));
    return srcCache.get(path);
  };
  for (const pkg of gated) {
    const info = manifest.packages?.[pkg];
    if (!info) continue;
    const components = info.components ?? [];
    for (const name of rootExports(components)) {
      if (intent[name]) continue;
      if (familyDocumented(name, components, intent)) continue;
      const module = components.find((c) => c?.name === name)?.module;
      if (isThirdPartyReExport(name, sourceOf(module))) continue;
      keys.push(`${pkg}::${name}`);
    }
  }
  return keys.sort((a, b) => a.localeCompare(b));
}

/**
 * The pure checker — driven by already-loaded data so the self-test is hermetic.
 *
 * @param {object} input
 * @param {Record<string, object>} input.intent   the authored INTENT map
 * @param {object} input.manifest                 a parsed brand-ui.manifest.json
 * @param {(path: string) => string|null} [input.readModule]
 *        resolves a repo-relative module path to its source (null = missing). Injected
 *        so the self-test is hermetic; defaults to reading from disk.
 * @param {string[]|null} [input.baseline]
 *        the committed coverage baseline (rule 7). `null` skips the ratchet — used by
 *        the fixture tests that only exercise rules 1-6.
 * @param {string[]} [input.gated] packages the ratchet applies to.
 * @returns {string[]} violation messages (empty = pass)
 */
export function findIntentViolations({
  intent,
  manifest,
  readModule = defaultReadModule,
  baseline = null,
  gated = GATED_PACKAGES,
}) {
  const violations = [];

  // name -> [pkg, …] over every package's exported components, and name -> module.
  const byName = new Map();
  const moduleOf = new Map();
  for (const [pkg, info] of Object.entries(manifest.packages ?? {})) {
    for (const c of info.components ?? []) {
      if (!c?.name) continue;
      if (!byName.has(c.name)) byName.set(c.name, []);
      byName.get(c.name).push(pkg);
      if (c.module && !moduleOf.has(c.name)) moduleOf.set(c.name, c.module);
    }
  }

  /** Cache module sources so a shared parent is read once. */
  const sourceCache = new Map();
  const sourceOf = (path) => {
    if (!sourceCache.has(path)) sourceCache.set(path, readModule(path));
    return sourceCache.get(path);
  };

  // 1 + 3 + 4 + 5 + 6 — per-entry checks.
  for (const name of Object.keys(intent).sort((a, b) => a.localeCompare(b))) {
    const meta = intent[name] ?? {};
    if (!byName.has(name)) {
      violations.push(
        `packages/cli/lib/intent.mjs: "${name}" has intent but is not an exported component ` +
          "(phantom entry — it is silently dropped from the manifest; fix the key or delete it)",
      );
      continue; // the rest of the checks are moot for an entry that never ships
    }
    if (!meta.purpose) {
      violations.push(`packages/cli/lib/intent.mjs: "${name}" has no \`purpose\``);
    }
    if (!meta.category || !CATEGORIES.has(meta.category)) {
      violations.push(
        `packages/cli/lib/intent.mjs: "${name}" has category "${meta.category ?? "(none)"}" — ` +
          `must be one of: ${[...CATEGORIES].join(", ")}`,
      );
    }
    const anti = Array.isArray(meta.antiPatterns) ? meta.antiPatterns : [];
    if (anti.length === 0) {
      violations.push(
        `packages/cli/lib/intent.mjs: "${name}" has no \`antiPatterns\` — the anti-pattern list ` +
          "is what makes the entry worth emitting (it becomes the spoke's `avoid:` lines)",
      );
    } else if (COMPLEX_CATEGORIES.has(meta.category) && anti.length < COMPLEX_MIN_ANTI_PATTERNS) {
      violations.push(
        `packages/cli/lib/intent.mjs: "${name}" is category "${meta.category}" with ` +
          `${anti.length} anti-pattern(s) — a complex ai/chart surface needs at least ` +
          `${COMPLEX_MIN_ANTI_PATTERNS}`,
      );
    }

    // 5 — every class named in stateTokens must exist in real source.
    const classes = classesInStateTokens(meta.stateTokens);
    if (classes.length) {
      const own = moduleOf.get(name);
      const inherited = INHERITED_MODULES[name];
      const paths = [...(own ? [own] : []), ...(inherited?.modules ?? [])];
      const sources = [];
      for (const p of paths) {
        const src = sourceOf(p);
        if (src === null) {
          violations.push(
            `packages/cli/lib/intent.mjs: "${name}" resolves against "${p}", which does not ` +
              "exist — fix the manifest module or the INHERITED_MODULES entry in " +
              "scripts/check-intent-coverage.mjs",
          );
        } else {
          sources.push(src);
        }
      }
      if (sources.length) {
        const missing = classes.filter((c) => !sources.some((s) => classResolves(c, s)));
        if (missing.length) {
          const where = paths.join(", ");
          violations.push(
            `packages/cli/lib/intent.mjs: "${name}" \`stateTokens\` names ${missing
              .map((c) => `\`${c}\``)
              .join(", ")} — not found in ${where}. State→token claims are the ` +
              "anti-hallucination ground truth: name the class the component actually " +
              "renders, or declare the composed parent in INHERITED_MODULES " +
              "(scripts/check-intent-coverage.mjs) if the visual is genuinely inherited.",
          );
        }
      }
    }

    // 6 — relationship identifiers must be real components (`avoidNextTo` is prose).
    for (const key of ["usedInside", "contains", "pairsWith"]) {
      for (const related of meta.relationships?.[key] ?? []) {
        if (!byName.has(related)) {
          violations.push(
            `packages/cli/lib/intent.mjs: "${name}".relationships.${key} names "${related}", ` +
              "which is not an exported component — an agent told to compose it would " +
              "reach for something that does not exist",
          );
        }
      }
    }
  }

  // 2 — no package may ship an llms spoke with zero intent.
  const covered = new Set();
  for (const name of Object.keys(intent))
    for (const pkg of byName.get(name) ?? []) covered.add(pkg);
  for (const pkg of Object.keys(manifest.packages ?? {}).sort()) {
    const hasComponents = (manifest.packages[pkg].components ?? []).length > 0;
    if (hasComponents && !covered.has(pkg)) {
      violations.push(
        `${pkg}: no component has intent metadata — its llms spoke would ship zero \`avoid:\` ` +
          "lines. Add at least one entry to packages/cli/lib/intent.mjs.",
      );
    }
  }

  // 7 — coverage ratchet: no NEW uncovered root surface in a gated package.
  if (baseline) {
    const allowed = new Set(baseline);
    for (const key of uncoveredRoots({ intent, manifest, gated, readModule })) {
      if (allowed.has(key)) continue;
      const [pkg, name] = key.split("::");
      violations.push(
        `${pkg}: "${name}" is a root export with no intent metadata and is not in the ` +
          "frozen baseline (scripts/intent-coverage-baseline.json). A new ai/charts surface " +
          "must ship its own anti-patterns — add an entry to packages/cli/lib/intent.mjs. " +
          "If it is genuinely not a brand-ui surface (a third-party re-export), raise the " +
          "baseline deliberately with `pnpm intent:check -- --update --force` and say why.",
      );
    }
  }

  return violations;
}

/** Read a repo-relative module; `null` when it does not exist. */
function defaultReadModule(path) {
  const abs = join(REPO_ROOT, path);
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
}

// ── CLI ─────────────────────────────────────────────────────────────────────
// Skipped when imported by the self-test (which drives the pure checker directly).
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("check-intent-coverage.mjs");
if (invokedDirectly) {
  const manifestPath = join(REPO_ROOT, "brand-ui.manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("✖ intent-coverage: brand-ui.manifest.json not found — run `pnpm manifest`.");
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const args = process.argv.slice(2);

  // `--residual` — the still-owed work, named. The baseline is an inventory of a
  // KNOWN gap, not an amnesty: #60's bar ("≥3 avoid-lines per complex ai/charts
  // component") is not met until this list is empty, so make the list cheap to read
  // instead of leaving it implicit in a sorted JSON array.
  if (args.includes("--residual")) {
    const residual = uncoveredRoots({ intent: INTENT, manifest });
    const byPkg = new Map();
    for (const key of residual) {
      const [pkg, name] = key.split("::");
      if (!byPkg.has(pkg)) byPkg.set(pkg, []);
      byPkg.get(pkg).push(name);
    }
    console.log(
      `intent coverage residual — ${residual.length} gated root surface(s) still carry no ` +
        "anti-patterns (tracked by #60; the ratchet stops this growing):",
    );
    for (const [pkg, names] of [...byPkg].sort(([a], [b]) => a.localeCompare(b))) {
      const total = rootExports(manifest.packages?.[pkg]?.components).length;
      console.log(`\n  ${pkg} — ${names.length} of ${total} root export(s)`);
      for (const n of names) console.log(`    - ${n}`);
    }
    if (!residual.length) console.log("  (none — every gated root surface carries intent)");
    process.exit(0);
  }

  if (args.includes("--update")) {
    const prev = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : [];
    const next = uncoveredRoots({ intent: INTENT, manifest });
    const added = next.filter((k) => !prev.includes(k));
    if (added.length && !args.includes("--force")) {
      console.error(
        "✖ intent-coverage --update would RAISE the baseline (new uncovered root export(s)):\n" +
          added.map((k) => `  - ${k}`).join("\n") +
          "\n  Author intent in packages/cli/lib/intent.mjs, or re-run with --force and say why.",
      );
      process.exit(1);
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + "\n");
    console.log(
      `✔ intent-coverage baseline updated: ${next.length} root export(s) still uncovered ` +
        `(was ${prev.length}).`,
    );
    process.exit(0);
  }

  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
    : null;
  if (!baseline) {
    console.error(
      "✖ intent-coverage: scripts/intent-coverage-baseline.json is missing — " +
        "run `pnpm intent:check -- --update` to seed it.",
    );
    process.exit(1);
  }
  const violations = findIntentViolations({ intent: INTENT, manifest, baseline });
  if (violations.length) {
    console.error(`✖ per-component intent metadata (${violations.length} problem(s)):`);
    for (const v of violations) console.error("  - " + v);
    console.error(
      "\n  Fix: edit packages/cli/lib/intent.mjs (the authored sidecar), then run\n" +
        "  `pnpm agent-docs` so the manifest + llms spokes + context pick it up.",
    );
    process.exit(1);
  }
  const pkgs = Object.keys(manifest.packages ?? {}).length;
  const stillUncovered = uncoveredRoots({ intent: INTENT, manifest }).length;
  console.log(
    `✔ intent coverage: ${Object.keys(INTENT).length} authored entries, every one exported, ` +
      `all ${pkgs} packages covered.`,
  );
  if (stillUncovered) {
    // Say the quiet part in the GREEN output. A gate that only prints ✔ trains a
    // reader to treat "no violations" as "coverage complete"; #60's bar is not met
    // while this number is non-zero.
    console.log(
      `  residual: ${stillUncovered} gated root surface(s) still carry no anti-patterns ` +
        "(grandfathered in scripts/intent-coverage-baseline.json; ratchets down only).\n" +
        "  #60 stays OPEN until this reaches 0 — run `pnpm intent:check -- --residual` for the list.",
    );
  }
}
