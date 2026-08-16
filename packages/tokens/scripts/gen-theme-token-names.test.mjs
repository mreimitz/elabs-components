/**
 * gen-theme-token-names.test.mjs — self-test for the theme token CONTRACT
 * generator (ADR 0029). Runs in the tokens package's vitest suite, like its
 * sibling `lib/themes-io.test.mjs`.
 *
 * The contract is the one thing a consumer's theme is validated against, in a
 * repo where none of our gates can reach. So the failure that matters is not a
 * crash — it is a contract that derives FEWER tokens than it should, or none at
 * all: every "my theme covers THEME_TOKEN_NAMES" assertion downstream then
 * passes vacuously. These tests pin the derivation itself (union across theme
 * blocks, `:root` excluded, machinery excluded) and the empty-output refusal.
 */
import { describe, it, expect } from "vitest";

import { readThemesCss, themeTokenContract } from "./lib/themes-io.mjs";
import { assertNonEmptyContract, renderModule } from "./gen-theme-token-names.mjs";
import { THEME_TOKEN_NAMES } from "../src/theme-token-names.generated";

describe("themeTokenContract", () => {
  // Blocks are written the way themes.css writes them — closing brace on its own
  // line — because that is what `locateBlock` matches.
  it("takes the UNION across theme blocks, so a token only one theme declares still counts", () => {
    const css = `
:root {
  --root-only-thing: 1;
}
[data-theme="light"] {
  --background: oklch(1 0 0);
  --only-in-light: oklch(0 0 0);
}
[data-theme="dark"] {
  --background: oklch(0 0 0);
  --only-in-dark: oklch(1 0 0);
}
`;
    expect(themeTokenContract(css)).toEqual(["--background", "--only-in-dark", "--only-in-light"]);
  });

  it("excludes the `:root` block — it is the neutral base, not a theme", () => {
    const css = `
:root {
  --base-only: 1;
  --background: oklch(1 0 0);
}
[data-theme="light"] {
  --background: oklch(1 0 0);
}
`;
    expect(themeTokenContract(css)).not.toContain("--base-only");
  });

  it("excludes root-only machinery a theme must not redeclare", () => {
    const css = `
[data-theme="light"] {
  --background: oklch(1 0 0);
  --decoration: 0;
  --radius: 0.25rem;
  --font-sans: Inter;
  --t-fast: 120ms;
  --duration-fast: 120ms;
  --deco-grid: oklch(0 0 0);
  --motion-factor: 1;
}
`;
    expect(themeTokenContract(css)).toEqual(["--background"]);
  });

  it("ignores a `--token:`-shaped mention inside a comment (#401 class of bug)", () => {
    const css = `
[data-theme="light"] {
  /* the ring must stay distinct from --info: see ADR 0027 */
  --ring: oklch(0.6 0.15 110);
}
`;
    expect(themeTokenContract(css)).toEqual(["--ring"]);
  });

  it("returns an empty list — not a crash — when nothing matches", () => {
    // The precondition of the refusal below. A silently-empty contract is the
    // whole hazard, so it must be produceable in order to be guarded.
    expect(themeTokenContract("/* no theme blocks at all */")).toEqual([]);
  });
});

describe("assertNonEmptyContract", () => {
  it("refuses an empty contract rather than writing one", () => {
    expect(() => assertNonEmptyContract([])).toThrow(/ZERO tokens/);
  });

  it("passes a real contract through unchanged", () => {
    const contract = ["--background", "--foreground"];
    expect(assertNonEmptyContract(contract)).toBe(contract);
  });
});

describe("renderModule", () => {
  it("emits the list as a const tuple plus its type", () => {
    const out = renderModule(["--background", "--foreground"]);
    expect(out).toContain("export const THEME_TOKEN_NAMES = [");
    expect(out).toContain('  "--background",');
    expect(out).toContain("] as const;");
    expect(out).toContain("export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];");
  });

  it("is pure — same input, byte-identical output (the freshness gate depends on it)", () => {
    const contract = ["--a", "--b"];
    expect(renderModule(contract)).toBe(renderModule(contract));
  });
});

describe("the committed generated module", () => {
  it("matches what the generator would write from the real themes.css", () => {
    // Same property `pnpm token-contract:check` gates in CI, asserted here too so
    // a local `pnpm --filter @elabs/components-tokens test` catches the drift.
    const contract = themeTokenContract(readThemesCss());
    expect([...THEME_TOKEN_NAMES]).toEqual(contract);
  });

  it("is substantial — a shrunken contract means the extraction broke", () => {
    expect(THEME_TOKEN_NAMES.length).toBeGreaterThan(50);
  });
});
