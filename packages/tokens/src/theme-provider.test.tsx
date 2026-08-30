// @vitest-environment jsdom
/**
 * theme-provider.test.tsx — the `allowedThemes` subset contract (#355).
 *
 * A product that ships only SOME of the themes used to need three separate
 * defenses (filter the switcher, guard the persisted read before mount, and a
 * corrective effect after mount). The most regression-prone of the three is the
 * PERSISTED-DISALLOWED-VALUE path: a naive "filter the list" fix passes every
 * other assertion and still flashes a theme the product doesn't ship, because
 * the stored value is applied by the hydration effect before anything corrects
 * it. So this file records EVERY `data-theme` write, not just the final one.
 *
 * Rendered with `react-dom/client` + React 19's `act` (both already devDeps) —
 * no test-library needed for a provider with no visual surface.
 */
import { act, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";
import {
  BUILT_IN_THEMES,
  BUILT_IN_THEME_DEFINITIONS,
  defineTheme,
  type ThemeName,
} from "./theme-types";

const STORAGE_KEY = "brand-ui-theme";

let container: HTMLDivElement;
let root: Root;
/** Every value ever written to `data-theme`, in order. */
let themeWrites: string[];
let originalSetAttribute: HTMLElement["setAttribute"];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  // tokenOverrides (#17) writes inline custom properties directly onto
  // `documentElement.style` — reset between tests so one test's override
  // can't leak into the next as a false-positive "already applied" reading.
  document.documentElement.style.cssText = "";

  // jsdom ships no matchMedia; the provider tracks prefers-reduced-motion with
  // it on mount. Stub it as "no reduced-motion preference".
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));

  themeWrites = [];
  renderedThemes = [];
  originalSetAttribute = document.documentElement.setAttribute;
  document.documentElement.setAttribute = function patched(
    this: HTMLElement,
    name: string,
    value: string,
  ) {
    if (name === "data-theme") themeWrites.push(value);
    return originalSetAttribute.call(this, name, value);
  };

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.documentElement.setAttribute = originalSetAttribute;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The live context, captured so assertions can read it outside React. */
let latest: ReturnType<typeof useTheme> | null = null;

function Probe() {
  latest = useTheme();
  return null;
}

/**
 * Every value `useTheme().theme` has held DURING RENDER, in order — so
 * `renderedThemes[0]` is the first render's context value, captured before any
 * effect (including the provider's own hydration effect) has run.
 *
 * `Probe` above cannot see this: `act()` flushes effects before the assertion, so
 * by then a corrective effect would have already hidden a bad initial value. That
 * is the gap this closes — the `data-theme` WRITE path was locked, the context
 * value on the first render was not.
 */
let renderedThemes: ThemeName[];

function RenderPhaseProbe() {
  // Deliberately a render-phase side effect: it is the only way to observe the
  // value a child component would actually receive on the very first render.
  renderedThemes.push(useTheme().theme);
  return null;
}

