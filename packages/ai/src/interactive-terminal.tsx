"use client";

/**
 * InteractiveTerminal — a token-themed wrapper around xterm.js (issue #285).
 *
 * `Terminal` (terminal.tsx) is a presentational, READ-ONLY ANSI log (no stdin,
 * no cursor, no resize protocol). This is a SEPARATE component for a real
 * interactive terminal surface: run a command, see live ANSI output, type into
 * the process. The PTY/process itself is consumer-owned (D5) — this component
 * only renders and emits input/resize events; it never spawns anything.
 *
 * Theming: xterm can't read CSS custom properties, so its `ITheme` (background/
 * foreground/cursor/selection + the 16 ANSI colors) is derived from semantic
 * tokens at runtime via `oklchToHex`/`resolveTokenColor` (`@elabs/components-tokens`, ADR
 * 0015) — the same "wrap an engine, theme it from tokens" pattern as
 * `@elabs/components-editor`'s Monaco bridge and `@elabs/components-maps`' `useTokenColor`. It
 * re-resolves whenever `data-theme` changes (a local MutationObserver, mirroring
 * `persona.tsx`'s theme watcher — `@elabs/components-ai` can't import `@elabs/components-editor`'s
 * shared `useDataTheme` hook per the one-way package graph).
 *
 * Bundling: xterm and its stylesheet are reached through a dynamic
 * `import("./_interactive-terminal-xterm")` inside the mount effect — the engine
 * is never touched during render — so it lands in its own chunk instead of every
 * consumer's entry chunk. The types below are `import type` and erase. See ADR
 * 0019 and `pnpm heavy-deps:check`.
 */

import { resolveTokenColor } from "@elabs/components-tokens";
import { cn } from "@elabs/components-ui/lib/cn";
import type { FitAddon } from "@xterm/addon-fit";
import type { ITheme, Terminal as XTerm } from "@xterm/xterm";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";

export interface InteractiveTerminalHandle {
  /** Process → screen. ANSI passthrough (colors, cursor movement, clears, …). */
  write(data: string): void;
  /** Clears the viewport + scrollback. */
  clear(): void;
  /** Re-fits cols/rows to the current container size. */
  fit(): void;
  /** Focuses the terminal's input surface. */
  focus(): void;
}

export interface InteractiveTerminalProps extends Omit<HTMLAttributes<HTMLDivElement>, "onResize"> {
  /** Keystrokes + paste → process. The PTY/process stays consumer-owned. */
  onData?: (data: string) => void;
  /** Fires whenever the container resizes and cols/rows are refit. */
  onResize?: (size: { cols: number; rows: number }) => void;
  /** Degrades to a read-only log: writes still render, stdin is disabled. */
  readOnly?: boolean;
  /** Terminal font size in px. Defaults to `13` (matches `CodeEditor`). */
  fontSize?: number;
  /** Accessible name for the terminal's real focusable surface. Required. */
  "aria-label": string;
}

// --- Runtime color helpers -------------------------------------------------
// `resolveTokenColor` (@elabs/components-tokens, ADR 0015) is the shared "read a semantic
// token off an element, oklch → hex" resolver — the same one `@elabs/components-maps`'
// `useTokenColor` wraps. `withAlpha`/`lighten` below are the same "math on the
// resolved hex" idiom as `monaco-theme-bridge.ts` (@elabs/components-editor) — never a
// hardcoded literal color.

/** Mix `alpha` (0..1) into a `#rrggbb` color, returning `#rrggbbaa`. */
function withAlpha(hex: string, alpha: number): string {
  const base = hex.slice(0, 7);
  const byte = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${base}${byte}`;
}

/** Mix a `#rrggbb` color toward `target` (`#rrggbb`) by `amount` (0..1). */
function mixToward(hex: string, target: string, amount: number): string {
  const base = hex.slice(0, 7);
  const channel = (source: string, i: number) =>
    parseInt(source.slice(1 + i * 2, 3 + i * 2), 16) || 0;
  const toHex = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  const mix = (i: number) => {
    const from = channel(base, i);
    return from + (channel(target, i) - from) * amount;
  };
  return `#${toHex(mix(0))}${toHex(mix(1))}${toHex(mix(2))}`;
}

/** WCAG 2.1 relative luminance of a `#rrggbb`. */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = (parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) || 0) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG contrast ratio between two `#rrggbb` colors. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The pole a color must move toward to gain contrast against `bg`. */
const awayPole = (bg: string) => (relativeLuminance(bg) > 0.5 ? "#000000" : "#ffffff");

