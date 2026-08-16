/**
 * check-role-distinctness.test.mjs — locks the #385 role-distinctness gate.
 * Run in CI: `node --test scripts/check-role-distinctness.test.mjs`.
 *
 * A gate that can silently stop firing is worse than none
 * (`.claude/rules/quality-gates.md` § "Self-tested gates"), so the fixtures here
 * are INLINE strings and the negative cases plant a bad fixture and assert the
 * gate FAILS on it.
 *
 * ⚠️ THE FIXTURES CARRY CSS COMMENTS ON PURPOSE. The first version of this file
 * used only comment-free inline blocks, and that is exactly why the gate shipped
 * blind to `light --ring`: a comment in `themes.css` contains the text
 * `--info: it`, so the declaration scan started a match inside the comment and
 * swallowed the real `--ring` declaration that followed. A synthetic fixture that
 * omits the messiest thing about the real input cannot catch that class of bug —
 * the same lesson `check-session-cadence.test.mjs` records about harness noise.
 * Section H reproduces the real file's shape verbatim.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  findRoleCollisions,
  resolveToken,
  oklabDistance,
  MUST_DIFFER,
  EXEMPTIONS,
  ROLE_SEPARATION_DELTA_E,
  THEME_NAMES,
  ROOT_MODE,
} from "./check-role-distinctness.mjs";

/** Distinct, comfortably-separated defaults for every role the gate looks at. */
const BASE = {
  "--primary": "oklch(0.55 0.18 264)",
  "--ring": "oklch(0.62 0.17 220)",
  "--accent-foreground": "oklch(0.3 0.04 264)",
  // ADR 0027 — once `--ring` is brand-derived, the focus halo and the success
  // mark are two graphical marks in one colour family. Present in BASE so the
  // `(--ring, --success)` row is actually EXERCISED by the fixture: a role the
  // fixture never declares is reported `not-declared`, not "separated".
  "--success": "oklch(0.5 0.14 150)",
  "--chart-1": "oklch(0.55 0.2 300)",
  "--chart-2": "oklch(0.6 0.14 180)",
  "--chart-3": "oklch(0.65 0.15 140)",
  "--chart-4": "oklch(0.63 0.16 70)",
  "--chart-5": "oklch(0.6 0.2 20)",
  // The ADR 0025 pair: a current search match is orange, a destructive state is
  // red. Both are deep plates with white ink, which is why they are MUST_DIFFER.
  "--highlight-active": "oklch(0.56 0.16 60)",
  "--destructive": "oklch(0.55 0.21 20)",
};

/**
 * Render one theme block, with `overrides` applied on top of BASE.
 *
 * Every declaration gets a preceding COMMENT that itself mentions a `--token:`
 * sequence — the shape that broke the real gate. A fixture without this is not
 * representative of `themes.css`, which documents its own tokens inline.
 */
function block(theme, overrides = {}) {
  const sel = theme === ROOT_MODE ? ":root" : `[data-theme="${theme}"]`;
  const decls = Object.entries({ ...BASE, ...overrides })
    .map(([k, v]) => `  /* ${k} — distinct from --primary: it must not collide. */\n  ${k}: ${v};`)
    .join("\n");
  return `${sel} {\n${decls}\n}`;
}

/** A whole themes.css with per-theme overrides, e.g. `css({ drafting: {…} })`. */
function css(perTheme = {}) {
  return THEME_NAMES.map((t) => block(t, perTheme[t])).join("\n\n");
}

// Default to an EMPTY exemption list so a fixture can never be silenced by a
// future entry in the shipped EXEMPTIONS map; the exemption behaviour itself is
// exercised explicitly below.
const find = (text, opts = {}) => findRoleCollisions(text, { exemptions: new Map(), ...opts });

// ── A: a clean fixture passes — the gate is not simply always-red ─────────────

test("PASSES: every MUST_DIFFER pair comfortably separated", () => {
  assert.deepEqual(find(css()), []);
});

// ── B: a planted collision fails, and is attributed to the right theme/pair ───

