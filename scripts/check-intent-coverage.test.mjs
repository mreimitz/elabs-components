// check-intent-coverage.test.mjs — self-test for scripts/check-intent-coverage.mjs
// -----------------------------------------------------------------------------
// A gate that can silently stop firing is worse than none (quality-gates.md,
// "Self-tested gates"). This plants bad fixtures against the PURE checker and
// asserts each one is caught, then runs the real gate over the real repo and
// asserts it exits 0.
//
// Run: node --test scripts/check-intent-coverage.test.mjs   (pnpm intent:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  BASELINE_PATH,
  classResolves,
  classesInStateTokens,
  familyDocumented,
  findIntentViolations,
  isThirdPartyReExport,
  rootExports,
  uncoveredRoots,
  REPO_ROOT,
} from "./check-intent-coverage.mjs";
import { INTENT } from "../packages/cli/lib/intent.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GATE = path.join(HERE, "check-intent-coverage.mjs");

/** A minimal two-package manifest fixture. */
const manifest = {
  packages: {
    "@elabs-ai/components-ui": { components: [{ name: "Button" }, { name: "Card" }] },
    "@elabs-ai/components-charts": { components: [{ name: "BarChart" }] },
  },
};

const okEntry = (category, antiPatterns) => ({
  purpose: "Does a thing.",
  category,
  antiPatterns,
});

