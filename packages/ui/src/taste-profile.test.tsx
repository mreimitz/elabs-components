/**
 * taste-profile.test.tsx — the RENDERED half of the taste profile (#108).
 *
 * The type/default surface is locked in `packages/tokens/src/taste-profile.test.ts`;
 * this file exercises the real `<ThemeProvider>` in a DOM, which `@…-tokens`
 * cannot do (its vitest environment is `node` by design — no React, no jsdom).
 * `@…-ui` already ships the jsdom + Testing Library setup and legitimately
 * depends on tokens (one-way dep graph), so the provider's live behaviour is
 * proven here rather than mocked anywhere.
 */
import { useState } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEFAULT_TASTE_PROFILE,
  DEFAULT_THEME,
  BUILT_IN_THEME_META,
  ThemeProvider,
  useDecoration,
  useDensity,
  useMotionPreference,
  useTasteProfile,
  type DecorationLevel,
} from "@elabs/components-tokens";

/** A probe that prints the live profile and drives every axis from context. */
function Probe() {
  const { profile, setRegister } = useTasteProfile();
  const { setDensity } = useDensity();
  const { setDecoration } = useDecoration();
  const { setMotionPreference } = useMotionPreference();
  const [level, setLevel] = useState<DecorationLevel>(0);
  return (
    <div>
      <output data-testid="profile">{JSON.stringify(profile)}</output>
      <button onClick={() => setRegister("brand")}>brand</button>
      <button onClick={() => setDensity("compact")}>compact</button>
      {/* stands in for a real app's motion control (Settings → Motion) */}
      <button onClick={() => setMotionPreference("full")}>full motion</button>
      <button
        onClick={() => {
          const next = ((level + 6) % 12) as DecorationLevel;
          setLevel(next);
          setDecoration(next);
        }}
      >
        decorate
      </button>
    </div>
  );
}

const profile = () => JSON.parse(screen.getByTestId("profile").textContent ?? "{}");

describe("useTasteProfile", () => {
  beforeEach(() => {
    window.localStorage.clear();
    for (const attr of ["data-register", "data-density", "data-decoration"]) {
      document.documentElement.removeAttribute(attr);
    }
  });

  it("returns the restrained defaults inside a bare ThemeProvider", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(profile()).toEqual(DEFAULT_TASTE_PROFILE);
    // The register is an inspectable seam on the root — no CSS keys off it.
    expect(document.documentElement.getAttribute("data-register")).toBe("product");
  });

  it("setRegister writes data-register and persists it", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "brand" }));
    expect(profile().register).toBe("brand");
    expect(document.documentElement.getAttribute("data-register")).toBe("brand");
    expect(window.localStorage.getItem("brand-ui-taste-register")).toBe("brand");
  });

  it("rehydrates the persisted register on mount", () => {
    window.localStorage.setItem("brand-ui-taste-register", "brand");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(profile().register).toBe("brand");
  });

  it("ignores a junk persisted register and falls back to the default", () => {
    window.localStorage.setItem("brand-ui-taste-register", "marketing");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(profile().register).toBe("product");
  });

  it("tracks live changes on the density axis", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "compact" }));
    expect(profile().density).toBe("compact");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });

  it("expressiveness IS the effective decoration level (one dial, two names)", async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(profile().expressiveness).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "decorate" }));
    expect(profile().expressiveness).toBe(6);
    expect(document.documentElement.getAttribute("data-decoration")).toBe("6");
  });

  it("expressiveness follows the THEME's own decoration default when unset", () => {
    render(
      <ThemeProvider defaultTheme={DEFAULT_THEME}>
        <Probe />
      </ThemeProvider>,
    );
    // With no override the profile must report the theme's EFFECTIVE level (its
    // registry default), never the (null) override. Read from the registry so a
    // retuned theme can't silently make this vacuous.
    expect(profile().expressiveness).toBe(
      BUILT_IN_THEME_META[DEFAULT_THEME as "light" | "dark"].decorationLevel ?? 0,
    );
  });

  it("honours an explicit defaultRegister", () => {
    render(
      <ThemeProvider defaultRegister="brand">
        <Probe />
      </ThemeProvider>,
    );
    expect(profile().register).toBe("brand");
  });
});