test("FAILS: two MUST_DIFFER roles on one literal, no exemption (the #385 bug)", () => {
  const v = find(css({ [ROOT_MODE]: { "--ring": BASE["--primary"] } }));
  const ringPrimary = v.filter((x) => x.a === "--ring" && x.b === "--primary");
  assert.equal(ringPrimary.length, 1, "expected exactly one --ring/--primary collision");
  assert.equal(ringPrimary[0].theme, ROOT_MODE);
  assert.equal(ringPrimary[0].kind, "collision");
  assert.equal(ringPrimary[0].deltaE, 0);
});

test("FAILS: the brand-derived focus ring drifting onto the success mark (ADR 0027)", () => {
  // The #427 risk, planted: once `--ring` is a green it lives in the same family
  // as `--success`, so a later retune can slide the focus halo onto the "this
  // completed" mark — the #334 failure one role over. Byte-different on purpose;
  // the row has to catch a perceptual collapse, not only an exact alias.
  const v = find(
    css({
      [ROOT_MODE]: {
        "--ring": "oklch(0.5 0.14 150)",
        "--success": "oklch(0.51 0.14 151)",
      },
    }),
  ).filter((x) => x.a === "--ring" && x.b === "--success");
  assert.equal(v.length, 1, "expected the ring/success pair to fail");
  assert.equal(v[0].theme, ROOT_MODE);
  assert.ok(v[0].deltaE < ROLE_SEPARATION_DELTA_E, `ΔE ${v[0].deltaE} must be under the floor`);
});

test("FAILS: the current search match drifting onto the destructive red (the ADR 0025 bug)", () => {
  // The real first draft: `--highlight-active: oklch(0.58 0.21 28)` beside
  // `--destructive: oklch(0.58 0.22 27)` — byte-different, ΔE 0.011.
  const v = find(
    css({
      [ROOT_MODE]: {
        "--highlight-active": "oklch(0.58 0.21 28)",
        "--destructive": "oklch(0.58 0.22 27)",
      },
    }),
  ).filter((x) => x.a === "--highlight-active" && x.b === "--destructive");
  assert.equal(v.length, 1, "expected the highlight-active/destructive pair to fail");
  assert.ok(v[0].deltaE < ROLE_SEPARATION_DELTA_E, `ΔE ${v[0].deltaE} must be under the floor`);
});

// ── C: string inequality is NOT enough — a cosmetic nudge still fails ─────────

test("FAILS: a 0.001 nudge in L (byte-different, perceptually identical)", () => {
  const nudged = "oklch(0.551 0.18 264)"; // vs --primary oklch(0.55 0.18 264)
  assert.notEqual(nudged, BASE["--primary"], "fixture must be byte-DIFFERENT");
  const v = find(css({ [ROOT_MODE]: { "--ring": nudged } })).filter((x) => x.a === "--ring");
  assert.ok(
    v.some((x) => x.b === "--primary"),
    "a 0.001 nudge must NOT satisfy the gate — that is the whole point of the ΔE floor",
  );
  const d = oklabDistance(nudged, BASE["--primary"]);
  assert.ok(d > 0 && d < ROLE_SEPARATION_DELTA_E, `ΔE ${d} should be nonzero but below the floor`);
});

// ── D: a declared var() alias is honoured — but only where it is legitimate ───

test("PASSES: `--sidebar-primary: var(--primary)` (an intentional mirror, not MUST_DIFFER)", () => {
  const v = find(css({ [ROOT_MODE]: { "--sidebar-primary": "var(--primary)" } }));
  assert.deepEqual(v, [], "an alias between roles the gate does not police is fine");
});

test("FAILS: `--ring: var(--primary)` — var() does not launder a MUST_DIFFER pair", () => {
  const v = find(css({ [ROOT_MODE]: { "--ring": "var(--primary)" } }));
  const hit = v.find((x) => x.a === "--ring" && x.b === "--primary" && x.theme === ROOT_MODE);
  assert.ok(hit, "an alias must be resolved to its literal before comparison");
  assert.equal(hit.kind, "collision");
  assert.equal(hit.valueA, BASE["--primary"], "the alias must resolve to the target's literal");
});

test("resolveToken follows a multi-hop alias chain and guards against cycles", () => {
  const b = new Map([
    ["--a", "var(--b)"],
    ["--b", "var(--c)"],
    ["--c", "oklch(0.5 0.1 200)"],
    ["--loop", "var(--loop2)"],
    ["--loop2", "var(--loop)"],
  ]);
  const root = new Map();
  assert.equal(resolveToken("--a", b, root), "oklch(0.5 0.1 200)");
  assert.equal(resolveToken("--loop", b, root), null, "a cycle must terminate, not hang");
  assert.equal(resolveToken("--missing", b, root), null);
});