/**
 * Push `hex` AWAY from `bg` by `amount` — darker on a light ground, lighter on
 * a dark one. This is how a "bright" ANSI sibling is derived for a hue with no
 * dedicated lighter/darker token: `lighten()` used to hardcode "toward white",
 * which on a light theme moved the swatch TOWARD the background and made the
 * bright variant the least legible colour on screen (#386 — in `light`
 * brightMagenta bottomed out at 2.91:1, and in the `:root` base at 2.39:1).
 */
function awayFromBackground(hex: string, bg: string, amount: number): string {
  return mixToward(hex, awayPole(bg), amount);
}

/**
 * The readable-ink floor (#386). xterm paints every ANSI colour code as real
 * TEXT on the terminal background, so each one owes WCAG AA (4.5:1) — but the
 * semantic tokens the mapping reaches for are not all text rungs: `--chart-2`/
 * `--chart-4`/`--border-strong` and the `--success`/`--info`/… FILL rungs are
 * MARK colours, guaranteed only ≥3:1 (.claude/rules/styling-and-tokens.md).
 * Rather than re-pick tokens per theme — which would silently rot the next time
 * a token is revalued — every ink is clamped here against the background it is
 * actually painted on: an already-AA colour passes through byte-identical, a
 * short one is mixed toward the far pole until it clears. Applies to every slot
 * EXCEPT `black`, which is the background RUNG by ANSI convention (see the
 * mapping notes below), not ink chosen for legibility.
 */
function readableInk(hex: string, bg: string, ratio = 4.5): string {
  const base = hex.slice(0, 7);
  if (contrastRatio(base, bg) >= ratio) return base;
  const pole = awayPole(bg);
  const STEPS = 40;
  for (let step = 1; step <= STEPS; step += 1) {
    const candidate = mixToward(base, pole, step / STEPS);
    if (contrastRatio(candidate, bg) >= ratio) return candidate;
  }
  return pole;
}

/**
 * Builds xterm's `ITheme` from the active theme's semantic tokens, resolved
 * off `rootEl` (defaults to `<html>`, where `data-theme` lives).
 *
 * ANSI mapping (documented so the intent is auditable, not guessed at):
 *  - background/foreground → `--card`/`--foreground` (the terminal reads as a
 *    raised panel, matching the existing `Terminal` log's bordered-box look).
 *  - cursor → `--primary`; cursorAccent → the background, so glyphs stay
 *    legible under a solid block cursor.
 *  - selectionBackground → a low-alpha `--primary` wash.
 *  - red/green/yellow/blue → the AA-tuned `-text` variants (`--destructive-text`,
 *    `--success-text`, `--warning-text`, `--info-text`) — these are the ones
 *    tuned to read as TEXT on a surface, which is exactly what ANSI color codes
 *    paint. `bright*` variants use the more saturated fill tokens
 *    (`--destructive`, `--success`, `--warning`, `--info`).
 *  - magenta/cyan → `--chart-4`/`--chart-2` (no dedicated fill/text pair, so the
 *    `bright*` siblings are the same hue pushed AWAY from the background).
 *  - black/white are `background`/`foreground` RUNGS, not the tokens
 *    themselves: `black` = the terminal's own background (the common "ANSI
 *    black" convention — invisible ink), `brightBlack` = `--border-strong`
 *    (a dim ink for comments/hashes), `white` = `--muted-foreground` (a dimmer
 *    ink), `brightWhite` = `--foreground` (full ink).
 *
 * EVERY slot above except `black` then passes through `readableInk()` — the AA
 * floor (#386). The mapping picks the token that carries the right MEANING; the
 * floor guarantees the resulting ink is legible on this terminal's actual
 * background. Several of these tokens are mark/fill rungs (≥3:1 only), so
 * without the floor EVERY palette this repo ships had sub-AA ANSI slots —
 * measured from `themes.css`: `:root` 7 (worst 2.39:1), `light` 4 (worst
 * 2.91:1), `dark` 1 (3.16:1), `blueprint` 1 (4.32:1). Re-derived on every
 * run by `interactive-terminal.test.tsx`, which parses those palettes out of
 * `themes.css` rather than hard-coding them. Keep new slots inside `ink(...)`;
 * a raw token assigned straight to an ANSI slot is the bug.
 */
