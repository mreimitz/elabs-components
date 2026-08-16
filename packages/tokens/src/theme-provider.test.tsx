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
import { PAUSED_THEMES, THEMES, type ThemeName } from "./theme-types";

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
    window.localStorage.setItem(STORAGE_KEY, "qlik-dark");

    mount(
      <ThemeProvider allowedThemes={["qlik-bright"]}>
        <Probe />
      </ThemeProvider>,
    );

    // Not just "settles on the right value" — never written AT ALL, so there is
    // no frame in which the disallowed theme is on screen.
    expect(themeWrites).not.toContain("qlik-dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("qlik-bright");
    expect(latest?.theme).toBe("qlik-bright");
  });

  it("restricts useTheme().themes to the allowed subset", () => {
    mount(
      <ThemeProvider allowedThemes={["qlik-bright"]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual(["qlik-bright"]);
    expect(latest?.themes).not.toContain("qlik-dark");
  });

  it("makes setTheme a no-op (with a dev warning) for a disallowed theme", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mount(
      <ThemeProvider allowedThemes={["qlik-bright"]}>
        <Probe />
        <SetThemeOnMount to="qlik-dark" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("qlik-bright");
    expect(themeWrites).not.toContain("qlik-dark");
    // The rejected theme must not poison storage for the next boot either.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('setTheme("qlik-dark") ignored'));
  });

  it("still switches to a theme that IS allowed", () => {
    mount(
      <ThemeProvider allowedThemes={["qlik-bright", "qlik-dark"]}>
        <Probe />
        <SetThemeOnMount to="qlik-dark" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("qlik-dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("qlik-dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("qlik-dark");
  });

  it("falls back (and warns) when defaultTheme is not in allowedThemes", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    mount(
      <ThemeProvider defaultTheme="qlik-bright" allowedThemes={["qlik-dark"]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(themeWrites).not.toContain("qlik-bright");
    expect(latest?.theme).toBe("qlik-dark");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('defaultTheme "qlik-bright"'));
  });

  it("coerces the FIRST RENDER's context theme, not only the data-theme write", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mount(
      <ThemeProvider defaultTheme="qlik-bright" allowedThemes={["qlik-dark"]}>
        <RenderPhaseProbe />
      </ThemeProvider>,
    );

    // The `useState` INITIALIZER is coerced, so a child calling useTheme() during
    // the very first render already sees an allowed theme. Reverting the
    // initializer to `useState(defaultTheme)` leaves every other assertion in
    // this file green (the hydration effect corrects it before `act` returns) —
    // only this one goes red.
    expect(renderedThemes[0]).toBe("qlik-dark");
    expect(renderedThemes).not.toContain("qlik-bright");
  });

  it("does NOT warn about defaultTheme when the consumer never passed one", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // A subset that simply excludes DEFAULT_THEME ("qlik-bright") is a normal,
    // correct configuration — warning here would name a prop that was never set.
    mount(
      <ThemeProvider allowedThemes={["qlik-dark"]}>
        <Probe />
        <RenderPhaseProbe />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("qlik-dark");
    expect(renderedThemes[0]).toBe("qlik-dark");
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("defaultTheme"));
  });

  it("ignores an empty or all-unknown allowedThemes rather than exposing none", () => {
    mount(
      <ThemeProvider allowedThemes={[]}>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual([...THEMES]);
  });
});

describe("ThemeProvider — without allowedThemes (backwards compatible)", () => {
  it("exposes every shipped theme", () => {
    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(latest?.themes).toEqual([...THEMES]);
  });

  it("still applies any persisted shipped theme", () => {
    window.localStorage.setItem(STORAGE_KEY, "qlik-dark");

    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("qlik-dark");
    expect(latest?.theme).toBe("qlik-dark");
  });

  it("still allows setTheme to any shipped theme", () => {
    mount(
      <ThemeProvider>
        <Probe />
        <SetThemeOnMount to="qlik-dark" />
      </ThemeProvider>,
    );

    expect(latest?.theme).toBe("qlik-dark");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("qlik-dark");
  });

  it("never applies a persisted PAUSED theme name", () => {
    // A paused theme keeps its CSS block but leaves THEMES, so a value persisted
    // before the pause must not be honoured. See .claude/rules/paused-surfaces.md.
    window.localStorage.setItem(STORAGE_KEY, PAUSED_THEMES[0]);

    mount(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(themeWrites).not.toContain(PAUSED_THEMES[0]);
    expect(latest?.theme).toBe("qlik-bright");
  });
});
