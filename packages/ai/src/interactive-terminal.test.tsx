import { createRef, type ReactElement } from "react";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { oklchToHex } from "@elabs/components-tokens";

// xterm.js needs a real canvas + layout to render, so it cannot mount in
// jsdom — mock the engine and assert the wrapper's lifecycle + theming
// contract. Real rendering + a11y come from the Storybook interaction tests.
// Mirrors the Monaco mocking pattern in @elabs/components-editor's code-editor.test.tsx.
const h = vi.hoisted(() => {
  const state = {
    dataHandler: undefined as undefined | ((data: string) => void),
    resizeHandler: undefined as undefined | ((size: { cols: number; rows: number }) => void),
  };
  const textarea = { setAttribute: vi.fn(), getAttribute: vi.fn() };

  function makeInstance() {
    return {
      options: { fontSize: 13, disableStdin: false } as Record<string, unknown>,
      textarea,
      loadAddon: vi.fn(),
      open: vi.fn(),
      write: vi.fn(),
      clear: vi.fn(),
      focus: vi.fn(),
      dispose: vi.fn(),
      attachCustomKeyEventHandler: vi.fn(),
      onData: vi.fn((cb: (data: string) => void) => {
        state.dataHandler = cb;
        return { dispose: vi.fn() };
      }),
      onResize: vi.fn((cb: (size: { cols: number; rows: number }) => void) => {
        state.resizeHandler = cb;
        return { dispose: vi.fn() };
      }),
    };
  }

  const instances: Array<ReturnType<typeof makeInstance>> = [];
  const Terminal = vi.fn(() => {
    const instance = makeInstance();
    instances.push(instance);
    return instance;
  });
  const FitAddon = vi.fn(() => ({ fit: vi.fn(), dispose: vi.fn() }));

  return { state, textarea, instances, Terminal, FitAddon };
});

vi.mock("@xterm/xterm", () => ({
  Terminal: h.Terminal,
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: h.FitAddon,
}));
// The real stylesheet import is a side-effect-only CSS import (already a
// no-op under this package's `css: false` vitest config); mock it explicitly
// so the module graph doesn't need to touch the filesystem in this test.
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

import {
  buildInteractiveTerminalTheme,
  InteractiveTerminal,
  type InteractiveTerminalHandle,
} from "./interactive-terminal";

beforeEach(() => {
  h.state.dataHandler = undefined;
  h.state.resizeHandler = undefined;
  h.instances.length = 0;
  vi.clearAllMocks();
});
afterEach(cleanup);

/** Lets the pending dynamic `import()` + its `.then` settle inside `act`. */
const flush = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 0))));

/**
 * xterm is reached through a dynamic `import()` inside the mount effect (ADR
 * 0019 — the engine must not sit in every consumer's entry chunk), so nothing
 * is constructed synchronously with `render()`. Every lifecycle assertion waits
 * for the engine chunk to resolve first.
 */
async function renderTerminal(ui: ReactElement) {
  const result = render(ui);
  await waitFor(() => expect(h.instances.length).toBeGreaterThan(0));
  return result;
}