export function buildInteractiveTerminalTheme(rootEl?: Element | null): ITheme {
  const el = rootEl ?? (typeof document !== "undefined" ? document.documentElement : null);
  const read = (name: string, fallback: string) => resolveTokenColor(name, { el, fallback });

  const background = read("--card", "#ffffff");
  const foreground = read("--foreground", "#111111");
  const primary = read("--primary", foreground);
  const mutedForeground = read("--muted-foreground", foreground);
  const borderStrong = read("--border-strong", mutedForeground);

  const destructiveText = read("--destructive-text", "#b91c1c");
  const destructive = read("--destructive", destructiveText);
  const successText = read("--success-text", "#15803d");
  const success = read("--success", successText);
  const warningText = read("--warning-text", "#a16207");
  const warning = read("--warning", warningText);
  const infoText = read("--info-text", primary);
  const info = read("--info", primary);
  const chart2 = read("--chart-2", infoText);
  const chart4 = read("--chart-4", destructiveText);

  // Every ANSI slot below is INK — clamp it to AA against this terminal's own
  // background (#386). `black` is the one exception: it is the background rung
  // by ANSI convention, not ink.
  const ink = (hex: string) => readableInk(hex, background);

  return {
    background,
    foreground,
    cursor: primary,
    cursorAccent: background,
    selectionBackground: withAlpha(primary, 0.28),

    black: background,
    red: ink(destructiveText),
    green: ink(successText),
    yellow: ink(warningText),
    blue: ink(infoText),
    magenta: ink(chart4),
    cyan: ink(chart2),
    white: ink(mutedForeground),

    brightBlack: ink(borderStrong),
    brightRed: ink(destructive),
    brightGreen: ink(success),
    brightYellow: ink(warning),
    brightBlue: ink(info),
    brightMagenta: ink(awayFromBackground(chart4, background, 0.3)),
    brightCyan: ink(awayFromBackground(chart2, background, 0.3)),
    brightWhite: ink(foreground),
  };
}

/** Reads the theme's mono font stack (the `--font-mono` seam — blueprint
 * overrides it to IBM Plex Mono) so the terminal's glyphs track it too. */
function readTerminalFontFamily(rootEl?: Element | null): string {
  const el = rootEl ?? (typeof document !== "undefined" ? document.documentElement : null);
  if (!el || typeof getComputedStyle === "undefined") return "monospace";
  const raw = getComputedStyle(el).getPropertyValue("--font-mono").trim();
  return raw || "monospace";
}

const DEFAULT_FONT_SIZE = 13;

/**
 * A token-themed, PTY-ready terminal emulator wrapped as a brand-ui component.
 * Wraps xterm.js + `FitAddon`; the process itself is consumer-owned — this
 * component only renders ANSI output and emits `onData`/`onResize`.
 *
 * Keyboard: the terminal's real focusable surface is xterm's own input
 * textarea (reachable by Tab like any control). Tab/Shift-Tab and Escape are
 * explicitly let through (`attachCustomKeyEventHandler`) so focus can always
 * leave the terminal — there is no keyboard trap.
 */