test("a var() alias TARGET may live in :root — the cascade fallback still resolves it", () => {
  // The alias target (`--brand-accent`) is declared only in `:root`; both
  // MUST_DIFFER roles are declared in the theme block itself, which is the shape
  // theme-parity guarantees. So the ONLY cascade hop here is the alias target —
  // exactly the fallback that must keep working after the `not-declared` guard.
  // (`exemptions` is explicitly emptied so this can never be silenced by a future
  // entry in the SHIPPED list — an earlier draft used drafting and went green the
  // moment drafting's ring rows were exempted.)
  const text =
    `:root {\n  --brand-accent: oklch(0.55 0.18 264);\n` +
    `  --primary: oklch(0.55 0.18 264);\n  --ring: oklch(0.45 0.21 264);\n}\n\n` +
    `[data-theme="light"] {\n  --primary: oklch(0.55 0.18 264);\n` +
    `  --ring: var(--brand-accent);\n}`;
  const v = find(text, { mustDiffer: [["--ring", "--primary"]], exemptions: new Map() });
  assert.equal(v.length, 1, "the cascade fallback to :root must be followed for an alias target");
  assert.equal(
    v[0].theme,
    "light",
    ":root's own ring/primary are distinct, so only the light theme reds",
  );
  assert.equal(v[0].kind, "collision");
  assert.equal(v[0].valueA, "oklch(0.55 0.18 264)", "the alias must resolve through :root");
});

// ── E: the exemption list is honoured AND narrow (per-theme, not per-role) ────

test("an exempted pair passes in ITS theme while the same pair still fails elsewhere", () => {
  const collide = { "--ring": BASE["--primary"] };
  const text = css({ drafting: collide, [ROOT_MODE]: collide });
  const exemptions = new Map([["drafting/--ring|--primary", "by design (test fixture)"]]);

  const v = find(text, { exemptions });
  const themes = v.filter((x) => x.a === "--ring" && x.b === "--primary").map((x) => x.theme);
  assert.deepEqual(themes, [ROOT_MODE], "the exemption must NOT travel to another theme");
});

test("every shipped EXEMPTIONS key is well-formed and names a real MUST_DIFFER pair", () => {
  const known = new Set(MUST_DIFFER.map(([a, b]) => `${a}|${b}`));
  for (const [key, reason] of EXEMPTIONS) {
    const [theme, pair] = [key.slice(0, key.indexOf("/")), key.slice(key.indexOf("/") + 1)];
    assert.ok(THEME_NAMES.includes(theme), `exemption "${key}" names an unknown theme`);
    assert.ok(known.has(pair), `exemption "${key}" does not match any MUST_DIFFER pair`);
    assert.ok(
      typeof reason === "string" && reason.trim().length > 20,
      `exemption "${key}" must carry a real recorded reason, not a placeholder`,
    );
  }
});

// ── F: an unmeasurable pair is REPORTED, never silently passed ────────────────

test("FAILS: a MUST_DIFFER token that cannot resolve to an oklch literal is reported", () => {
  const text =
    `:root {\n  --ring: #ff0000;\n  --primary: oklch(0.55 0.18 264);\n}\n\n` +
    `[data-theme="drafting"] {\n  --ring: oklch(0.9 0.01 1);\n  --primary: oklch(0.2 0.1 200);\n}`;
  const v = find(text, { mustDiffer: [["--ring", "--primary"]] });
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "unresolved", "a hex/calc value must be surfaced, not skipped");
  assert.equal(v[0].theme, ROOT_MODE);
});

// ── G: the real themes.css is measured — the gate is actually wired to it ─────

