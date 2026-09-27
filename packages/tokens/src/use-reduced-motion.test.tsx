// @vitest-environment jsdom
/**
 * `useReducedMotion` — the one reduced-motion source every JS animation reads.
 *
 * - The first client render already carries the OS setting: no frame is
 *   committed with `false` before a reduced-motion OS setting lands.
 * - The person's own setting (the provider's motion preference) beats the OS.
 * - A live OS change reaches the hook.
 * - The server renders `false` (it cannot know the OS setting), and hydration
 *   then settles on the client value without a mismatch.
 * - With no `matchMedia` (jsdom, old runtimes) it is `false` and never throws.
 * - A SAVED motion preference reaches the first client render, and the
 *   provider's `prefersReducedMotion` agrees with the hook from that render on.
 */
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useMotionPreference, useReducedMotion } from "./theme-provider";
import type { MotionPreference } from "./theme-types";

/** A controllable `prefers-reduced-motion` media query. */
function stubOsReducedMotion(initial: boolean) {
  const state = { matches: initial };
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") ? state.matches : false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  return {
    set(next: boolean) {
      state.matches = next;
      for (const listener of listeners) listener();
    },
  };
}

/** Records every value the hook rendered with, in order. */
function Probe({ seen }: { seen: boolean[] }) {
  seen.push(useReducedMotion());
  return null;
}

let container: HTMLDivElement;
let root: Root | undefined;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
});

function mount(node: React.ReactNode) {
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
}

function withPreference(preference: MotionPreference, seen: boolean[]) {
  return (
    <ThemeProvider defaultMotionPreference={preference} motionStorageKey={null}>
      <Probe seen={seen} />
    </ThemeProvider>
  );
}

describe("useReducedMotion", () => {
  it("reads the OS setting in the very first render (no false frame)", () => {
    stubOsReducedMotion(true);
    const seen: boolean[] = [];
    mount(<Probe seen={seen} />);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen).not.toContain(false);
  });

  it("follows a live OS change", () => {
    const os = stubOsReducedMotion(false);
    const seen: boolean[] = [];
    mount(<Probe seen={seen} />);
    expect(seen.at(-1)).toBe(false);
    act(() => os.set(true));
    expect(seen.at(-1)).toBe(true);
  });

  it("lets the person's full-motion setting beat an OS that asks for reduced", () => {
    stubOsReducedMotion(true);
    const seen: boolean[] = [];
    mount(withPreference("full", seen));
    expect(seen).not.toContain(true);
  });

  it("lets the person's reduced setting beat an OS that allows motion", () => {
    stubOsReducedMotion(false);
    const seen: boolean[] = [];
    mount(withPreference("reduced", seen));
    expect(seen).not.toContain(false);
  });

  it("follows the OS under the provider's system preference", () => {
    stubOsReducedMotion(true);
    const seen: boolean[] = [];
    mount(withPreference("system", seen));
    expect(seen).not.toContain(false);
  });

  it("is false, and never throws, where there is no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const seen: boolean[] = [];
    mount(<Probe seen={seen} />);
    expect(seen).not.toContain(true);
  });

  it("renders false on the server and settles on the OS value after hydration", () => {
    stubOsReducedMotion(true);
    const serverSeen: boolean[] = [];
    container.innerHTML = renderToString(<Probe seen={serverSeen} />);
    expect(serverSeen).toEqual([false]);

    const clientSeen: boolean[] = [];
    const recoverable = vi.fn();
    act(() => {
      root = hydrateRoot(container, <Probe seen={clientSeen} />, {
        onRecoverableError: recoverable,
      });
    });
    // Hydration renders the server snapshot first, then the client value.
    expect(clientSeen[0]).toBe(false);
    expect(clientSeen.at(-1)).toBe(true);
    expect(recoverable).not.toHaveBeenCalled();
  });
});

// ── The saved preference and the context agree from the first render ─────────

const MOTION_KEY = "brand-ui-motion-pref";

/** One render's view of the motion state: the hook beside the context. */
interface Frame {
  hook: boolean;
  context: boolean;
  preference: string;
}

