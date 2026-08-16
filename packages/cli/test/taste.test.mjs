// taste.test.mjs — the machine-readable taste profile (#108).
//
// The audit skill used to be told "pick the register" by a human; the epic's AC4
// is that the tooling READS the active profile instead. These lock the three
// pieces that makes real: (1) the vocabulary + restrained defaults are parsed
// from `theme-types.ts` (so the manifest can't drift from the types), (2) a
// project's optional `brand-ui.config.json` overrides them and junk degrades to
// the default rather than throwing, and (3) `brand-ui info --json` actually
// carries the block.
//
// Run: node --test  (from packages/cli) — `pnpm --filter @…-cli test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  findRepoRoot,
  generateManifest,
  parseTaste,
  resolveTasteProfile,
  tasteSearchDirs,
  FALLBACK_TASTE_PROFILE,
} from "../lib/core.mjs";
import { planScaffold } from "../lib/engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const bin = join(here, "..", "bin", "brand-ui.mjs");
const repoRoot = findRepoRoot(here);

/** A throwaway project dir carrying a `brand-ui.config.json`. */
function withConfig(taste) {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-taste-"));
  writeFileSync(join(dir, "brand-ui.config.json"), JSON.stringify({ taste }, null, 2));
  return dir;
}

test("parseTaste reads the vocabulary + restrained defaults from theme-types.ts", () => {
  const taste = parseTaste(repoRoot);
  assert.deepEqual(taste.axes.register, ["product", "brand"]);
  assert.deepEqual(taste.axes.density, ["compact", "comfortable", "spacious"]);
  assert.deepEqual(taste.axes.motion, ["system", "reduced", "full"]);
  assert.deepEqual(taste.defaults, {
    register: "product",
    density: "comfortable",
    motion: "system",
    expressiveness: 0,
  });
  // expressiveness IS the decoration dial — recorded so nobody mints a second knob.
  assert.equal(taste.expressivenessDial, "--decoration");
  assert.equal(taste.axes.expressiveness.dial, "--decoration");
});

test("the manifest carries the taste block", () => {
  const manifest = generateManifest(repoRoot);
  assert.ok(manifest.taste, "manifest.taste exists");
  assert.equal(manifest.taste.defaults.register, "product");
});

test("resolveTasteProfile falls back to the restrained defaults with no config", () => {
  const p = resolveTasteProfile({ dirs: [mkdtempSync(join(tmpdir(), "brand-ui-empty-"))] });
  assert.equal(p.source, "default");
  assert.equal(p.register, FALLBACK_TASTE_PROFILE.register);
  assert.equal(p.expressiveness, 0);
  assert.deepEqual(p.invalid, []);
});

