/**
 * role-distinctness — co-occurring semantic roles stay perceptually distinct (#385).
 *
 * theme-parity proves every theme DEFINES every token; themes-contrast.test.ts
 * proves a token clears a ratio against a SURFACE. Neither expresses distinctness —
 * a property of two tokens against each other. #334 found `--success`
 * byte-identical to `--primary`; #385 found five roles on ONE literal in `:root`.
 *
 * Measured as Euclidean distance in OKLab (ΔE ≥ 0.05, the same floor as
 * `ROLE_SEPARATION_DELTA_E` in themes-contrast.test.ts), never string inequality —
 * a 0.001 nudge in L is still one colour. `var(--…)` aliases are resolved first, so
 * an alias never launders a MUST_DIFFER pair (an alias between roles NOT listed —
 * `--sidebar-primary: var(--primary)` — is the sanctioned intentional mirror).
 *
 * Every theme block (`:root` as `root` + each BUILT_IN_THEMES block) is measured.
 * A role missing from a block is reported `not-declared` (never silently compared
 * against `:root`'s value); a value that does not resolve to `oklch()` is reported
 * `unresolved`. Comments are blanked before parsing: themes.css prose contains
 * `--info: it used to be…`, which once swallowed the real `--ring` declaration.
 *
 * Complementary, keep all three: `ROLE_PAIRS` (themes-contrast.test.ts) owns
 * `(success, primary)` and `(ring, info)` — not duplicated here; this rule proves
 * the TOKENS differ; decoration-collapse proves the difference survives to the pixel.
 *
 * Fix a collision by retuning ONE side in packages/tokens/tokens/themes/<theme>.tokens.json
 * and re-running `pnpm --filter @elabs-ai/components-tokens tokens:build`.
 */
import {
  blockDeclarations,
  extractBlock,
  ROOT_MODE,
  themeFixture,
  themeSet,
} from "../lib/themes.mjs";

export const ROLE_SEPARATION_DELTA_E = 0.05;

/**
 * Roles that can be on screen SIMULTANEOUSLY and whose only carrier is colour. `[a, b]`.
 *
 * NOT here, on purpose:
 *   - `(--success, --primary)`, `(--ring, --info)` — owned by `ROLE_PAIRS` (#334).
 *   - `(--primary, --chart-1)` — series 1 ships as a chart-tuned cousin of the brand
 *     hue on purpose (control chrome vs data mark); see the exemption rule below.
 *   - `(--ring, --primary-text|--success-text|--info-text)` — a 2px stroke and a word
 *     of text are different channels; advisory only (ADR 0027).
 *   - the `--sidebar-*` mirrors — intentional `var()` aliases, supposed to be equal.
 */