/** Records the hook and the context side by side, per render. */
function Pair({ seen }: { seen: Frame[] }) {
  const motion = useMotionPreference();
  seen.push({
    hook: useReducedMotion(),
    context: motion.prefersReducedMotion,
    preference: motion.motionPreference,
  });
  return null;
}

describe("the provider's motion state on the first render", () => {
  afterEach(() => {
    window.localStorage.removeItem(MOTION_KEY);
  });

  it("gives the context's prefersReducedMotion the hook's value in the very first render", () => {
    stubOsReducedMotion(true);
    const seen: Frame[] = [];
    mount(
      <ThemeProvider motionStorageKey={null}>
        <Pair seen={seen} />
      </ThemeProvider>,
    );
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]).toEqual({ hook: true, context: true, preference: "system" });
    for (const frame of seen) expect(frame.context).toBe(frame.hook);
  });

  it("reads a saved “full” in the first render, even when the OS asks for reduced motion", () => {
    window.localStorage.setItem(MOTION_KEY, "full");
    stubOsReducedMotion(true);
    const seen: Frame[] = [];
    mount(
      <ThemeProvider>
        <Pair seen={seen} />
      </ThemeProvider>,
    );
    expect(seen[0]).toEqual({ hook: false, context: true, preference: "full" });
    expect(seen.map((frame) => frame.hook)).not.toContain(true);
  });

  it("reads a saved “reduced” in the first render, even when the OS allows motion", () => {
    window.localStorage.setItem(MOTION_KEY, "reduced");
    stubOsReducedMotion(false);
    const seen: Frame[] = [];
    mount(
      <ThemeProvider>
        <Pair seen={seen} />
      </ThemeProvider>,
    );
    expect(seen[0]?.preference).toBe("reduced");
    expect(seen.map((frame) => frame.hook)).not.toContain(false);
  });

  it("falls back to the default when storage cannot be read", () => {
    stubOsReducedMotion(false);
    // Only the motion key throws: this round covers the motion preference.
    const realGetItem = Storage.prototype.getItem;
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (key === MOTION_KEY) throw new Error("storage is blocked");
      return realGetItem.call(this, key);
    });
    const seen: Frame[] = [];
    try {
      mount(
        <ThemeProvider defaultMotionPreference="reduced">
          <Pair seen={seen} />
        </ThemeProvider>,
      );
    } finally {
      getItem.mockRestore();
    }
    expect(seen[0]?.preference).toBe("reduced");
    expect(seen.at(-1)?.preference).toBe("reduced");
  });

  it("follows the setter, and writes the attribute and the saved value", () => {
    stubOsReducedMotion(false);
    let set: ((next: MotionPreference) => void) | undefined;
    const seen: Frame[] = [];
    function Setter() {
      set = useMotionPreference().setMotionPreference;
      return null;
    }
    mount(
      <ThemeProvider>
        <Pair seen={seen} />
        <Setter />
      </ThemeProvider>,
    );
    expect(seen.at(-1)?.hook).toBe(false);
    act(() => set?.("reduced"));
    expect(seen.at(-1)).toEqual({ hook: true, context: false, preference: "reduced" });
    expect(document.documentElement.getAttribute("data-motion-pref")).toBe("reduced");
    expect(window.localStorage.getItem(MOTION_KEY)).toBe("reduced");
  });

  it("hydrates a saved “full” without a mismatch, and settles on it", () => {
    window.localStorage.setItem(MOTION_KEY, "full");
    stubOsReducedMotion(true);
    const tree = (seen: Frame[]) => (
      <ThemeProvider>
        <Pair seen={seen} />
      </ThemeProvider>
    );
    const serverSeen: Frame[] = [];
    container.innerHTML = renderToString(tree(serverSeen));
    // The server knows neither the saved value nor the OS setting.
    expect(serverSeen).toEqual([{ hook: false, context: false, preference: "system" }]);

    const clientSeen: Frame[] = [];
    const recoverable = vi.fn();
    act(() => {
      root = hydrateRoot(container, tree(clientSeen), { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(clientSeen[0]).toEqual(serverSeen[0]);
    expect(clientSeen.at(-1)).toEqual({ hook: false, context: true, preference: "full" });
    // A saved "full" never reads as reduced, not even for one render.
    expect(clientSeen.map((frame) => frame.hook)).not.toContain(true);
  });
});