export const InteractiveTerminal = forwardRef<InteractiveTerminalHandle, InteractiveTerminalProps>(
  function InteractiveTerminal(
    {
      onData,
      onResize,
      readOnly = false,
      fontSize = DEFAULT_FONT_SIZE,
      className,
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const [term, setTerm] = useState<XTerm | null>(null);
    const [themeRevision, setThemeRevision] = useState(0);

    const onDataRef = useRef(onData);
    onDataRef.current = onData;
    const onResizeRef = useRef(onResize);
    onResizeRef.current = onResize;

    // Output written before the engine chunk resolves — a consumer's mount
    // effect is the common case (`useEffect(() => ref.current?.write(banner))`).
    // It is buffered here and replayed the moment the terminal opens, so the
    // lazy import stays invisible to the imperative handle's contract.
    const pendingWritesRef = useRef<string[]>([]);

    useImperativeHandle<InteractiveTerminalHandle, InteractiveTerminalHandle>(
      ref,
      () => ({
        write: (data: string) => {
          if (term) {
            term.write(data);
            return;
          }
          pendingWritesRef.current.push(data);
        },
        clear: () => {
          pendingWritesRef.current.length = 0;
          term?.clear();
        },
        fit: () => fitAddonRef.current?.fit(),
        focus: () => term?.focus(),
      }),
      [term],
    );

    // Mount once: fetch the engine chunk, create the xterm instance + FitAddon,
    // open into the container, wire the resize observer + no-keyboard-trap
    // handler. The engine arrives asynchronously (it is a lazy chunk), so the
    // cleanup below has to cope with unmounting mid-flight.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let disposed = false;
      let instance: XTerm | undefined;
      let fitAddon: FitAddon | undefined;
      let resizeObserver: ResizeObserver | undefined;

      void import("./_interactive-terminal-xterm").then((engine) => {
        if (disposed) return;

        instance = new engine.XTerm({
          fontSize,
          fontFamily: readTerminalFontFamily(),
          convertEol: true,
          cursorBlink: true,
          scrollback: 2000,
          disableStdin: readOnly,
          theme: buildInteractiveTerminalTheme(),
        });
        fitAddon = new engine.FitAddon();
        instance.loadAddon(fitAddon);
        instance.open(container);
        if (ariaLabel && instance.textarea) {
          instance.textarea.setAttribute("aria-label", ariaLabel);
        }

        // Replay anything the consumer wrote while the chunk was in flight.
        for (const chunk of pendingWritesRef.current) instance.write(chunk);
        pendingWritesRef.current = [];

        // No keyboard trap (#285 acceptance criterion): let Tab/Shift-Tab and
        // Escape bubble to the browser's normal focus handling instead of being
        // consumed as terminal input, so focus can always leave the terminal.
        instance.attachCustomKeyEventHandler((event) => {
          if (event.key === "Tab" || event.key === "Escape") return false;
          return true;
        });

        fitAddonRef.current = fitAddon;
        setTerm(instance);

        const observer = new ResizeObserver(() => {
          try {
            fitAddon?.fit();
          } catch {
            // Container not laid out yet (e.g. display:none) — ignore, the next
            // resize observation will retry.
          }
        });
        observer.observe(container);
        resizeObserver = observer;
      });

      return () => {
        disposed = true;
        resizeObserver?.disconnect();
        fitAddon?.dispose();
        instance?.dispose();
        fitAddonRef.current = null;
        setTerm(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keystrokes + paste → consumer, only while interactive.
    useEffect(() => {
      if (!term || readOnly) return;
      const sub = term.onData((data) => onDataRef.current?.(data));
      return () => sub.dispose();
    }, [term, readOnly]);

    // Container resize → refit → report the new cols/rows.
    useEffect(() => {
      if (!term) return;
      const sub = term.onResize((size) => onResizeRef.current?.(size));
      return () => sub.dispose();
    }, [term]);

    // `readOnly` toggles xterm's own stdin gate at runtime too (not just at
    // construction), so it can be flipped on a live instance.
    useEffect(() => {
      if (!term) return;
      term.options.disableStdin = readOnly;
    }, [term, readOnly]);

    useEffect(() => {
      if (!term || fontSize === term.options.fontSize) return;
      term.options.fontSize = fontSize;
      fitAddonRef.current?.fit();
    }, [term, fontSize]);

    useEffect(() => {
      if (!term || !term.textarea || !ariaLabel) return;
      term.textarea.setAttribute("aria-label", ariaLabel);
    }, [term, ariaLabel]);

    // Track `data-theme` (ThemeProvider or Storybook's theme decorator both
    // just set the attribute) and re-apply the derived xterm theme + font.
    useEffect(() => {
      if (typeof document === "undefined") return;
      const observer = new MutationObserver(() => setThemeRevision((r) => r + 1));
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!term) return;
      term.options.theme = buildInteractiveTerminalTheme();
      term.options.fontFamily = readTerminalFontFamily();
      fitAddonRef.current?.fit();
      // `themeRevision` is the trigger; the values themselves are re-read live.
    }, [term, themeRevision]);

    return (
      <div
        ref={containerRef}
        className={cn(
          "overflow-hidden rounded-lg border bg-card p-2 outline-none",
          "focus-within:ring-2 focus-within:ring-ring",
          className,
        )}
        {...props}
      />
    );
  },
);