export const MUST_DIFFER = [
  // REMOVED 2026-08-16 — (--ring, --primary) and (--ring, --chart-1).
  //
  // The reference themes now declare `--ring: var(--primary)` outright: an
  // explicit maintainer decision that the focus indicator IS the brand plate,
  // superseding ADR 0027 clauses 1 and 3 (see that ADR's amendment, and the long
  // note on `--ring` in packages/tokens/src/themes/light.css).
  //
  // (--ring, --primary) could not survive as an exemption. This file's own rule
  // says an exemption is scoped to one (theme, pair) and must cite that theme's
  // design contract; a pair that needs exempting in a POLYCHROME theme is not an
  // invariant, so it is deleted rather than laundered. Both reference themes
  // alias it, so there was no theme left for the row to protect.
  //
  // (--ring, --chart-1) went with it as a direct consequence: with the ring
  // aliased to the plate, that row IS (--primary, --chart-1) — a pair this list
  // deliberately declines to gate (see THE RULE below: series 1 ships as a
  // chart-tuned cousin of the brand hue on purpose). Keeping it would have
  // enforced, through a renamed left-hand side, exactly what the file argues
  // must not be enforced.
  //
  // WHAT IS NO LONGER GUARDED, in plain terms: nothing here now stops a focus
  // ring from rendering in the primary colour, because that is the shipped
  // intent. If the ring is ever given an independent value again, restore BOTH
  // rows.
  //
  // STILL REMOVED AFTER THE #67 FIX (2026-09-04) — read this before "restoring"
  // them. The 1.23-1.42:1 light-theme focus indicator these two rows used to
  // guard against is FIXED, and the themes-contrast exemption that recorded it
  // is gone. But the fix is a COMPOUND indicator — the ring plus a
  // `--ring-contour` hairline (the `focus-ring` utility) — not an un-aliasing:
  // `--ring: var(--primary)` still ships in both reference themes, exactly as
  // the maintainer decided. So the condition these rows were waiting on has
  // NOT been met; adding either back reds the gate on both reference themes and
  // would reverse a decision this repo took twice. The 1.4.11 obligation moved
  // to where it belongs — the INDICATOR, asserted as
  // `max(ring, ring-contour) ≥ 3:1` per surface in themes-contrast.test.ts.
  //
  // A hovered/selected row's ink vs the focus ring — both are "attention" cues
  // that must be told apart.
  ["--accent-foreground", "--ring"],
  // The focus ring and the success mark, once the ring is brand-derived
  // (ADR 0027). Both are graphical MARKS in the green family — a focus halo
  // that reads as "this completed" is the #334 failure one role over. The
  // (--ring, --info) half of this lives in ROLE_PAIRS (themes-contrast.test.ts,
  // #334) and is deliberately NOT duplicated here.
  ["--ring", "--success"],
  // The CURRENT search match vs a destructive state (ADR 0025). Both are deep,
  // saturated plates with white ink; collapsed, "the match you are on" reads as
  // an error. The first draft of `--highlight-active` shipped at ΔE 0.011 from
  // `--destructive` in `:root` — an undeclared alias — which is why this pair is
  // an invariant rather than a comment.
  ["--highlight-active", "--destructive"],
  // Categorical series are, by definition, distinguished from each other. Any
  // two collapsing makes two series one. All 66 pairs of the twelve-series ramp
  // are enumerated below, not generated, so that a reviewer reading this list
  // sees the same thing the gate enforces.
  //
  // ENUMERATED, NOT LOOPED, ON PURPOSE. The ramp is authored as three hue
  // FAMILIES (yellow 1/4/7, blue 2/5/8/10, grey 3/6/9/11/12) interleaved so the
  // first three series drawn are one per family. The tempting shortcut — gate
  // cross-family pairs and exempt the within-family ones — is what this list
  // refuses: an intra-family exemption would make the palette ordinal, and a
  // chart that draws series 1 and 4 as independent categories would then be
  // free to draw them in two shades of the same lime. Every pair is real
  // because any two can co-occur.
  ["--chart-1", "--chart-2"],
  ["--chart-1", "--chart-3"],
  ["--chart-1", "--chart-4"],
  ["--chart-1", "--chart-5"],
  ["--chart-1", "--chart-6"],
  ["--chart-1", "--chart-7"],
  ["--chart-1", "--chart-8"],
  ["--chart-1", "--chart-9"],
  ["--chart-1", "--chart-10"],
  ["--chart-1", "--chart-11"],
  ["--chart-1", "--chart-12"],
  ["--chart-2", "--chart-3"],
  ["--chart-2", "--chart-4"],
  ["--chart-2", "--chart-5"],
  ["--chart-2", "--chart-6"],
  ["--chart-2", "--chart-7"],
  ["--chart-2", "--chart-8"],
  ["--chart-2", "--chart-9"],
  ["--chart-2", "--chart-10"],
  ["--chart-2", "--chart-11"],
  ["--chart-2", "--chart-12"],
  ["--chart-3", "--chart-4"],
  ["--chart-3", "--chart-5"],
  ["--chart-3", "--chart-6"],
  ["--chart-3", "--chart-7"],
  ["--chart-3", "--chart-8"],
  ["--chart-3", "--chart-9"],
  ["--chart-3", "--chart-10"],
  ["--chart-3", "--chart-11"],
  ["--chart-3", "--chart-12"],
  ["--chart-4", "--chart-5"],
  ["--chart-4", "--chart-6"],
  ["--chart-4", "--chart-7"],
  ["--chart-4", "--chart-8"],
  ["--chart-4", "--chart-9"],
  ["--chart-4", "--chart-10"],
  ["--chart-4", "--chart-11"],
  ["--chart-4", "--chart-12"],
  ["--chart-5", "--chart-6"],
  ["--chart-5", "--chart-7"],
  ["--chart-5", "--chart-8"],
  ["--chart-5", "--chart-9"],
  ["--chart-5", "--chart-10"],
  ["--chart-5", "--chart-11"],
  ["--chart-5", "--chart-12"],
  ["--chart-6", "--chart-7"],
  ["--chart-6", "--chart-8"],
  ["--chart-6", "--chart-9"],
  ["--chart-6", "--chart-10"],
  ["--chart-6", "--chart-11"],
  ["--chart-6", "--chart-12"],
  ["--chart-7", "--chart-8"],
  ["--chart-7", "--chart-9"],
  ["--chart-7", "--chart-10"],
  ["--chart-7", "--chart-11"],
  ["--chart-7", "--chart-12"],
  ["--chart-8", "--chart-9"],
  ["--chart-8", "--chart-10"],
  ["--chart-8", "--chart-11"],
  ["--chart-8", "--chart-12"],
  ["--chart-9", "--chart-10"],
  ["--chart-9", "--chart-11"],
  ["--chart-9", "--chart-12"],
  ["--chart-10", "--chart-11"],
  ["--chart-10", "--chart-12"],
  ["--chart-11", "--chart-12"],

  // ── ORDERED ramps (RM-018) ────────────────────────────────────────────────
  // A different shape of invariant from the twelve categorical rows above, and
  // deliberately NOT the same "every pair" enumeration. A sequential ramp IS
  // ordinal: `--chart-seq-2` and `--chart-seq-5` are SUPPOSED to be two rungs of
  // one hue, and gating them apart at the same floor as two independent
  // categories would either force the ladder to span more lightness than the
  // ≥3:1 mark bar leaves it, or force chroma into the ramp until it stops
  // reading as one hue. What must hold is that NEIGHBOURS are told apart — if
  // step N and step N+1 collapse, the ladder silently loses a rung, and every
  // non-adjacent pair follows from that plus the monotonicity assertion in
  // `charts-contrast.test.ts` (which is the other half of this invariant: drop
  // it and adjacency alone would permit a ramp that wanders).
  ["--chart-seq-1", "--chart-seq-2"],
  ["--chart-seq-2", "--chart-seq-3"],
  ["--chart-seq-3", "--chart-seq-4"],
  ["--chart-seq-4", "--chart-seq-5"],
  ["--chart-seq-5", "--chart-seq-6"],
  ["--chart-seq-6", "--chart-seq-7"],
  ["--chart-mono-1", "--chart-mono-2"],
  ["--chart-mono-2", "--chart-mono-3"],
  ["--chart-mono-3", "--chart-mono-4"],
  ["--chart-mono-4", "--chart-mono-5"],
  ["--chart-mono-5", "--chart-mono-6"],
  ["--chart-mono-6", "--chart-mono-7"],
  // The DIVERGING ramp is enumerated in FULL — all ten pairs — because it is not
  // one ordered run but two arms meeting at a neutral, and both arms are on
  // screen at once in the chart that needs it (a signed bar column, a
  // correlation matrix). "Negative two rungs" reading as "positive two rungs" is
  // a sign error, not a lost rung, so every pair is real here in the same way
  // every pair of the categorical ramp is.
  ["--chart-div-neg-2", "--chart-div-neg-1"],
  ["--chart-div-neg-2", "--chart-div-mid"],
  ["--chart-div-neg-2", "--chart-div-pos-1"],
  ["--chart-div-neg-2", "--chart-div-pos-2"],
  ["--chart-div-neg-1", "--chart-div-mid"],
  ["--chart-div-neg-1", "--chart-div-pos-1"],
  ["--chart-div-neg-1", "--chart-div-pos-2"],
  ["--chart-div-mid", "--chart-div-pos-1"],
  ["--chart-div-mid", "--chart-div-pos-2"],
  ["--chart-div-pos-1", "--chart-div-pos-2"],
  // The "wire" palette draws ONE hero colour over the neutral ladder. That is
  // literally a co-occurrence of `--chart-accent` with every mono step, so the
  // hero collapsing into any rung of its own ground is the failure the palette
  // exists to avoid. `--chart-accent` is `var(--chart-1)`, so these rows also
  // pin the ladder away from the brand plate.
  ["--chart-accent", "--chart-mono-1"],
  ["--chart-accent", "--chart-mono-2"],
  ["--chart-accent", "--chart-mono-3"],
  ["--chart-accent", "--chart-mono-4"],
  ["--chart-accent", "--chart-mono-5"],
  ["--chart-accent", "--chart-mono-6"],
  ["--chart-accent", "--chart-mono-7"],
];
/**
 * By-design equalities, keyed `"<theme>/<roleA>|<roleB>"` (MUST_DIFFER order), each
 * with the decision that justifies it. HAND-AUTHORED, never recorded from the current
 * state — that is the difference between an invariant and a ratchet.
 *
 * THE RULE: an exemption is scoped to ONE `(theme, pair)` and cites that THEME'S OWN
 * design contract. A pair needing an exemption in a POLYCHROME theme is not an
 * invariant — delete the pair from MUST_DIFFER instead (why `(--primary, --chart-1)`
 * is absent: ΔE 0.0463 light / 0.0544 dark, by design).
 */