test("a project's brand-ui.config.json overrides the defaults", () => {
  const dir = withConfig({ register: "brand", density: "compact", expressiveness: 6 });
  try {
    const p = resolveTasteProfile({ manifest: generateManifest(repoRoot), dirs: [dir] });
    assert.equal(p.register, "brand");
    assert.equal(p.density, "compact");
    assert.equal(p.expressiveness, 6);
    assert.equal(p.motion, "system", "an unset axis keeps its default");
    assert.equal(p.source, "config");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a bad config value degrades to the default and is reported, never thrown", () => {
  const dir = withConfig({ register: "marketing", expressiveness: 99, nonsense: true });
  try {
    const p = resolveTasteProfile({ manifest: generateManifest(repoRoot), dirs: [dir] });
    assert.equal(p.register, "product", "junk register falls back");
    assert.equal(p.expressiveness, 0, "out-of-range expressiveness falls back");
    assert.ok(p.invalid.some((i) => i.startsWith("register=")));
    assert.ok(p.invalid.some((i) => i.startsWith("expressiveness=")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed JSON in brand-ui.config.json never breaks resolution", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-broken-"));
  writeFileSync(join(dir, "brand-ui.config.json"), "{ not json");
  try {
    const p = resolveTasteProfile({ dirs: [dir] });
    assert.equal(p.register, "product");
    assert.equal(p.source, "default");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`brand-ui info --json` carries the resolved taste block", () => {
  const res = spawnSync(process.execPath, [bin, "info", "--json"], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
  assert.equal(res.status, 0, `info exited cleanly:\n${res.stderr}`);
  const ctx = JSON.parse(res.stdout);
  assert.ok(ctx.taste, "info --json has a taste block");
  assert.deepEqual(
    {
      register: ctx.taste.register,
      density: ctx.taste.density,
      motion: ctx.taste.motion,
      expressiveness: ctx.taste.expressiveness,
    },
    { register: "product", density: "comfortable", motion: "system", expressiveness: 0 },
  );
});

test("`brand-ui audit --register=brand` reports which bar it judged against", () => {
  const target = join(repoRoot ?? here, "packages/ui/src/components/bento-grid");
  const res = spawnSync(process.execPath, [bin, "audit", target, "--register=brand"], {
    encoding: "utf8",
    cwd: repoRoot ?? here,
  });
  assert.equal(res.status, 0, `audit exited cleanly:\n${res.stderr}`);
  assert.match(res.stdout, /judged against: register brand/);
});

// ── the two scaffold profiles end-to-end (#109) ─────────────────────────────
// The interview's stage-5 output has to survive into the scaffold plan, and the
// "Verify before done" audit has to be able to PASS on realistic generated
// source (otherwise the blocking bar is unmeetable) and FAIL on placeholder slop
// (otherwise it is decorative). Both halves are asserted here, hermetically.

const PRODUCT_CALM = {
  register: "product",
  density: "comfortable",
  motion: "system",
  expressiveness: 0,
};
// NOTE the motion axis: the shipped "Expressive" preset is `system`, NOT `full`.
// `[data-motion-pref="full"]` keeps --motion-factor at 1 THROUGH an OS
// `prefers-reduced-motion: reduce` request (packages/tokens/src/themes.css), so as
// a scaffold default it would suppress every visitor's OS setting. `system`
// already animates fully whenever the OS is neutral. See
// skills/brand-ui-new-app/reference/stages.md + the app-spec schema, which rejects
// a spec that defaults motion to "full".
const BRAND_EXPRESSIVE = {
  register: "brand",
  density: "comfortable",
  motion: "system",
  expressiveness: 4,
};

for (const [label, taste, archetype] of [
  ["product/calm", PRODUCT_CALM, "dashboard"],
  ["brand/expressive", BRAND_EXPRESSIVE, "marketing"],
]) {
  test(`planScaffold carries the ${label} taste profile through to the plan`, () => {
    const plan = planScaffold(
      { archetype, theme: "light", title: "T", taste },
      {
        root: repoRoot,
      },
    );
    assert.equal(plan.status, "planned", plan.error ?? "");
    assert.deepEqual(plan.spec.taste, taste);
  });
}

test("a spec with no taste block plans fine (restrained default applies)", () => {
  const plan = planScaffold({ archetype: "dashboard", theme: "light" }, { root: repoRoot });
  assert.equal(plan.status, "planned");
  assert.equal(plan.spec.taste, undefined, "absent means the restrained default, not an error");
});

/**
 * Write a one-file "generated app" and audit it as the scaffold flow would.
 * Returns `{ report, status }` — the exit code matters as much as the report
 * now that `--strict` is the gate the skills cite.
 */
function auditRun(source, extraArgs = [], { cwd = null, config = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-scaffold-"));
  writeFileSync(join(dir, "app.tsx"), source);
  if (config) writeFileSync(join(dir, "brand-ui.config.json"), JSON.stringify({ taste: config }));
  try {
    const res = spawnSync(process.execPath, [bin, "audit", dir, "--json", ...extraArgs], {
      encoding: "utf8",
      cwd: cwd ?? dir,
    });
    assert.ok(res.stdout, `audit printed a report:\n${res.stderr}`);
    return { report: JSON.parse(res.stdout), status: res.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The report only, asserting a clean (non-strict) exit. */
function auditGenerated(source, extraArgs = []) {
  const { report, status } = auditRun(source, extraArgs);
  assert.equal(status, 0, "a non-strict audit always exits 0 (it reports, it doesn't gate)");
  return report;
}

// Realistic, domain-specific scaffold output: real names, specific figures, a
// real product name, semantic tokens only. This is what "done" must be able to
// look like.
const CLEAN_SCAFFOLD = `export function PipelineOverview() {
  const owners = ["Priya Raghunathan", "Tomas Lindqvist"];
  return (
    <section className="bg-card text-foreground rounded-md border p-4">
      <h2 className="text-title">Renewals at risk</h2>
      <p className="text-muted-foreground text-body">4 of 37 accounts, EUR 812,400 exposed.</p>
      <ul>{owners.map((o) => <li key={o} className="text-body">{o}</li>)}</ul>
    </section>
  );
}
`;

test("the blocking bar is MEETABLE: realistic generated source reports zero content slop", () => {
  const report = auditGenerated(CLEAN_SCAFFOLD);
  assert.equal(report.contentSlop, 0, JSON.stringify(report.findings, null, 2));
  assert.equal(
    report.findings.filter((f) => !f.advisory).length,
    0,
    "and no blocking token/style findings either",
  );
});

test("the blocking bar has TEETH: placeholder scaffold output reports content slop", () => {
  const report = auditGenerated(
    `export const rows = [{ owner: "Jane Doe", account: "Acme", sla: "99.99%" }];\n`,
  );
  assert.ok(report.contentSlop >= 3, `expected the three tells, got ${report.contentSlop}`);
  const ids = new Set(report.findings.map((f) => f.rule));
  for (const id of ["slop-generic-name", "slop-brand-name", "slop-fake-number"]) {
    assert.ok(ids.has(id), id);
  }
});

test("content slop is reported in the brand register too (never register-excused)", () => {
  const report = auditGenerated(`export const hero = { author: "John Doe", uptime: "99.9%" };\n`, [
    "--register=brand",
  ]);
  assert.equal(report.taste.register, "brand");
  assert.ok(report.contentSlop >= 2);
});

test("an audit run outside the monorepo still resolves a profile (consumer mode)", () => {
  const report = auditGenerated(CLEAN_SCAFFOLD);
  assert.ok(report.taste, "the report always states the bar it judged against");
  assert.equal(report.taste.register, "product", "the restrained default with no config");
});

// ── the bar has an EXIT CODE, not just a paragraph (#109 AC2) ───────────────
// "Content slop blocks done" was agent prose while the CLI exited 0 and headlined
// slop as "advisory". `--strict` is the gate the skills now cite; these lock it.

const SLOP_SCAFFOLD = `export const rows = [{ owner: "Jane Doe", account: "Acme", sla: "99.99%" }];\n`;

test("--strict EXITS 1 on placeholder slop (the gate the skills cite)", () => {
  const { report, status } = auditRun(SLOP_SCAFFOLD, ["--strict"]);
  assert.equal(status, 1, "content slop must fail the process, not just print");
  assert.equal(report.strict, true);
  assert.equal(report.failed, true);
  assert.ok(report.contentSlop >= 3);
});

test("--strict EXITS 1 on a blocking style finding (raw colour)", () => {
  const { report, status } = auditRun(
    `export const Bad = () => <div className="bg-[#ff0000]" />;\n`,
    ["--strict"],
  );
  assert.equal(status, 1);
  assert.ok(report.blocking >= 1, "raw hex is a blocking style finding");
  assert.equal(report.contentSlop, 0, "…and not miscounted as content slop");
});

test("--strict EXITS 0 on realistic generated source (the bar stays meetable)", () => {
  const { report, status } = auditRun(CLEAN_SCAFFOLD, ["--strict"]);
  assert.equal(status, 0, JSON.stringify(report.findings, null, 2));
  assert.equal(report.failed, false);
});

test("content slop is NEVER counted as advisory in the report buckets", () => {
  const { report } = auditRun(SLOP_SCAFFOLD, ["--strict"]);
  assert.equal(report.advisory, 0, "the three tells are content-slop, not advisory filler");
  const slopFindings = report.findings.filter((f) => f.category === "content-slop");
  assert.equal(slopFindings.length, report.contentSlop);
});

test("the human headline names content slop as blocking (it used to say advisory)", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-headline-"));
  writeFileSync(join(dir, "app.tsx"), SLOP_SCAFFOLD);
  try {
    const res = spawnSync(process.execPath, [bin, "audit", dir], { encoding: "utf8", cwd: dir });
    assert.equal(res.status, 0, "without --strict it still only reports");
    assert.match(res.stdout, /content-slop \(blocking\)/);
    assert.doesNotMatch(res.stdout, /0 issue\(s\), 3 advisory/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── the config that travels WITH the audited app wins (#109) ────────────────
// `brand-ui audit <app>` from the monorepo used to judge the app against the
// MONOREPO's profile — i.e. it ignored the very brand-ui.config.json the new-app
// scaffold writes beside the generated app.

test("audit resolves the taste config from the TARGET, not only the cwd", () => {
  const { report } = auditRun('export const A = () => <div className="rounded-3xl" />;\n', [], {
    cwd: repoRoot ?? here, // run from somewhere else entirely
    config: { register: "brand", expressiveness: 4 },
  });
  assert.equal(report.taste.register, "brand", "the app's own config decided the bar");
  assert.equal(report.taste.expressiveness, 4);
  assert.equal(report.taste.source, "config");
  const overRound = report.findings.find((f) => f.rule === "over-round");
  assert.ok(overRound, "the tell is still reported");
  assert.equal(overRound.advisory, true, "…and softened to advisory by the brand register");
});

test('a project config that declares motion "full" is called out, not accepted quietly', () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-ui-motion-"));
  writeFileSync(join(dir, "app.tsx"), CLEAN_SCAFFOLD);
  writeFileSync(
    join(dir, "brand-ui.config.json"),
    JSON.stringify({ taste: { motion: "full" } }, null, 2),
  );
  try {
    const res = spawnSync(process.execPath, [bin, "audit", dir], { encoding: "utf8", cwd: dir });
    assert.match(res.stdout, /motion full/, "the resolved profile is still reported honestly");
    assert.match(res.stdout, /informed consent, not an app default/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tasteSearchDirs orders dirs nearest-last (repo root < cwd < target)", () => {
  const dirs = tasteSearchDirs({ target: "/tmp", cwd: "/var", root: "/repo" });
  assert.deepEqual(dirs, ["/repo", "/var"], "no target config → cwd stays the winner");
  const withCfg = mkdtempSync(join(tmpdir(), "brand-ui-dirs-"));
  writeFileSync(join(withCfg, "brand-ui.config.json"), "{}");
  try {
    const ordered = tasteSearchDirs({ target: withCfg, cwd: "/var", root: "/repo" });
    assert.equal(ordered.at(-1), withCfg, "the target's own config dir wins");
    assert.deepEqual(ordered.slice(0, 2), ["/repo", "/var"], "…and root stays the weakest");
  } finally {
    rmSync(withCfg, { recursive: true, force: true });
  }
});