describe("InteractiveTerminal", () => {
  it("creates an xterm instance and opens it into the container on mount", async () => {
    await renderTerminal(<InteractiveTerminal aria-label="Agent shell" />);
    expect(h.Terminal).toHaveBeenCalledTimes(1);
    expect(h.instances[0]?.open).toHaveBeenCalledTimes(1);
  });

  it("does not touch the engine during render — it is a lazy chunk (#313)", async () => {
    render(<InteractiveTerminal aria-label="Agent shell" />);
    expect(h.Terminal).not.toHaveBeenCalled();
    await waitFor(() => expect(h.Terminal).toHaveBeenCalledTimes(1));
  });

  it("forwards the aria-label onto xterm's real (focusable) textarea", async () => {
    await renderTerminal(<InteractiveTerminal aria-label="Agent shell" />);
    expect(h.textarea.setAttribute).toHaveBeenCalledWith("aria-label", "Agent shell");
  });

  it("handle.write() delegates to the xterm instance", async () => {
    const ref = createRef<InteractiveTerminalHandle>();
    await renderTerminal(<InteractiveTerminal ref={ref} aria-label="Agent shell" />);
    act(() => ref.current?.write("hello\r\n"));
    expect(h.instances[0]?.write).toHaveBeenCalledWith("hello\r\n");
  });

  it("handle.clear() / handle.focus() delegate to the xterm instance", async () => {
    const ref = createRef<InteractiveTerminalHandle>();
    await renderTerminal(<InteractiveTerminal ref={ref} aria-label="Agent shell" />);
    act(() => ref.current?.clear());
    act(() => ref.current?.focus());
    expect(h.instances[0]?.clear).toHaveBeenCalledTimes(1);
    expect(h.instances[0]?.focus).toHaveBeenCalledTimes(1);
  });

  it("handle.fit() delegates to the FitAddon instance", async () => {
    const ref = createRef<InteractiveTerminalHandle>();
    await renderTerminal(<InteractiveTerminal ref={ref} aria-label="Agent shell" />);
    const fitAddon = h.FitAddon.mock.results[0]?.value as { fit: ReturnType<typeof vi.fn> };
    act(() => ref.current?.fit());
    expect(fitAddon.fit).toHaveBeenCalled();
  });

  it("wires onData to the onData prop (keystrokes + paste)", async () => {
    const onData = vi.fn();
    await renderTerminal(<InteractiveTerminal aria-label="Agent shell" onData={onData} />);
    await waitFor(() => expect(h.instances[0]?.onData).toHaveBeenCalledTimes(1));
    act(() => h.state.dataHandler?.("ls\n"));
    expect(onData).toHaveBeenCalledWith("ls\n");
  });

  it("reports container resize as cols/rows via onResize", async () => {
    const onResize = vi.fn();
    await renderTerminal(<InteractiveTerminal aria-label="Agent shell" onResize={onResize} />);
    await waitFor(() => expect(h.instances[0]?.onResize).toHaveBeenCalledTimes(1));
    act(() => h.state.resizeHandler?.({ cols: 80, rows: 24 }));
    expect(onResize).toHaveBeenCalledWith({ cols: 80, rows: 24 });
  });

  describe("readOnly", () => {
    it("constructs xterm with disableStdin: true", async () => {
      await renderTerminal(<InteractiveTerminal aria-label="Agent log" readOnly />);
      expect(h.instances[0]?.options.disableStdin).toBe(true);
    });

    it("does not wire onData", async () => {
      const onData = vi.fn();
      await renderTerminal(<InteractiveTerminal aria-label="Agent log" onData={onData} readOnly />);
      await flush();
      expect(h.instances[0]?.onData).not.toHaveBeenCalled();
    });

    it("still exposes write() so consumers can render output", async () => {
      const ref = createRef<InteractiveTerminalHandle>();
      await renderTerminal(<InteractiveTerminal ref={ref} aria-label="Agent log" readOnly />);
      act(() => ref.current?.write("log line\r\n"));
      expect(h.instances[0]?.write).toHaveBeenCalledWith("log line\r\n");
    });
  });

  it("disposes the xterm instance on unmount", async () => {
    const { unmount } = await renderTerminal(<InteractiveTerminal aria-label="Agent shell" />);
    unmount();
    expect(h.instances[0]?.dispose).toHaveBeenCalledTimes(1);
  });

  it("replays writes issued before the engine chunk resolved (#313)", async () => {
    const ref = createRef<InteractiveTerminalHandle>();
    render(<InteractiveTerminal ref={ref} aria-label="Agent shell" />);

    // A consumer's own mount effect runs before the lazy chunk lands — the
    // banner it writes must not be silently dropped.
    act(() => ref.current?.write("banner\r\n"));
    expect(h.instances).toHaveLength(0);

    await waitFor(() => expect(h.instances[0]?.write).toHaveBeenCalledWith("banner\r\n"));
  });

  it("unmounting before the engine chunk resolves never opens a terminal (#313)", async () => {
    // Warm the module cache first, so the second render's dynamic import really
    // does resolve on this tick — otherwise the assertion would pass vacuously.
    const warm = await renderTerminal(<InteractiveTerminal aria-label="Agent shell" />);
    warm.unmount();
    h.instances.length = 0;

    const { unmount } = render(<InteractiveTerminal aria-label="Agent shell" />);
    unmount();
    await flush();
    expect(h.instances).toHaveLength(0);
  });
});

