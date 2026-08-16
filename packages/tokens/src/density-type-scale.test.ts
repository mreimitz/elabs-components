/**
 * density-type-scale.test.ts — the density dial scales TYPE as well as spacing
 * (#340), and the three properties that make that safe.
 *
 * Source-parsed, like themes-contrast.test.ts / themes-base-layer.test.ts: jsdom
 * does not apply `@theme`/`@layer` rules from a raw stylesheet, so a computed-
 * style assertion there would prove nothing about what a browser renders. The
 * arithmetic below IS what a browser computes, because every scaled declaration
 * is literally `calc(<base> * <factor>)` — the structural assertions in
 * "wiring" prove the shape, and these numbers then follow.
 *
 * (The rendered counterpart — the same numbers read out of a real Chromium via
 * getComputedStyle at each density — was measured by hand when this landed; the
 * side-by-side story `Foundations/Typography → Density scale` is the standing
 * visual surface.)
 *
 * What is locked, and why each matters:
 *
 *   IDENTITY   `comfortable` (and no attribute at all) must be the EXACT
 *              pre-#340 scale. A regression here silently resizes every screen
 *              in the library, not just the dense ones.
 *   DIRECTION  `compact` must actually shrink and `spacious` actually grow —
 *              otherwise the feature is inert and nobody notices.
 *   FLOOR      compact body may not fall below 13px, and no role below 11px.
 *              This is the whole reason type moves at half spacing's rate.
 *   SCOPE      weight/tracking are never redeclared per density, and every role
 *              is redeclared in every block (a forgotten role would render at
 *              full size inside a compact region — worse than not scaling).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const themesCss = readFileSync(join(__dirname, "themes.css"), "utf8");
const densityCss = readFileSync(join(__dirname, "density.css"), "utf8");

/** The eight semantic type roles (themes.css § TYPE SCALE). */
const ROLES = ["display", "title", "subtitle", "body", "caption", "meta", "kpi", "code"] as const;
type Role = (typeof ROLES)[number];

const DENSITIES = ["compact", "comfortable", "spacious"] as const;
type Density = (typeof DENSITIES)[number];

/** The browser default root font size; the px floors below are stated at it. */
const ROOT_PX = 16;
/** Body may not render below this in ANY density (sustained-reading floor). */
const BODY_FLOOR_PX = 13;
/** No role may render below this in ANY density (metadata floor). */
const ROLE_FLOOR_PX = 11;

/** `[data-density="x"] { … }` body from density.css. */
function densityBlock(density: Density): string {
  const re = new RegExp(`\\[data-density="${density}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`);
  const body = densityCss.match(re)?.[1];
  if (!body) throw new Error(`density.css has no [data-density="${density}"] block`);
  return body;
}

/** A `--token: <value>;` declaration's value, or undefined. */
function decl(body: string, token: string): string | undefined {
  const re = new RegExp(`(?:^|\\n)\\s*${token.replace(/[-]/g, "\\-")}\\s*:\\s*([^;]+);`);
  return body.match(re)?.[1]?.trim();
}

/** A rem literal from themes.css § TYPE SCALE BASE, in px at ROOT_PX. */
function basePx(kind: "size" | "leading", role: Role): number {
  const value = decl(themesCss, `--type-${kind}-${role}`);
  if (!value) throw new Error(`themes.css declares no --type-${kind}-${role}`);
  const rem = value.match(/^([\d.]+)rem$/)?.[1];
  if (!rem) throw new Error(`--type-${kind}-${role} is "${value}", expected a rem literal`);
  return Number(rem) * ROOT_PX;
}

/** The `--type-factor` a density block declares. */
function factor(density: Density): number {
  const value = decl(densityBlock(density), "--type-factor");
  if (!value) throw new Error(`[data-density="${density}"] declares no --type-factor`);
  return Number(value);
}

/** What a role renders at, in px, under a density — the browser's own calc(). */
function renderedPx(kind: "size" | "leading", role: Role, density: Density): number {
  return basePx(kind, role) * factor(density);
}