export const EXEMPTIONS = new Map([
  // Empty on purpose: the only entries ever carried were for a theme no longer shipped.
]);

/** Resolve a token to its `oklch()` literal through `var()` aliases, block then `:root`. */
export function resolveToken(name, block, root, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = block.get(name) ?? root.get(name);
  if (raw == null) return null;
  if (/^oklch\(/i.test(raw)) return raw;
  const alias = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return alias ? resolveToken(alias[1], block, root, seen) : null;
}

function parseOklch(input) {
  const m = input.trim().match(/^oklch\(\s*([^)]+)\)$/i);
  if (!m) return null;
  const coords = m[1].split("/")[0].trim().split(/\s+/).filter(Boolean);
  if (coords.length < 3) return null;
  const [l, c, h] = coords.map(Number);
  return [l, c, h].some(Number.isNaN) ? null : { l, c, h };
}

/** Euclidean OKLab distance between two `oklch()` literals (same as themes-contrast.test.ts). */
export function oklabDistance(a, b) {
  const toLab = (raw) => {
    const p = parseOklch(raw);
    if (!p) return null;
    const rad = (p.h * Math.PI) / 180;
    return [p.l, p.c * Math.cos(rad), p.c * Math.sin(rad)];
  };
  const A = toLab(a);
  const B = toLab(b);
  return A && B ? Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) : null;
}