test("a clean intent map passes", () => {
  const intent = {
    Button: okEntry("action", ["Two primary Buttons in one group — demote one."]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  assert.deepEqual(findIntentViolations({ intent, manifest }), []);
});

test("a phantom entry (not an exported component) fails", () => {
  const intent = {
    Button: okEntry("action", ["x"]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
    MessageBubble: okEntry("ai", ["a", "b", "c"]), // never exported
  };
  const v = findIntentViolations({ intent, manifest });
  assert.equal(v.length, 1);
  assert.match(v[0], /MessageBubble.*not an exported component/);
});

test("a package with no intent at all fails (the empty-spoke case #60 records)", () => {
  const intent = { Button: okEntry("action", ["x"]) }; // charts uncovered
  const v = findIntentViolations({ intent, manifest });
  assert.equal(v.length, 1);
  assert.match(v[0], /components-charts: no component has intent metadata/);
});

test("an ai/chart entry with fewer than 3 anti-patterns fails", () => {
  const intent = {
    Button: okEntry("action", ["x"]),
    BarChart: okEntry("chart", ["only one"]),
  };
  const v = findIntentViolations({ intent, manifest });
  assert.equal(v.length, 1);
  assert.match(v[0], /BarChart.*1 anti-pattern\(s\).*at least 3/);
});

test("a non-complex entry needs only one anti-pattern", () => {
  const intent = {
    Button: okEntry("action", ["just one is fine here"]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  assert.deepEqual(findIntentViolations({ intent, manifest }), []);
});

test("an entry with no anti-patterns at all fails", () => {
  const intent = {
    Button: okEntry("action", []),
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  const v = findIntentViolations({ intent, manifest });
  assert.equal(v.length, 1);
  assert.match(v[0], /Button.*no `antiPatterns`/);
});

test("an unknown category fails", () => {
  const intent = {
    Button: { purpose: "p", category: "widget", antiPatterns: ["x"] },
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  const v = findIntentViolations({ intent, manifest });
  assert.equal(v.length, 1);
  assert.match(v[0], /"Button" has category "widget"/);
});

test("a missing purpose fails", () => {
  const intent = {
    Button: { category: "action", antiPatterns: ["x"] },
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  const v = findIntentViolations({ intent, manifest });
  assert.equal(v.length, 1);
  assert.match(v[0], /Button" has no `purpose`/);
});

// ── Rule 5: state→token claims must resolve against real source ──────────────
// The defect this locks down: rules 1-4 validate entry KEYS, so four confidently
// WRONG token claims (Artifact `bg-card`, Message assistant `bg-card`,
// AgentTimeline `border-s-info`, Sources' `{ id, label, url }` shape) shipped
// through `brand-ui docs`, brand-ui.manifest.json and llms/ai.txt — the exact
// surface #60 exists to make trustworthy.

/** A manifest whose components carry `module`, plus a fake source tree. */
const tokenManifest = {
  packages: {
    "@elabs-ai/components-ui": {
      components: [
        { name: "Button", module: "packages/ui/src/components/button/button.tsx" },
        { name: "Card", module: "packages/ui/src/components/card/card.tsx" },
      ],
    },
    "@elabs-ai/components-charts": {
      components: [
        { name: "BarChart", module: "packages/charts/src/charts/bar-chart.tsx" },
        { name: "ChartCard", module: "packages/charts/src/chart-card/chart-card.tsx" },
      ],
    },
  },
};

const FAKE_SOURCES = {
  "packages/ui/src/components/button/button.tsx": 'cn("bg-primary hover:bg-primary/90 ring-ring")',
  "packages/ui/src/components/card/card.tsx": 'cn("bg-card text-card-foreground border-border")',
  "packages/charts/src/charts/bar-chart.tsx": 'cn("text-muted-foreground")',
  // ChartCard renders <Card>; it declares no surface of its own.
  "packages/charts/src/chart-card/chart-card.tsx": 'cn("flex flex-col")',
};
const readModule = (p) => FAKE_SOURCES[p] ?? null;

test("a stateTokens class the component does not render fails", () => {
  const intent = {
    Button: { ...okEntry("action", ["x"]), stateTokens: { hover: "bg-secondary/90" } },
    BarChart: okEntry("chart", ["a", "b", "c"]),
    ChartCard: okEntry("chart", ["a", "b", "c"]),
  };
  const v = findIntentViolations({ intent, manifest: tokenManifest, readModule });
  assert.equal(v.length, 1);
  assert.match(v[0], /"Button" `stateTokens` names `bg-secondary\/90`/);
  assert.match(v[0], /button\.tsx/);
});

test("the Artifact regression: claiming bg-card on a bg-background surface fails", () => {
  const intent = {
    Button: { ...okEntry("action", ["x"]), stateTokens: { hover: "bg-primary/90" } },
    BarChart: {
      ...okEntry("chart", ["a", "b", "c"]),
      stateTokens: { surface: "bg-card + border (sole structural cue under decoration)" },
    },
    ChartCard: okEntry("chart", ["a", "b", "c"]),
  };
  const v = findIntentViolations({ intent, manifest: tokenManifest, readModule });
  assert.equal(v.length, 1);
  assert.match(v[0], /`bg-card`/);
});

test("a class owned by a declared composed parent passes (ChartCard → Card)", () => {
  const intent = {
    Button: okEntry("action", ["x"]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
    ChartCard: {
      ...okEntry("chart", ["a", "b", "c"]),
      stateTokens: { background: "bg-card text-card-foreground — inherited: ChartCard IS a Card" },
    },
  };
  assert.deepEqual(findIntentViolations({ intent, manifest: tokenManifest, readModule }), []);
});

test("INHERITED_MODULES is not a blanket escape hatch — a typo still fails", () => {
  const intent = {
    Button: okEntry("action", ["x"]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
    ChartCard: {
      ...okEntry("chart", ["a", "b", "c"]),
      stateTokens: { background: "bg-crad text-card-foreground" }, // typo
    },
  };
  const v = findIntentViolations({ intent, manifest: tokenManifest, readModule });
  assert.equal(v.length, 1);
  assert.match(v[0], /`bg-crad`/);
});

test("a variant-prefixed class resolves on its bare form", () => {
  const intent = {
    Button: {
      ...okEntry("action", ["x"]),
      stateTokens: { hover: "group-[.is-x]:bg-primary/90 + data-[state=on]:ring-ring" },
    },
    BarChart: okEntry("chart", ["a", "b", "c"]),
    ChartCard: okEntry("chart", ["a", "b", "c"]),
  };
  assert.deepEqual(findIntentViolations({ intent, manifest: tokenManifest, readModule }), []);
});

test("CSS variables and prose are not mistaken for utility classes", () => {
  assert.deepEqual(classesInStateTokens({ series: "--chart-1 … --chart-5" }), []);
  assert.deepEqual(classesInStateTokens({ bg: "--background / --canvas-grid" }), []);
  assert.deepEqual(classesInStateTokens({ c: "currentColor (inherits the text token)" }), []);
  assert.deepEqual(classesInStateTokens({ v: "tabular-nums" }), []);
  assert.deepEqual(classesInStateTokens({ s: "status=ready|submitted|streaming|error" }), []);
  assert.deepEqual(classesInStateTokens({ ok: "hover:bg-foreground/10 then border-s-4" }), [
    "bg-foreground/10",
    "border-s-4",
  ]);
});

// ── Rule 5, boundary anchoring: a PREFIX of a real class must NOT resolve ────
// The hole this locks down: `sources.some((s) => s.includes(c))` accepted any claim
// that is a prefix of a longer real class, so DataTable's `border-border` passed
// against a module that only renders `border-b border-border-strong`. That is a WCAG
// 1.4.11 decision (ADR 0010) — the loose match shipped the NON-compliant rung as
// ground truth, through the very gate added to stop hallucinated stateTokens.

test("classResolves anchors on class boundaries (the border-border/-strong hole)", () => {
  // The exploited pair — must FAIL.
  assert.equal(classResolves("border-border", "border-b border-border-strong"), false);
  assert.equal(classResolves("border-border-strong", "border-b border-border-strong"), true);
  // Other live prefix pairs the loose test would have waved through.
  assert.equal(classResolves("text-primary", 'cn("text-primary-foreground")'), false);
  assert.equal(classResolves("bg-chat-user", 'cn("bg-chat-user-foreground")'), false);
  assert.equal(classResolves("bg-muted", 'cn("bg-muted-foreground")'), false);
  assert.equal(classResolves("border-b", 'cn("last:border-b-0")'), false);
  // Variant prefixes and /opacity modifiers must KEEP resolving.
  assert.equal(classResolves("bg-primary/90", 'cn("hover:bg-primary/90")'), true);
  assert.equal(classResolves("ring-ring", 'cn("focus-visible:ring-ring")'), true);
  assert.equal(classResolves("bg-chat-user", 'cn("group-[.is-user]:bg-chat-user")'), true);
  assert.equal(classResolves("bg-surface-muted", 'cn("bg-surface-muted/60")'), true);
});

test("a stateTokens claim that is only a PREFIX of the rendered class fails", () => {
  // card.tsx renders `text-card-foreground`; claiming the shorter `text-card` is the
  // exact shape of the DataTable defect — `includes()` accepted it, the anchored
  // match does not.
  const intent = {
    Button: okEntry("action", ["x"]),
    Card: { ...okEntry("layout", ["x"]), stateTokens: { text: "text-card" } },
    BarChart: okEntry("chart", ["a", "b", "c"]),
    ChartCard: okEntry("chart", ["a", "b", "c"]),
  };
  const v = findIntentViolations({ intent, manifest: tokenManifest, readModule });
  assert.equal(v.length, 1);
  assert.match(v[0], /"Card" `stateTokens` names `text-card`/);
});

test("the shipped DataTable header claim names the STRONG rung, not the subtle one", () => {
  const header = INTENT.DataTable.stateTokens.header;
  assert.match(header, /border-border-strong/);
  assert.ok(
    !/border-border(?![-\w])/.test(header),
    "the header bottom is the SOLE cue between header and first row (#173) — border-border would be the non-compliant rung",
  );
});

// ── Rule 6: relationship identifiers must exist ──────────────────────────────

test("a phantom relationship identifier fails", () => {
  const intent = {
    Button: { ...okEntry("action", ["x"]), relationships: { usedInside: ["Card", "Field"] } },
    BarChart: okEntry("chart", ["a", "b", "c"]),
    ChartCard: okEntry("chart", ["a", "b", "c"]),
  };
  const v = findIntentViolations({ intent, manifest: tokenManifest, readModule });
  assert.equal(v.length, 1);
  assert.match(v[0], /relationships\.usedInside names "Field"/);
});

test("avoidNextTo is prose and is exempt", () => {
  const intent = {
    Button: {
      ...okEntry("action", ["x"]),
      relationships: { avoidNextTo: ["another primary Button"] },
    },
    BarChart: okEntry("chart", ["a", "b", "c"]),
    ChartCard: okEntry("chart", ["a", "b", "c"]),
  };
  assert.deepEqual(findIntentViolations({ intent, manifest: tokenManifest, readModule }), []);
});

// ── The four verified-false claims stay dead ─────────────────────────────────

test("the shipped entries no longer carry the four verified-false claims", () => {
  const artifact = Object.values(INTENT.Artifact.stateTokens).join(" ");
  assert.ok(artifact.includes("bg-background"), "Artifact's root surface is bg-background");
  assert.ok(!artifact.includes("bg-card"), "Artifact does not render bg-card");

  const assistant = INTENT.Message.stateTokens.assistant;
  assert.ok(!assistant.includes("bg-card"), "the assistant turn carries NO fill");
  assert.match(assistant, /border-s-4 border-s-primary/);

  const timeline = Object.values(INTENT.AgentTimeline.stateTokens).join(" ");
  assert.ok(!/border-s-(info|primary)/.test(timeline), "status is a node dot, not a left rail");
  // The running rung is the ui Timeline's NODE_STYLE, which is `border-info
  // bg-info ring-2 ring-info/25` — NOT the primary plate this line used to pin.
  // The pin outlived the map it described: the entry kept claiming
  // `border-primary bg-primary` until rule 5 caught it against timeline.tsx.
  assert.match(timeline, /border-info bg-info/);

  const sources = INTENT.Sources.antiPatterns.join(" ");
  assert.ok(!sources.includes("{ id, label, url }"), "no such Source shape exists");
  assert.match(sources, /href/);
});

// ── Rule 7: the coverage ratchet ─────────────────────────────────────────────
// Rules 2 and 4 only bind entries that ALREADY exist, so a brand-new ai/charts
// surface could ship with zero anti-patterns and nothing would fail. Rule 7 freezes
// today's uncovered root exports and refuses any addition.

const GATED_AI = "@elabs-ai/components-ai";
const GATED_CHARTS = "@elabs-ai/components-charts";

/** A gated-package fixture with a root, its same-module sub-parts, and a constant. */
const ratchetManifest = {
  packages: {
    [GATED_AI]: {
      components: [
        { name: "Message", module: "packages/ai/src/message.tsx" },
        { name: "MessageContent", module: "packages/ai/src/message.tsx" },
        { name: "Plan", module: "packages/ai/src/plan.tsx" },
        { name: "EMPTY_CELL", module: "packages/ai/src/plan.tsx" },
      ],
    },
    [GATED_CHARTS]: {
      components: [
        { name: "Bar", module: "packages/charts/src/charts/bar.tsx" },
        // A same-name PREFIX in a DIFFERENT module must stay a root of its own.
        { name: "BarChart", module: "packages/charts/src/charts/bar-chart.tsx" },
      ],
    },
  },
};

test("rootExports treats same-module prefixes as sub-parts and skips constants", () => {
  assert.deepEqual(rootExports(ratchetManifest.packages[GATED_AI].components), ["Message", "Plan"]);
  // `Bar` lives in its own module, so `BarChart` is NOT folded into it.
  assert.deepEqual(rootExports(ratchetManifest.packages[GATED_CHARTS].components), [
    "Bar",
    "BarChart",
  ]);
});

test("a NEW uncovered root export in a gated package fails the ratchet", () => {
  const intent = {
    Message: okEntry("ai", ["a", "b", "c"]),
    Bar: okEntry("chart", ["a", "b", "c"]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  // The baseline knows nothing about `Plan` — i.e. it was just added.
  const v = findIntentViolations({ intent, manifest: ratchetManifest, baseline: [] });
  assert.equal(v.length, 1);
  assert.match(v[0], /"Plan" is a root export with no intent metadata/);
  assert.match(v[0], /intent-coverage-baseline\.json/);
});

test("a baselined uncovered root export passes (pre-existing gaps are grandfathered)", () => {
  const intent = {
    Message: okEntry("ai", ["a", "b", "c"]),
    Bar: okEntry("chart", ["a", "b", "c"]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  const baseline = uncoveredRoots({ intent, manifest: ratchetManifest });
  assert.deepEqual(baseline, [`${GATED_AI}::Plan`]);
  assert.deepEqual(findIntentViolations({ intent, manifest: ratchetManifest, baseline }), []);
});

test("authoring intent for a baselined surface removes it from the uncovered set", () => {
  const intent = {
    Message: okEntry("ai", ["a", "b", "c"]),
    Plan: okEntry("ai", ["a", "b", "c"]),
    Bar: okEntry("chart", ["a", "b", "c"]),
    BarChart: okEntry("chart", ["a", "b", "c"]),
  };
  assert.deepEqual(uncoveredRoots({ intent, manifest: ratchetManifest }), []);
});

test("the committed baseline is in sync with the tree and only ever shrinks", () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const manifestReal = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "brand-ui.manifest.json"), "utf8"),
  );
  const live = uncoveredRoots({ intent: INTENT, manifest: manifestReal });
  const added = live.filter((k) => !baseline.includes(k));
  assert.deepEqual(added, [], "a new uncovered ai/charts root export must carry its own intent");
  assert.ok(baseline.length > 0, "the baseline records the pre-existing gaps");
});

// ── What counts as an uncovered SURFACE (the residual has to mean something) ──
// `rootExports`' prefix rule folds `MessageContent` into `Message` but not
// `UserMessage`, `EvidenceChip` or `ChartFallback` — all of which are parts of a
// module whose family entry already ships. Nor does it know that visx's
// `GradientTealBlue` is a verbatim re-export that cannot carry brand-ui intent.
// Counting those as "still owed" inflates the gap and makes the residual — the
// number #60 is judged on — unreadable.

const familyManifest = [
  { name: "Message", module: "packages/ai/src/message.tsx" },
  { name: "UserMessage", module: "packages/ai/src/message.tsx" },
  { name: "Persona", module: "packages/ai/src/persona.tsx" },
];

test("familyDocumented folds a same-module sibling into its documented family", () => {
  const intent = { Message: okEntry("ai", ["a", "b", "c"]) };
  assert.equal(familyDocumented("UserMessage", familyManifest, intent), true);
  // A sibling in a module with NO entry stays uncovered.
  assert.equal(familyDocumented("Persona", familyManifest, intent), false);
  // The documented component itself is not "covered by a sibling".
  assert.equal(familyDocumented("Message", familyManifest, intent), false);
});

test("uncoveredRoots skips documented families and third-party re-exports", () => {
  const m = {
    packages: {
      "@elabs-ai/components-ai": { components: familyManifest },
      "@elabs-ai/components-charts": {
        components: [
          { name: "GradientTealBlue", module: "packages/charts/src/charts/index.ts" },
          { name: "Bar", module: "packages/charts/src/charts/bar.tsx" },
        ],
      },
    },
  };
  const readModule = (p) =>
    p === "packages/charts/src/charts/index.ts"
      ? 'export { GradientTealBlue, LinearGradient } from "@visx/gradient";'
      : "export const Bar = () => null;";
  const intent = { Message: okEntry("ai", ["a", "b", "c"]) };
  assert.deepEqual(uncoveredRoots({ intent, manifest: m, readModule }), [
    "@elabs-ai/components-ai::Persona",
    "@elabs-ai/components-charts::Bar",
  ]);
});

test("isThirdPartyReExport only exempts genuinely foreign symbols", () => {
  const src =
    'export { GradientTealBlue } from "@visx/gradient";\n' +
    'export { Gauge } from "./gauge";\n' +
    'export { MetricCard } from "@elabs-ai/components-ui";\n';
  assert.equal(isThirdPartyReExport("GradientTealBlue", src), true);
  assert.equal(isThirdPartyReExport("Gauge", src), false, "a local re-export is our surface");
  assert.equal(
    isThirdPartyReExport("MetricCard", src),
    false,
    "a workspace re-export is still a brand-ui surface",
  );
  assert.equal(isThirdPartyReExport("Anything", null), false);
});

test("the real repo passes the real gate (exit 0)", () => {
  const out = execFileSync("node", [GATE], { encoding: "utf8" });
  assert.match(out, /✔ intent coverage/);
});

// The residual is the point of the ratchet: a green run that says nothing about the
// remaining gap trains a reader to treat "no violations" as "#60 satisfied". Lock
// both the always-on line and the `--residual` inventory.
test("a green run still reports the residual and keeps #60 open", () => {
  const out = execFileSync("node", [GATE], { encoding: "utf8" });
  const residual = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  if (residual.length === 0) {
    assert.doesNotMatch(out, /residual:/, "nothing left to report once the gap is closed");
    return;
  }
  assert.match(out, /residual: \d+ gated root surface\(s\)/);
  assert.match(out, /#60 stays OPEN/);
});

test("`--residual` lists the still-uncovered surfaces grouped by package", () => {
  const out = execFileSync("node", [GATE, "--residual"], { encoding: "utf8" });
  const residual = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  assert.match(out, /intent coverage residual/);
  for (const key of residual) {
    const [pkg, name] = key.split("::");
    assert.ok(out.includes(pkg), `${pkg} is named in the report`);
    assert.ok(out.includes(`- ${name}`), `${name} is listed as still owed`);
  }
});

test("the ai package's root surfaces are fully covered (the lopsided spoke, #60)", () => {
  const residual = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const stillOwed = residual.filter((k) => k.startsWith("@elabs-ai/components-ai::"));
  assert.deepEqual(
    stillOwed,
    [],
    "every @elabs-ai/components-ai root surface carries its own anti-patterns",
  );
});

test("every shipped llms spoke carries at least one `avoid:` line (#60 acceptance)", () => {
  const manifestReal = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "brand-ui.manifest.json"), "utf8"),
  );
  // A package that exports NO components yet cannot carry an `avoid:` line: the
  // spoke is generated from per-component intent, so a freshly scaffolded
  // package (`@elabs-ai/components-process` at ADR 0034) emits a 5-line header
  // and nothing else. The acceptance is about components that exist without
  // stated anti-patterns, not about an empty package — so the predicate is
  // "has components", derived from the manifest, never a package name list.
  // The count assertion below keeps this from going vacuous if the manifest
  // ever loses its component arrays.
  let checked = 0;
  for (const [pkg, entry] of Object.entries(manifestReal.packages ?? {})) {
    if ((entry?.components ?? []).length === 0) continue;
    const slug = pkg.replace("@elabs-ai/components-", "");
    const spoke = path.join(REPO_ROOT, "apps/docs/public/llms", `${slug}.txt`);
    const text = readFileSync(spoke, "utf8");
    assert.ok(
      text.includes("avoid:"),
      `apps/docs/public/llms/${slug}.txt has zero \`avoid:\` lines — add intent for a ${pkg} component`,
    );
    checked++;
  }
  assert.ok(
    checked >= 8,
    `expected to check at least 8 component-bearing spokes, checked ${checked}`,
  );
});