describe("density type scale — wiring", () => {
  // The mechanism only works if the @theme roles alias the SEPARATE base layer.
  // Inline literals there would make the density blocks' calc() a dangling
  // reference; `var(--text-*)` there would be a cycle when [data-density] lands
  // on :root (which is what ThemeProvider does). Both fail loudly here.
  it.each(ROLES)("@theme --text-%s aliases the unscaled base layer", (role) => {
    expect(decl(themesCss, `--text-${role}`)).toBe(`var(--type-size-${role})`);
    expect(decl(themesCss, `--text-${role}--line-height`)).toBe(`var(--type-leading-${role})`);
  });

  it.each(DENSITIES)("[data-density=%s] rescales every role's size and leading", (density) => {
    const body = densityBlock(density);
    for (const role of ROLES) {
      expect(decl(body, `--text-${role}`)).toBe(
        `calc(var(--type-size-${role}) * var(--type-factor))`,
      );
      expect(decl(body, `--text-${role}--line-height`)).toBe(
        `calc(var(--type-leading-${role}) * var(--type-factor))`,
      );
    }
  });

  // Weight is a semantic rung and tracking is authored in `em` (so it follows
  // the scaled size on its own). Redeclaring either would change what the scale
  // MEANS at compact, not just how big it is.
  it.each(DENSITIES)("[data-density=%s] never rescales weight or tracking", (density) => {
    const body = densityBlock(density);
    expect(body).not.toMatch(/--text-[\w-]+--font-weight\s*:/);
    expect(body).not.toMatch(/--text-[\w-]+--letter-spacing\s*:/);
  });
});

describe("density type scale — comfortable is the exact identity", () => {
  it("declares --type-factor: 1", () => {
    expect(factor("comfortable")).toBe(1);
  });

  // The strongest form of the identity claim: every role renders at exactly the
  // base literal, to the bit — not "close enough".
  it.each(ROLES)("%s renders at its unscaled base size and leading", (role) => {
    expect(renderedPx("size", role, "comfortable")).toBe(basePx("size", role));
    expect(renderedPx("leading", role, "comfortable")).toBe(basePx("leading", role));
  });

  // The pre-#340 scale, transcribed from the values this branch started from.
  // Pins the base layer itself, so "comfortable == identity" cannot be satisfied
  // by moving the base and the factor together.
  it.each([
    ["display", 30, 36],
    ["title", 20, 28],
    ["subtitle", 16, 24],
    ["body", 14, 20],
    ["caption", 13, 18],
    ["meta", 12, 16],
    ["kpi", 32, 36],
    ["code", 13, 22],
  ] as const)("%s base is still %ipx / %ipx", (role, size, leading) => {
    expect(basePx("size", role)).toBe(size);
    expect(basePx("leading", role)).toBe(leading);
  });
});

describe("density type scale — compact shrinks, spacious grows", () => {
  it("moves type in the same direction as spacing, at roughly half the rate", () => {
    expect(factor("compact")).toBeLessThan(1);
    expect(factor("spacious")).toBeGreaterThan(1);
    // Spacing moves ~11-12% per step; type must move materially less, or dense
    // screens become unreadable. 8% is the ceiling this decision accepted.
    expect(1 - factor("compact")).toBeLessThan(0.08);
    expect(factor("spacious") - 1).toBeLessThan(0.08);
    // ...and materially MORE than nothing, or the dial is a no-op in disguise.
    expect(1 - factor("compact")).toBeGreaterThan(0.03);
  });

  it.each(ROLES)("compact renders %s smaller than comfortable", (role) => {
    expect(renderedPx("size", role, "compact")).toBeLessThan(basePx("size", role));
    expect(renderedPx("leading", role, "compact")).toBeLessThan(basePx("leading", role));
  });

  it.each(ROLES)("spacious renders %s larger than comfortable", (role) => {
    expect(renderedPx("size", role, "spacious")).toBeGreaterThan(basePx("size", role));
    expect(renderedPx("leading", role, "spacious")).toBeGreaterThan(basePx("leading", role));
  });

  // Leading is scaled by the SAME factor as size, so the type colour (the
  // size:leading ratio) is identical at every density — compact is the same
  // typography, smaller, not a differently-proportioned one.
  it.each(ROLES)("%s keeps its size:leading ratio at every density", (role) => {
    const ratio = basePx("leading", role) / basePx("size", role);
    for (const density of DENSITIES) {
      expect(renderedPx("leading", role, density) / renderedPx("size", role, density)).toBeCloseTo(
        ratio,
        10,
      );
    }
  });
});

describe("density type scale — legibility floor", () => {
  // The binding constraint on the compact factor. 14px body × 0.9375 = 13.125px:
  // above the floor with headroom, rather than sitting exactly on it.
  it(`body never renders below ${BODY_FLOOR_PX}px`, () => {
    for (const density of DENSITIES) {
      expect(renderedPx("size", "body", density)).toBeGreaterThanOrEqual(BODY_FLOOR_PX);
    }
  });

  // The scale's smallest rung (meta, 12px) is the one that gets closest.
  it.each(ROLES)(`%s never renders below ${ROLE_FLOOR_PX}px`, (role) => {
    for (const density of DENSITIES) {
      expect(renderedPx("size", role, density)).toBeGreaterThanOrEqual(ROLE_FLOOR_PX);
    }
  });
});