/** Calls `setTheme` once on mount — exercises the real consumer path. */
function SetThemeOnMount({ to }: { to: ThemeName }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    setTheme(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function mount(ui: ReactNode) {
  act(() => root.render(ui));
}

describe("ThemeProvider — allowedThemes (#355)", () => {
  it("never applies a persisted theme that is outside allowedThemes", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");

    mount(
      <ThemeProvider allowedThemes={["light"]}>
        <Probe />
      </ThemeProvider>,
    );

    // Not just "settles on the right value" — never written AT ALL, so there is
    // no frame in which the disallowed theme is on screen.
    expect(themeWrites).not.toContain("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(latest?.theme).toBe("light");
  });

  it("restricts useTheme().themes to the allowed subset", () => {
    mount(
      <ThemeProvider allowedThemes={["light"]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual(["light"]);
    expect(latest?.themes).not.toContain("dark");
  });

  it("makes setTheme a no-op (with a dev warning) for a disallowed theme", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mount(
      <ThemeProvider allowedThemes={["light"]}>
        <Probe />
        <SetThemeOnMount to="dark" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("light");
    expect(themeWrites).not.toContain("dark");
    // The rejected theme must not poison storage for the next boot either.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('setTheme("dark") ignored'));
  });

  it("still switches to a theme that IS allowed", () => {
    mount(
      <ThemeProvider allowedThemes={["light", "dark"]}>
        <Probe />
        <SetThemeOnMount to="dark" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("falls back (and warns) when defaultTheme is not in allowedThemes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mount(
      <ThemeProvider defaultTheme="light" allowedThemes={["dark"]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(themeWrites).not.toContain("light");
    expect(latest?.theme).toBe("dark");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('defaultTheme "light"'));
  });

  it("coerces the FIRST RENDER's context theme, not only the data-theme write", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mount(
      <ThemeProvider defaultTheme="light" allowedThemes={["dark"]}>
        <RenderPhaseProbe />
      </ThemeProvider>,
    );

    // The `useState` INITIALIZER is coerced, so a child calling useTheme() during
    // the very first render already sees an allowed theme. Reverting the
    // initializer to `useState(defaultTheme)` leaves every other assertion in
    // this file green (the hydration effect corrects it before `act` returns) —
    // only this one goes red.
    expect(renderedThemes[0]).toBe("dark");
    expect(renderedThemes).not.toContain("light");
  });

  it("does NOT warn about defaultTheme when the consumer never passed one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // A subset that simply excludes DEFAULT_THEME ("light") is a normal,
    // correct configuration — warning here would name a prop that was never set.
    mount(
      <ThemeProvider allowedThemes={["dark"]}>
        <Probe />
        <RenderPhaseProbe />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("dark");
    expect(renderedThemes[0]).toBe("dark");
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("defaultTheme"));
  });

  it("ignores an empty or all-unknown allowedThemes rather than exposing none", () => {
    mount(
      <ThemeProvider allowedThemes={[]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual([...BUILT_IN_THEMES]);
  });
});

describe("ThemeProvider — without allowedThemes (backwards compatible)", () => {
  it("exposes every shipped theme", () => {
    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual([...BUILT_IN_THEMES]);
  });

  it("still applies any persisted shipped theme", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");

    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(latest?.theme).toBe("dark");
  });

  it("still allows setTheme to any shipped theme", () => {
    mount(
      <ThemeProvider>
        <Probe />
        <SetThemeOnMount to="dark" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("exposes the built-ins as full descriptors, in registry order", () => {
    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themeDefinitions.map((d) => d.value)).toEqual([...BUILT_IN_THEMES]);
  });

  it("never applies a persisted theme name that left the registry", () => {
    // A theme removed from the registry may still have a value persisted from an
    // earlier session; it must not be honoured on boot.
    const retired = "retired-theme";
    window.localStorage.setItem(STORAGE_KEY, retired);

    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(themeWrites).not.toContain(retired);
    expect(latest?.theme).toBe("light");
  });
});

/**
 * The open registry (ADR 0029). The property that matters is that a CONSUMER
 * theme is indistinguishable from a built-in one everywhere the provider deals
 * in themes — exposed, selectable, persistable, and able to carry its own
 * decoration default. A fix that only widened `ThemeName` to `string` would pass
 * a typecheck and still reject every consumer name at runtime, so these drive
 * the real `setTheme` / persistence / `data-theme` paths.
 */
describe("ThemeProvider — the theme registry (ADR 0029)", () => {
  const midnight = defineTheme({ value: "midnight", label: "Midnight", dark: true });
  const parchment = defineTheme({
    value: "parchment",
    label: "Parchment",
    dark: false,
    decorationLevel: 6,
  });

  it("REPLACES the built-in registry rather than extending it", () => {
    mount(
      <ThemeProvider themes={[midnight, parchment]} defaultTheme="midnight">
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual(["midnight", "parchment"]);
    expect(latest?.themes).not.toContain("light");
    expect(latest?.themeDefinitions.map((d) => d.label)).toEqual(["Midnight", "Parchment"]);
  });

  it("keeps the built-ins when the consumer spreads them in", () => {
    mount(
      <ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual([...BUILT_IN_THEMES, "midnight"]);
  });

  it("applies and persists a consumer theme like any other", () => {
    mount(
      <ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]}>
        <Probe />
        <SetThemeOnMount to="midnight" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("midnight");
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("midnight");
  });

  it("honours a persisted consumer theme on the next boot", () => {
    window.localStorage.setItem(STORAGE_KEY, "midnight");

    mount(
      <ThemeProvider themes={[...BUILT_IN_THEME_DEFINITIONS, midnight]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("midnight");
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
  });

  it("rejects a persisted theme that is not in the registry", () => {
    // Registry-relative validation, not a closed union: "midnight" is a perfectly
    // good theme name — it is just not one THIS provider offers.
    window.localStorage.setItem(STORAGE_KEY, "midnight");

    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(themeWrites).not.toContain("midnight");
    expect(latest?.theme).toBe("light");
  });

  it("makes setTheme a no-op (with a dev warning) for a theme outside the registry", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mount(
      <ThemeProvider themes={[midnight]}>
        <Probe />
        <SetThemeOnMount to="light" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("midnight");
    expect(themeWrites).not.toContain("light");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('setTheme("light") ignored'));
  });

  it("reads the effective decoration off the ACTIVE registry entry", () => {
    // Pre-0029 this was `THEME_META[theme].decorationLevel`, which throws on a
    // name the built-in table has never seen — the crash a consumer theme would
    // have hit on its first render.
    mount(
      <ThemeProvider themes={[parchment]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("parchment");
    expect(latest?.effectiveDecoration).toBe(6);
    expect(latest?.tasteProfile.expressiveness).toBe(6);
  });

  it("lets an explicit decoration override win over the theme's default", () => {
    mount(
      <ThemeProvider themes={[parchment]} defaultDecoration={0}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.effectiveDecoration).toBe(0);
  });

  it("ignores an empty registry rather than exposing none", () => {
    mount(
      <ThemeProvider themes={[]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual([...BUILT_IN_THEMES]);
  });

  it("allowedThemes still filters, now over the consumer registry", () => {
    mount(
      <ThemeProvider themes={[midnight, parchment]} allowedThemes={["parchment"]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual(["parchment"]);
    expect(latest?.theme).toBe("parchment");
  });
});

/**
 * Runtime token-VALUE overrides (#17 — no runtime token-override API,
 * docs/ADR/0031-runtime-token-overrides.md). Distinct from `themes` (which
 * registers a whole named CSS block): `tokenOverrides` patches individual
 * `--token` VALUES as inline custom properties on `attributeTarget`, layered
 * OVER whichever theme is active — the mechanism a multi-tenant/white-label
 * consumer needs so changing 1-2 brand colors doesn't require authoring all
 * ~169 THEME_TOKEN_NAMES in a forked theme block.
 */
describe("ThemeProvider — tokenOverrides (#17)", () => {
  const PRIMARY = "--primary";
  const OVERRIDE_A = "oklch(0.55 0.18 250)";
  const OVERRIDE_B = "oklch(0.70 0.20 100)";

  it("applies an override as an inline custom property on the target element — PARTIAL, not a replacement", () => {
    mount(
      <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
        <Probe />
      </ThemeProvider>,
    );

    expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);
    // The theme machinery keeps working — this is a PATCH, not a swap.
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    // A token NOT named in the override is untouched (no inline property at all).
    expect(document.documentElement.style.getPropertyValue("--secondary")).toBe("");
  });

  it("rejects (warns, does not apply) a key outside THEME_TOKEN_NAMES", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bogus = { "--not-a-real-token": "red" } as unknown as NonNullable<
      Parameters<typeof ThemeProvider>[0]["tokenOverrides"]
    >;

    mount(
      <ThemeProvider tokenOverrides={bogus}>
        <Probe />
      </ThemeProvider>,
    );

    // Not silently ignored (which would look identical to "worked") — a real
    // dev warning naming the offending key, and the property is never set.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("--not-a-real-token"));
    expect(document.documentElement.style.getPropertyValue("--not-a-real-token")).toBe("");
  });

  it("updates the inline property reactively when the prop changes (not mount-once)", () => {
    mount(
      <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);

    mount(
      <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_B }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_B);
  });

  it("removing the override restores the theme's own value (clears the inline property)", () => {
    mount(
      <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);

    // Re-render with the prop gone entirely.
    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    // The inline property is cleared, so the cascade (the active theme's own
    // `--primary`) governs again — no stale forced value left behind.
    expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("");
  });

  it("survives a theme switch — overrides are orthogonal to which theme is active", () => {
    mount(
      <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
        <Probe />
        <SetThemeOnMount to="dark" />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);
  });

  it("honors a scoped attributeTarget instead of the document root", () => {
    const scoped = document.createElement("div");
    document.body.appendChild(scoped);

    mount(
      <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }} attributeTarget={scoped}>
        <Probe />
      </ThemeProvider>,
    );

    expect(scoped.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);
    expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("");

    scoped.remove();
  });

  describe("value validation (I1 — a bad VALUE, not just a bad key)", () => {
    /** jsdom implements no `CSS` global at all, so every test here stubs it explicitly. */
    it("applies the override when CSS.supports approves the value", () => {
      vi.stubGlobal("CSS", { supports: vi.fn(() => true) });

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
          <Probe />
        </ThemeProvider>,
      );

      expect(CSS.supports).toHaveBeenCalledWith("color", OVERRIDE_A);
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);
    });

    it("rejects (warns, does not apply) a value CSS.supports refuses", () => {
      vi.stubGlobal("CSS", { supports: vi.fn(() => false) });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: "not-a-color" }}>
          <Probe />
        </ThemeProvider>,
      );

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("not-a-color"));
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("");
    });

    it("treats a value as valid (unchecked) when CSS.supports is unavailable", () => {
      // Explicit, rather than relying on jsdom's default absence of `CSS` —
      // this is the exact shape of a legacy runtime, asserted rather than assumed.
      vi.stubGlobal("CSS", undefined);

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
          <Probe />
        </ThemeProvider>,
      );

      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);
    });

    it("accepts a numeric --shadow-strength without consulting CSS.supports", () => {
      const supports = vi.fn(() => false);
      vi.stubGlobal("CSS", { supports });

      mount(
        <ThemeProvider tokenOverrides={{ "--shadow-strength": "0" }}>
          <Probe />
        </ThemeProvider>,
      );

      expect(supports).not.toHaveBeenCalled();
      expect(document.documentElement.style.getPropertyValue("--shadow-strength")).toBe("0");
    });

    it("accepts a decimal --shadow-strength and a var() alias", () => {
      mount(
        <ThemeProvider tokenOverrides={{ "--shadow-strength": "0.5" }}>
          <Probe />
        </ThemeProvider>,
      );
      expect(document.documentElement.style.getPropertyValue("--shadow-strength")).toBe("0.5");

      mount(
        <ThemeProvider tokenOverrides={{ "--shadow-strength": "var(--some-other-token)" }}>
          <Probe />
        </ThemeProvider>,
      );
      expect(document.documentElement.style.getPropertyValue("--shadow-strength")).toBe(
        "var(--some-other-token)",
      );
    });

    it("rejects (warns, does not apply) a non-numeric --shadow-strength", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      mount(
        <ThemeProvider tokenOverrides={{ "--shadow-strength": "oops" }}>
          <Probe />
        </ThemeProvider>,
      );

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("oops"));
      expect(document.documentElement.style.getPropertyValue("--shadow-strength")).toBe("");
    });

    it("skips an empty-string value instead of applying then immediately unsetting it", () => {
      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: "" }}>
          <Probe />
        </ThemeProvider>,
      );

      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("");
    });
  });

  describe("cleanup (I2/I3 — no leaked override once the target changes or the provider unmounts)", () => {
    it("clears the OLD target when attributeTarget resolves from null to a real element (the callback-ref pattern)", () => {
      // Mirrors `BringYourOwnThemeDemo`/`RuntimeTokenOverridesDemo`: on first
      // render `attributeTarget` is `null` (the ref callback hasn't fired
      // yet), so the effect falls back to `document.documentElement` — a real
      // consumer usually never SEES that frame, but the leak (#17 review I2)
      // was that the override stuck there permanently once a real target
      // showed up on the next render.
      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }} attributeTarget={null}>
          <Probe />
        </ThemeProvider>,
      );
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);

      const scoped = document.createElement("div");
      document.body.appendChild(scoped);

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }} attributeTarget={scoped}>
          <Probe />
        </ThemeProvider>,
      );

      // The new target carries it now...
      expect(scoped.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);
      // ...and the root — which is NOT the active target anymore — does not.
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("");

      scoped.remove();
    });

    it("restores the target's own value when the provider unmounts", () => {
      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
          <Probe />
        </ThemeProvider>,
      );
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);

      act(() => root.unmount());

      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("");
    });

    it("restores a SCOPED target's own value when the provider unmounts", () => {
      const scoped = document.createElement("div");
      document.body.appendChild(scoped);

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }} attributeTarget={scoped}>
          <Probe />
        </ThemeProvider>,
      );
      expect(scoped.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);

      act(() => root.unmount());

      expect(scoped.style.getPropertyValue(PRIMARY)).toBe("");
      scoped.remove();
    });

    it("restores (does not delete) a PRE-EXISTING inline value the target already carried — e.g. an SSR anti-flash override", () => {
      // Mirrors docs/CONSUMING.md §5.2's recommended workaround: a
      // server-rendered inline value on the target, present before
      // ThemeProvider's effect ever runs, unrelated to this provider's own
      // machinery. Overwriting it is expected (it's the same property); but
      // cleanup must put the ORIGINAL value back, not erase the property
      // outright — otherwise mounting-then-unmounting this provider silently
      // deletes branding this provider never owned.
      document.documentElement.style.setProperty(PRIMARY, "oklch(0.4 0.1 30)");

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }}>
          <Probe />
        </ThemeProvider>,
      );
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);

      act(() => root.unmount());

      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("oklch(0.4 0.1 30)");
    });

    it("restores the pre-existing value on the OLD target when attributeTarget resolves from null to a real element", () => {
      // Same scenario as the callback-ref test above, but the document root
      // already carried unrelated branding before the first (attributeTarget
      // === null, falls back to documentElement) effect run — that value must
      // survive the handoff to the scoped target, not just get deleted.
      document.documentElement.style.setProperty(PRIMARY, "oklch(0.4 0.1 30)");

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }} attributeTarget={null}>
          <Probe />
        </ThemeProvider>,
      );
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);

      const scoped = document.createElement("div");
      document.body.appendChild(scoped);

      mount(
        <ThemeProvider tokenOverrides={{ [PRIMARY]: OVERRIDE_A }} attributeTarget={scoped}>
          <Probe />
        </ThemeProvider>,
      );

      expect(scoped.style.getPropertyValue(PRIMARY)).toBe(OVERRIDE_A);
      // The root's original (pre-provider) branding is back, not erased.
      expect(document.documentElement.style.getPropertyValue(PRIMARY)).toBe("oklch(0.4 0.1 30)");

      scoped.remove();
    });
  });
});