test("MUST_DIFFER is non-trivial and never duplicates the #334 ROLE_PAIRS rows", () => {
  assert.ok(MUST_DIFFER.length >= 5, "a one-pair gate would be theatre");
  const keys = MUST_DIFFER.map(([a, b]) => `${a}|${b}`);
  assert.equal(new Set(keys).size, keys.length, "MUST_DIFFER contains a duplicate pair");
  for (const owned of [
    "--success|--primary",
    "--primary|--success",
    "--ring|--info",
    "--info|--ring",
  ]) {
    assert.ok(
      !keys.includes(owned),
      `${owned} is owned by ROLE_PAIRS in themes-contrast.test.ts (#334) — do not duplicate it`,
    );
  }
});

// ── H: comment blindness — the #385 fix-round-1 defect, locked ────────────────
//
// Every test above uses `block()`, which now emits a `--token:`-bearing comment
// before each declaration, so the whole suite exercises the comment path. These
// pin the specific shapes that broke the shipped gate.

test("FAILS: a collision whose declaration is preceded by a comment naming another token", () => {
  // The comment's `--primary:` must not swallow the `--ring:` that follows it.
  const text =
    `:root {\n  --primary: oklch(0.55 0.18 264);\n  --chart-1: oklch(0.2 0.1 20);\n` +
    `  /* BLUE focus ring — distinct from the brand AND from --primary: it used\n` +
    `     to be byte-identical, so a ring read as the default button. */\n` +
    `  --ring: oklch(0.55 0.18 264);\n}`;
  const v = find(text, { mustDiffer: [["--ring", "--primary"]] });
  assert.equal(v.length, 1, "the comment must not hide the --ring declaration");
  assert.equal(v[0].kind, "collision");
  assert.equal(v[0].valueA, "oklch(0.55 0.18 264)", "--ring must resolve to its OWN literal");
});

test("a comment mentioning a token does not corrupt that token's parsed value", () => {
  const text =
    `:root {\n  --info: oklch(0.6 0.15 240);\n` +
    `  /* distinct from --info: it used to be byte-identical to the info fill. */\n` +
    `  --ring: oklch(0.45 0.21 264);\n  --primary: oklch(0.55 0.18 264);\n` +
    `  --chart-1: oklch(0.62 0.17 264);\n}`;
  // If the comment were parsed, `--info` would hold prose and `--ring` would be
  // absent — which surfaces as a `not-declared` violation, never a silent pass.
  const v = find(text, { mustDiffer: [["--ring", "--primary"]] });
  assert.deepEqual(v, [], "a correctly-parsed block has no violation here");
});

test("FAILS loudly (not silently) when a MUST_DIFFER role is absent from a theme block", () => {
  // light omits --ring entirely; :root has one. The gate must NOT quietly
  // compare :root's ring to light's primary — that is how the real defect
  // stayed invisible. It must report `not-declared`.
  const text =
    `:root {\n  --ring: oklch(0.45 0.21 264);\n  --primary: oklch(0.55 0.18 264);\n}\n\n` +
    `[data-theme="light"] {\n  --primary: oklch(0.553 0.143 153);\n}`;
  const v = find(text, { mustDiffer: [["--ring", "--primary"]] });
  const qb = v.filter((x) => x.theme === "light");
  assert.equal(qb.length, 1, "expected exactly one light finding");
  assert.equal(qb[0].kind, "not-declared");
  assert.equal(qb[0].a, "--ring");
});

// ── I: the gate is connected to the REAL file (the assertion that was missing) ─
//
// Deliberate exception to "fixtures only": the defect was not in the logic, it
// was in what the logic could SEE of `packages/tokens/src/themes.css`. Only a
// check against the real bytes catches that. This is also the coverage
// enumeration — it fails if any MUST_DIFFER role becomes invisible in any theme.

test("every MUST_DIFFER role resolves in every theme of the REAL themes.css", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const real = readFileSync(join(here, "..", "packages", "tokens", "src", "themes.css"), "utf8");
  const roles = [...new Set(MUST_DIFFER.flat())];

  // `not-declared` is emitted for any role the gate cannot see in a block.
  const blind = findRoleCollisions(real, { exemptions: new Map() }).filter(
    (v) => v.kind === "not-declared" || v.kind === "unresolved",
  );
  assert.deepEqual(
    blind,
    [],
    `the gate cannot see some role(s) in the real themes.css: ` +
      blind.map((b) => `${b.theme}/${b.a}`).join(", "),
  );
  assert.ok(roles.length >= 6, "MUST_DIFFER should cover a real set of roles");
});