/**
 * Pure: violations for a joined theme CSS over `modes` (`root` + theme names).
 * @returns {{ theme, a, b, kind: "collision"|"unresolved"|"not-declared", deltaE, valueA, valueB }[]}
 */
export function findRoleCollisions(cssText, modes, opts = {}) {
  const exemptions = opts.exemptions ?? EXEMPTIONS;
  const mustDiffer = opts.mustDiffer ?? MUST_DIFFER;
  const floor = opts.floor ?? ROLE_SEPARATION_DELTA_E;
  const rootBody = extractBlock(cssText, ROOT_MODE);
  const root = rootBody ? blockDeclarations(rootBody) : new Map();
  const out = [];
  const missing = new Set();
  for (const theme of modes) {
    const body = extractBlock(cssText, theme);
    if (body == null) continue; // an absent block is theme-parity's job
    const block = blockDeclarations(body);
    for (const [a, b] of mustDiffer) {
      if (exemptions.has(`${theme}/${a}|${b}`)) continue;
      for (const role of [a, b])
        if (!block.has(role) && !missing.has(`${theme}/${role}`) && missing.add(`${theme}/${role}`))
          out.push({
            theme,
            a: role,
            b: role,
            kind: "not-declared",
            deltaE: null,
            valueA: null,
            valueB: null,
          });
      if (!block.has(a) || !block.has(b)) continue;
      const va = resolveToken(a, block, root);
      const vb = resolveToken(b, block, root);
      if (va == null || vb == null) {
        out.push({
          theme,
          a,
          b,
          kind: "unresolved",
          deltaE: null,
          valueA: va,
          valueB: vb,
        });
        continue;
      }
      const deltaE = oklabDistance(va, vb);
      if (deltaE == null || deltaE < floor)
        out.push({
          theme,
          a,
          b,
          kind: "collision",
          deltaE,
          valueA: va,
          valueB: vb,
        });
    }
  }
  return out;
}