describe("buildInteractiveTerminalTheme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
  });

  it("maps ANSI red to the resolved --destructive-text token", () => {
    document.documentElement.style.setProperty("--destructive-text", "#dc2626");
    expect(buildInteractiveTerminalTheme().red).toBe("#dc2626");
  });

  // Fixture values are real AA-clearing `-text` rungs (≥4.5:1 on the default
  // `#ffffff` background this test leaves in place). A `-text` token that does
  // NOT clear AA is not a valid fixture for this mapping — the readable-ink
  // floor below would (correctly) darken it and the identity assertion would
  // stop describing the mapping.
  it("maps ANSI green/yellow/blue to their -text tokens", () => {
    document.documentElement.style.setProperty("--success-text", "#15803d");
    document.documentElement.style.setProperty("--warning-text", "#854d0e");
    document.documentElement.style.setProperty("--info-text", "#1d4ed8");
    const theme = buildInteractiveTerminalTheme();
    expect(theme.green).toBe("#15803d");
    expect(theme.yellow).toBe("#854d0e");
    expect(theme.blue).toBe("#1d4ed8");
  });

  it("resolves an oklch() token value to hex, not passed through raw", () => {
    document.documentElement.style.setProperty("--destructive-text", "oklch(0.5 0.2 27)");
    expect(buildInteractiveTerminalTheme().red).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("derives background/foreground/cursor from --card/--foreground/--primary", () => {
    document.documentElement.style.setProperty("--card", "#111827");
    document.documentElement.style.setProperty("--foreground", "#f9fafb");
    document.documentElement.style.setProperty("--primary", "#6366f1");
    const theme = buildInteractiveTerminalTheme();
    expect(theme.background).toBe("#111827");
    expect(theme.foreground).toBe("#f9fafb");
    expect(theme.cursor).toBe("#6366f1");
    // cursorAccent tracks the background so glyphs stay legible under a block cursor.
    expect(theme.cursorAccent).toBe("#111827");
  });

  it("keeps black/white as background/foreground rungs, not the same value", () => {
    document.documentElement.style.setProperty("--card", "#0b1220");
    document.documentElement.style.setProperty("--foreground", "#e5e7eb");
    const theme = buildInteractiveTerminalTheme();
    expect(theme.black).toBe("#0b1220");
    expect(theme.brightWhite).toBe("#e5e7eb");
    expect(theme.black).not.toBe(theme.brightWhite);
  });
});

// --- #386: every ANSI slot is TEXT, so every one of them must clear AA ------
// xterm paints ANSI colour codes as real text on the terminal background. The
// original mapping reached for MARK-rung tokens (`--chart-2`/`--chart-4`,
// `--border-strong`) and FILL-rung tokens (`--success`/`--info`/… for the
// `bright*` siblings), which are only guaranteed ≥3:1 (see
// .claude/rules/styling-and-tokens.md, "which status rung a graphical MARK
// reaches for"), so slots came out below 4.5:1 in EVERY palette this repo ships.
//
// The fixtures below are PARSED FROM `packages/tokens/src/themes.css` at test
// time and resolved with the same `oklchToHex` the component itself uses —
// deliberately not hand-copied hexes. An earlier revision of this file DID
// hand-copy them and got them wrong while claiming they were measured; a parsed
// fixture cannot drift from the shipped themes and cannot be fabricated.
// `resolveBlock` THROWS on a token it cannot resolve, so a broken parse fails
// loudly instead of silently substituting a fallback that happens to pass.

/** WCAG 2.1 relative luminance of a `#rrggbb` — the reference implementation
 *  this test checks the component's own clamp against. */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = (parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ADR 0029 split the reference themes out of `themes.css` into their own opt-in
// files, so a reader that opens ONLY `themes.css` sees `:root` and the paused
// blueprint block and nothing else — it keeps parsing, just less. Read the SET,
// and throw rather than return an incomplete one.
const TOKENS_SRC = join(dirname(fileURLToPath(import.meta.url)), "../../tokens/src");

function readThemeCssSet(): string {
  const engine = join(TOKENS_SRC, "themes.css");
  const themesDir = join(TOKENS_SRC, "themes");
  const files = readdirSync(themesDir).filter((f) => f.endsWith(".css"));
  if (files.length === 0) {
    throw new Error(`no theme stylesheets found in ${themesDir} — the fixture would be vacuous`);
  }
  return [engine, ...files.map((f) => join(themesDir, f))]
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
}

/** Every custom property declared per `:root` / `[data-theme="…"]` block.
 *  Comments are stripped FIRST — themes.css documents its tokens heavily, and a
 *  `--foo: bar;` written inside a `/* … *\/` prose block otherwise parses as a
 *  declaration and poisons the fixture. */
function parseThemeBlocks(source: string): Record<string, Record<string, string>> {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Record<string, Record<string, string>> = {};
  const opener = /(^|\n)(:root|\[data-theme="([a-z0-9-]+)"\])\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(css))) {
    const name = match[3] ?? ":root";
    let depth = 1;
    let i = opener.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    const decls = out[name] ?? {};
    for (const d of css
      .slice(opener.lastIndex, i - 1)
      .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
      decls[d[1]!] = d[2]!.trim();
    }
    out[name] = decls;
  }
  return out;
}

