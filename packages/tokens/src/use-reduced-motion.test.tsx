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
 */
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useReducedMotion } from "./theme-provider";
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
