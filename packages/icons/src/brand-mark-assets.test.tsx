import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BrandLogo } from "./brand-logo";

/**
 * The brand mark ships THREE times: as `BrandLogo`, as the browser-tab favicon,
 * and as the Storybook manager's logo. The two static files cannot use the
 * component — a favicon is rendered outside the app and the manager renders
 * outside React — so they are copies, and a copy drifts.
 *
 * These tests are the teeth on the "kept in sync BY HAND" comment those files
 * carry: they compare the actual drawn geometry, so re-tuning the component and
 * forgetting the assets fails here instead of shipping three different logos.
 */

/** Walk up from the package to the workspace root, so the paths below don't
    depend on how deep this package happens to sit. */
function repoRoot(): string | null {
  let dir = process.cwd();
  while (!existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  return dir;
}

/** `null` when the file is absent — this package is also consumed as a published
    tarball, where neither the workspace root nor `apps/docs` exists. Missing
    assets SKIP; drifted assets FAIL. Silently passing on either would defeat the
    point, so the skip is scoped to "not in this workspace" and nothing else. */
function repoFile(rel: string): string | null {
  const root = repoRoot();
  if (root === null) return null;
  const path = resolve(root, rel);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

const FAVICON = repoFile("apps/docs/public/brand-favicon.svg");
const MANAGER_LOGO = repoFile("apps/docs/public/brand-logo.svg");
const MANAGER_CONFIG = repoFile("apps/docs/.storybook/manager.ts");
const inWorkspace = FAVICON !== null && MANAGER_LOGO !== null && MANAGER_CONFIG !== null;

/** Every drawn shape's coordinates, in document order. Colour is deliberately
    excluded — the assets carry literals where the component carries tokens. */
function geometry(svg: string): string[] {
  const attrs = (tag: string, names: string[]) =>
    [...svg.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((m) => {
      const el = m[0];
      const read = (n: string) => el.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1] ?? "";
      return `${tag}:${names.map(read).join(",")}`;
    });
  return [
    ...attrs("rect", ["x", "y", "width", "height", "stroke-dasharray", "stroke-width"]),
    ...attrs("circle", ["cx", "cy", "r"]),
    ...attrs("line", ["x1", "y1", "x2", "y2"]),
  ];
}

describe("brand mark assets stay in sync with BrandLogo", () => {
  const { container } = render(<BrandLogo variant="mark" />);
  const component = geometry(container.innerHTML);

  it("draws something to compare (guards against a vacuous pass)", () => {
    // square + clip circle + outline circle + 2 dots + hatch + 2 stray strokes
    expect(component.length).toBeGreaterThan(10);
  });

  it.skipIf(!inWorkspace)(
    "keeps the favicon's circle+square coordinates in sync with BrandLogo — deliberately NOT full parity (issue #2)",
    () => {
      // Comment 3 (2026-08-30, the maintainer decision on issue #2) narrowed the
      // favicon to a SIMPLIFIED small-size variant: the full mark's 45° hatch
      // fuses into a textureless blob at the 16px a browser tab actually renders
      // it at, so the favicon drops the hatch, the two stray strokes and the two
      // register dots, keeping only the circle-over-square silhouette (plus a
      // raised fill-opacity on the plane, asserted separately below). This test
      // therefore does NOT assert full geometry parity — that would just
      // re-encode the removed complexity as a false requirement — but it must
      // still catch an ACCIDENTAL drift on the two shapes that ARE kept, and an
      // accidental return of the shapes that were deliberately dropped.
      const favicon = geometry(FAVICON ?? "");

      // What MUST still match: the square's coordinates, straight off the
      // component's own rendered geometry (not retyped), so a future re-tune of
      // BrandLogo's SQUARE constant still fails this test if the favicon isn't
      // updated to match.
      const rectEntries = component.filter((entry) => entry.startsWith("rect:"));
      expect(favicon.filter((entry) => entry.startsWith("rect:"))).toEqual(rectEntries);

      // The circle outline's cx/cy/r appear TWICE in the component's own render
      // (once as the clip-path definition that clips the now-dropped hatch, once
      // as the drawn ring) — that recurring value is CIRCLE, the shape the
      // simplified favicon must still match. The two register dots each appear
      // only once and are excluded from this check on purpose: they're one of
      // the deliberately-dropped shapes, verified absent below.
      const circleCounts = new Map<string, number>();
      for (const entry of component) {
        if (!entry.startsWith("circle:")) continue;
        circleCounts.set(entry, (circleCounts.get(entry) ?? 0) + 1);
      }
      const circleOutline = [...circleCounts.entries()].find(([, count]) => count >= 2)?.[0];
      expect(circleOutline, "component's own circle-outline coordinates").toBeDefined();
      expect(favicon.filter((entry) => entry.startsWith("circle:"))).toEqual([circleOutline]);

      // What MUST be gone: the hatch + stray strokes (every <line>) and the two
      // register dots (any circle OTHER than the outline above, already asserted
      // by the exact-array check).
      expect(favicon.filter((entry) => entry.startsWith("line:"))).toEqual([]);
    },
  );

  it.skipIf(!inWorkspace)(
    "raises the favicon plane's fill-opacity above the component's 0.22 (issue #2) so it still reads as a plane once the hatch that used to carry its texture is gone",
    () => {
      const opacity = Number((FAVICON ?? "").match(/<rect\b[^>]*\bfill-opacity="([^"]*)"/)?.[1]);
      expect(opacity).toBeGreaterThan(0.22);
      expect(opacity).toBeLessThanOrEqual(1);
    },
  );

  it.skipIf(!inWorkspace)("matches the Storybook manager logo", () => {
    // The manager file also carries the outlined wordmark, which is <path> data
    // and therefore outside `geometry`'s shape list.
    expect(geometry(MANAGER_LOGO ?? "")).toEqual(component);
  });

  it.skipIf(!inWorkspace)("keeps the static files parseable as standalone images", () => {
    // An XML comment may not contain a double hyphen. Writing a token name with
    // its `--` prefix in the header comment makes the file unparseable when it is
    // loaded via <img> or as a favicon — and it fails SILENTLY, as a blank icon.
    for (const [name, svg] of [
      ["brand-favicon.svg", FAVICON ?? ""],
      ["brand-logo.svg", MANAGER_LOGO ?? ""],
    ] as const) {
      for (const comment of svg.matchAll(/<!--([\s\S]*?)-->/g)) {
        expect(comment[1], `${name} has a double hyphen inside an XML comment`).not.toMatch(/--/);
      }
    }
  });

  it.skipIf(!inWorkspace)("paints the brand plane with ONE literal everywhere", () => {
    // Colour is outside `geometry` (the component carries tokens where the assets
    // carry literals), so the plane hex is the one value the parity tests above
    // cannot see. It appears three times outside the token stylesheet: both static
    // SVGs and the Storybook manager's active-item colour, which renders outside
    // React and so cannot read a token either.
    // Each source states the colour its own way — the favicon in a CSS rule (so a
    // media query can flip the ink beside it), the manager logo on the element,
    // the manager config as a JS string — so each gets its own reader rather than
    // one loose regex that could match the wrong hex in any of them.
    const found: Array<[string, string | undefined]> = [
      [
        "brand-favicon.svg",
        (FAVICON ?? "").match(/\.plane\s*\{[^}]*fill:\s*(#[0-9A-Fa-f]{6})/)?.[1],
      ],
      ["brand-logo.svg", (MANAGER_LOGO ?? "").match(/<rect\b[^>]*\bfill="(#[0-9A-Fa-f]{6})"/)?.[1]],
      ["manager.ts", (MANAGER_CONFIG ?? "").match(/colorSecondary:\s*"(#[0-9A-Fa-f]{6})"/)?.[1]],
    ];
    for (const [name, hex] of found) {
      expect(
        hex,
        `no plane colour found in ${name} — it changed shape, so this test went blind`,
      ).toBeDefined();
    }
    expect(
      new Set(found.map(([, hex]) => hex?.toUpperCase())).size,
      `the plane hex drifted: ${found.map(([n, h]) => `${n}=${h}`).join(", ")}`,
    ).toBe(1);
  });
});