/** The tokens `buildInteractiveTerminalTheme` reads. Every one must resolve. */
const READ_TOKENS = [
  "--card",
  "--foreground",
  "--primary",
  "--muted-foreground",
  "--border-strong",
  "--destructive-text",
  "--destructive",
  "--success-text",
  "--success",
  "--warning-text",
  "--warning",
  "--info-text",
  "--info",
  "--chart-2",
  "--chart-4",
] as const;

/** Resolve a block's declarations (following one `var()` hop) to concrete hex.
 *  Throws rather than falling back — a silent fallback of `#000000` on a light
 *  card reads as 21:1 and would hide exactly the failure this test locks. */
function resolveBlock(decls: Record<string, string>, blockName: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const token of READ_TOKENS) {
    let raw = decls[token];
    for (let hop = 0; raw?.startsWith("var(") && hop < 4; hop += 1) {
      raw = decls[raw.slice(4, raw.indexOf(")")).trim()];
    }
    if (!raw) throw new Error(`themes.css block "${blockName}" does not declare ${token}`);
    const hex = raw.startsWith("oklch") ? oklchToHex(raw) : raw;
    if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) {
      throw new Error(
        `themes.css block "${blockName}": ${token} = "${raw}" did not resolve to hex`,
      );
    }
    out[token] = hex;
  }
  return out;
}

/** Every slot xterm paints as INK. `black` is deliberately excluded: it is the
 *  background RUNG by ANSI convention (documented in interactive-terminal.tsx),
 *  not ink chosen for legibility. */
const ANSI_INK_SLOTS = [
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
] as const;

const THEME_BLOCKS = parseThemeBlocks(readThemeCssSet());

describe("buildInteractiveTerminalTheme readable-ink floor (#386)", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
  });

  // Guards the parse itself: if the regex ever stops matching, the per-block
  // loop below would silently run zero assertions and still go green.
  it("parses every palette the repo ships out of the theme stylesheet SET", () => {
    expect(Object.keys(THEME_BLOCKS).sort()).toEqual(
      expect.arrayContaining([":root", "light", "dark"]),
    );
  });

  for (const blockName of [":root", "light", "dark"]) {
    const apply = () => {
      const palette = resolveBlock(THEME_BLOCKS[blockName] ?? {}, blockName);
      for (const [name, value] of Object.entries(palette)) {
        document.documentElement.style.setProperty(name, value);
      }
    };

    it(`clears WCAG AA (4.5:1) on every ANSI ink slot in ${blockName}`, () => {
      apply();
      const theme = buildInteractiveTerminalTheme();
      const background = theme.background as string;
      const failures = ANSI_INK_SLOTS.filter(
        (slot) => contrastRatio(theme[slot] as string, background) < 4.5,
      ).map(
        (slot) =>
          `${slot}=${theme[slot]} (${contrastRatio(theme[slot] as string, background).toFixed(2)}:1)`,
      );
      expect(failures).toEqual([]);
    });

    it(`keeps each bright ANSI sibling distinguishable from its base in ${blockName}`, () => {
      apply();
      const theme = buildInteractiveTerminalTheme();
      // A bright/base pair that collapses to one hex makes `\x1b[1;3Xm` output
      // indistinguishable from `\x1b[3Xm` — the clamp must not flatten the palette.
      expect(theme.brightMagenta).not.toBe(theme.magenta);
      expect(theme.brightCyan).not.toBe(theme.cyan);
    });
  }

  it("leaves an already-AA ink untouched (the clamp is a floor, not a filter)", () => {
    document.documentElement.style.setProperty("--card", "#ffffff");
    document.documentElement.style.setProperty("--destructive-text", "#b3261e");
    expect(buildInteractiveTerminalTheme().red).toBe("#b3261e");
  });
});