/**
 * The scaffold contract (#109): an app-spec's `taste` block becomes ThemeProvider
 * props, and NOTHING else — no hardcoded density/expressiveness in component
 * source. These lock that a spec-driven provider actually writes the dials, for
 * both shipped presets.
 */
describe("a spec-driven ThemeProvider writes the profile onto the root", () => {
  beforeEach(() => {
    window.localStorage.clear();
    for (const attr of ["data-register", "data-density", "data-decoration", "data-motion-pref"]) {
      document.documentElement.removeAttribute(attr);
    }
  });

  it("product / calm — the restrained default omits the identity dials", () => {
    render(
      <ThemeProvider
        defaultRegister="product"
        defaultDensity="comfortable"
        defaultMotionPreference="system"
        defaultDecoration={0}
      >
        <Probe />
      </ThemeProvider>,
    );
    const root = document.documentElement;
    expect(root.getAttribute("data-register")).toBe("product");
    // comfortable + "system" are identity values: no attribute, so the first
    // paint is pixel-identical to a provider-less build (zero-flash).
    expect(root.getAttribute("data-density")).toBeNull();
    expect(root.getAttribute("data-motion-pref")).toBeNull();
    expect(root.getAttribute("data-decoration")).toBe("0");
    expect(profile()).toEqual({
      register: "product",
      density: "comfortable",
      motion: "system",
      expressiveness: 0,
    });
  });

  it("brand / expressive — every non-identity dial lands on the root", () => {
    render(
      <ThemeProvider
        defaultRegister="brand"
        defaultDensity="spacious"
        defaultMotionPreference="reduced"
        defaultDecoration={4}
      >
        <Probe />
      </ThemeProvider>,
    );
    const root = document.documentElement;
    expect(root.getAttribute("data-register")).toBe("brand");
    expect(root.getAttribute("data-density")).toBe("spacious");
    expect(root.getAttribute("data-motion-pref")).toBe("reduced");
    // expressiveness IS decoration — one dial, one attribute.
    expect(root.getAttribute("data-decoration")).toBe("4");
    expect(profile()).toEqual({
      register: "brand",
      density: "spacious",
      motion: "reduced",
      expressiveness: 4,
    });
  });

  /**
   * The a11y half of #108 AC3. `[data-motion-pref="full"]` is the ONE state that
   * keeps `--motion-factor: 1` under an OS `prefers-reduced-motion: reduce` and
   * opts out of the third-party animation cap (packages/tokens/src/themes.css) —
   * informed consent, given by a PERSON for themselves. So:
   *   · no scaffold preset ships it (stages.md), and the app-spec schema rejects a
   *     spec that defaults to it (scripts/check-app-spec.test.mjs);
   *   · `system` — what the presets DO ship — writes no attribute at all, which is
   *     precisely what lets the OS rule win.
   */
  it('the scaffold defaults ("system") write NO motion attribute, so the OS rule wins', () => {
    render(
      <ThemeProvider defaultRegister="brand" defaultMotionPreference="system" defaultDecoration={4}>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute("data-motion-pref")).toBeNull();
    expect(profile().motion).toBe("system");
  });

  it('"full" is reachable only as the person\'s own explicit choice', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    // Nothing an app is scaffolded with puts the override on the root…
    expect(document.documentElement.getAttribute("data-motion-pref")).toBeNull();
    // …only a motion control the person operates does.
    await userEvent.click(screen.getByRole("button", { name: "full motion" }));
    expect(document.documentElement.getAttribute("data-motion-pref")).toBe("full");
    expect(profile().motion).toBe("full");
  });
});