function message(v) {
  if (v.kind === "not-declared")
    return `${v.theme}: ${v.a} is not declared in the block — refusing to fall back to :root (missing token, or a comment swallowed the declaration)`;
  if (v.kind === "unresolved")
    return `${v.theme}: ${v.a} / ${v.b} does not resolve to oklch() (${v.valueA ?? "?"} / ${v.valueB ?? "?"}) — unmeasurable`;
  return `${v.theme}: ${v.a} ≈ ${v.b} — ΔE(OKLab) ${v.deltaE.toFixed(4)} < ${ROLE_SEPARATION_DELTA_E} (${v.valueA} vs ${v.valueB}); retune one side (a var() alias does not help)`;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
/** Comfortably separated values for every MUST_DIFFER role. */
const BASE = {
  "--primary": "oklch(0.55 0.18 264)",
  "--ring": "oklch(0.62 0.17 220)",
  "--accent-foreground": "oklch(0.3 0.04 264)",
  "--success": "oklch(0.5 0.14 150)",
  "--chart-1": "oklch(0.55 0.2 300)",
  "--chart-2": "oklch(0.6 0.14 180)",
  "--chart-3": "oklch(0.65 0.15 140)",
  "--chart-4": "oklch(0.63 0.16 70)",
  "--chart-5": "oklch(0.6 0.2 20)",
  "--chart-6": "oklch(0.45 0.12 260)",
  "--chart-7": "oklch(0.75 0.13 100)",
  "--chart-8": "oklch(0.4 0.16 330)",
  "--chart-9": "oklch(0.7 0.18 50)",
  "--chart-10": "oklch(0.5 0.1 200)",
  "--chart-11": "oklch(0.82 0.09 160)",
  "--chart-12": "oklch(0.33 0.08 20)",
  "--chart-seq-1": "oklch(0.15 0.06 250)",
  "--chart-seq-2": "oklch(0.28 0.06 250)",
  "--chart-seq-3": "oklch(0.41 0.06 250)",
  "--chart-seq-4": "oklch(0.54 0.06 250)",
  "--chart-seq-5": "oklch(0.67 0.06 250)",
  "--chart-seq-6": "oklch(0.80 0.06 250)",
  "--chart-seq-7": "oklch(0.93 0.06 250)",
  "--chart-mono-1": "oklch(0.20 0.01 260)",
  "--chart-mono-2": "oklch(0.32 0.01 260)",
  "--chart-mono-3": "oklch(0.44 0.01 260)",
  "--chart-mono-4": "oklch(0.56 0.01 260)",
  "--chart-mono-5": "oklch(0.68 0.01 260)",
  "--chart-mono-6": "oklch(0.80 0.01 260)",
  "--chart-mono-7": "oklch(0.92 0.01 260)",
  "--chart-div-neg-2": "oklch(0.25 0.12 250)",
  "--chart-div-neg-1": "oklch(0.45 0.08 250)",
  "--chart-div-mid": "oklch(0.6 0.01 260)",
  "--chart-div-pos-1": "oklch(0.45 0.1 120)",
  "--chart-div-pos-2": "oklch(0.25 0.14 120)",
  "--chart-accent": "oklch(0.55 0.2 300)",
  "--highlight-active": "oklch(0.56 0.16 60)",
  "--destructive": "oklch(0.55 0.21 20)",
};

/** Block body; every declaration is preceded by a comment containing `--primary:` (the #385 shape). */
const body = (overrides = {}) =>
  Object.entries({ ...BASE, ...overrides })
    .map(([k, v]) => `  /* ${k} — distinct from --primary: it must not collide. */\n  ${k}: ${v};`)
    .join("\n");
const fx = (perMode = {}) =>
  themeFixture({
    root: body(perMode.root),
    themes: { light: body(perMode.light), dark: body(perMode.dark) },
  });

export default {
  id: "role-distinctness",
  scope: "themes",
  doc: "Keep co-occurring roles (focus ring vs success/accent ink, current match vs destructive, every categorical chart series, adjacent sequential/mono steps, diverging steps, accent vs mono) ≥ 0.05 ΔE(OKLab) apart in every theme, after resolving `var()` aliases.",
  baseline: "none",
  run(ctx) {
    let set;
    try {
      set = themeSet(ctx);
    } catch (err) {
      return [{ file: "packages/tokens/src/themes.css", line: 1, msg: err.message }];
    }
    const known = new Set(MUST_DIFFER.map(([a, b]) => `${a}|${b}`));
    const findings = [];
    for (const [key, reason] of EXEMPTIONS) {
      const theme = key.slice(0, key.indexOf("/"));
      const pair = key.slice(key.indexOf("/") + 1);
      if (!set.modes.includes(theme) || !known.has(pair) || String(reason).trim().length <= 20)
        findings.push({
          file: "scripts/check/rules/role-distinctness.mjs",
          line: 1,
          msg: `exemption "${key}" must name a shipped theme, a MUST_DIFFER pair and a real reason`,
        });
    }
    for (const v of findRoleCollisions(set.css, set.modes)) {
      const { file, line: blockLine } = set.locateTheme(v.theme);
      const start = set.css.indexOf(v.theme === ROOT_MODE ? ":root" : `[data-theme="${v.theme}"]`);
      const at = v.kind === "not-declared" ? -1 : set.css.indexOf(`\n  ${v.a}:`, start);
      findings.push({
        ...(at < 0 ? { file, line: blockLine } : set.locate(at + 1)),
        msg: message(v),
      });
    }
    return findings;
  },
  fixtures: {
    pass: [
      fx(),
      // an alias between roles the rule does not police is fine
      fx({ root: { "--sidebar-primary": "var(--primary)" } }),
    ],
    fail: [
      fx({ root: { "--accent-foreground": BASE["--ring"] } }),
      fx({
        light: {
          "--ring": "oklch(0.5 0.14 150)",
          "--success": "oklch(0.51 0.14 151)",
        },
      }),
      fx({
        dark: {
          "--highlight-active": "oklch(0.58 0.21 28)",
          "--destructive": "oklch(0.58 0.22 27)",
        },
      }),
      // a 0.001 nudge in L is byte-different but the same colour
      fx({ root: { "--chart-2": "oklch(0.551 0.2 300)" } }),
      // var() does not launder a MUST_DIFFER pair
      fx({ root: { "--ring": "var(--success)" } }),
      // adjacent sequential steps collapsing
      fx({ light: { "--chart-seq-4": "oklch(0.41 0.06 250)" } }),
      // an unresolvable value is reported, not skipped
      fx({ root: { "--ring": "#ff0000" } }),
      // a role absent from a theme block is reported, never compared against :root
      {
        files: {
          ...fx().files,
          "packages/tokens/src/themes/dark.css": `[data-theme="dark"] {\n${body().replace(/\n {2}--ring: [^\n]*/, "")}\n}\n`,
        },
      },
    ],
  },
};
