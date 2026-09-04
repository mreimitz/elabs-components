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
 * tokens at runtime via `oklchToHex`/`resolveTokenColor` (`@elabs-ai/components-tokens`, ADR
 * 0015) — the same "wrap an engine, theme it from tokens" pattern as
 * `@elabs-ai/components-editor`'s Monaco bridge and `@elabs-ai/components-maps`' `useTokenColor`. It
 * re-resolves whenever `data-theme` changes (a local MutationObserver, mirroring
 * `persona.tsx`'s theme watcher in `@elabs-ai/components-ai` — `@elabs-ai/components-terminal`
 * can't import `@elabs-ai/components-editor`'s shared `useDataTheme` hook per the
 * one-way package graph either).
 *
 * The tokens it reads are the dedicated `--terminal-*`/`--terminal-ansi-*` group
 * (issue #115, `packages/tokens/src/themes.css`), not ad-hoc `--card`/status/
 * chart tokens — that group exists precisely so every console surface in this
 * package (this one and the read-only `Terminal` log) renders the same console
 * palette instead of two independently-derived ones.
 *
 * Bundling: xterm and its stylesheet are reached through a dynamic
 * `import("./_interactive-terminal-xterm")` inside the mount effect — the engine
 * is never touched during render — so it lands in its own chunk instead of every
 * consumer's entry chunk. The types below are `import type` and erase. See ADR
 * 0019 and `pnpm heavy-deps:check`.
 *
 * Issue #101: `@xterm/xterm`/`@xterm/addon-fit` are OPTIONAL peers, so no
 * PUBLIC export's type may structurally reference them — doing so would name
 * the peer in this package's generated root `.d.ts` and hand a
 * `skipLibCheck: false` consumer who has not installed it a `TS2307` just for
 * importing the barrel. `FitAddon`/`Terminal as XTerm` below are used only for
 * PRIVATE, non-exported local state (refs/`useState`), which never reaches the
 * `.d.ts`; `buildInteractiveTerminalTheme`'s return type is the one exported
 * signature that used to leak `ITheme` directly, so it now returns the local,
 * structural `TerminalColorTheme` mirror declared below instead.
 */

import { resolveTokenColor } from "@elabs-ai/components-tokens";
import { Button, isOptionalPeerMissing, StatePanel, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal as XTerm } from "@xterm/xterm";
import { EyeOffIcon } from "lucide-react";
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
// `resolveTokenColor` (@elabs-ai/components-tokens, ADR 0015) is the shared "read a semantic
// token off an element, oklch → hex" resolver — the same one `@elabs-ai/components-maps`'
// `useTokenColor` wraps. `mixToward`/`readableInk` below are the same "math on the
// resolved hex" idiom as `monaco-theme-bridge.ts` (@elabs-ai/components-editor) — never a
// hardcoded literal color.

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
 * The colour slots this component derives — a local, structural mirror of
 * xterm's own `ITheme` (never import `ITheme`'s type straight out of the
 * xterm package — see the #101 note in the module doc comment above). Every property here is
 * a subset of `ITheme`'s (all-optional) string properties, declared as
 * required instead, so a value of this type is assignable wherever an
 * `ITheme` is expected — e.g. `new engine.XTerm({ theme: buildInteractiveTerminalTheme() })`.
 */
export interface TerminalColorTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/**
 * Builds xterm's colour theme from the active theme's semantic tokens,
 * resolved off `rootEl` (defaults to `<html>`, where `data-theme` lives).
 *
 * Returns the local `TerminalColorTheme` shape above rather than xterm's own
 * `ITheme` — see the #101 note in the module doc comment.
 *
 * ANSI mapping — every slot reads the DEDICATED `--terminal-*`/`--terminal-ansi-*`
 * group (#115, `packages/tokens/src/themes.css`) instead of ad-hoc `--card`/
 * status/chart tokens. This is what keeps this component and the read-only
 * `Terminal` log agreeing on one console palette instead of two independently
 * derived ones:
 *  - background/foreground → `--terminal-background`/`--terminal-foreground`.
 *  - cursor → `--terminal-cursor`; cursorAccent → `--terminal-accent-foreground`
 *    (ink under a solid block cursor — the console's own ground rung).
 *  - selectionBackground → `--terminal-selection` (already an opaque band —
 *    see the token's own comment for why it doesn't need an alpha mix here).
 *  - black → `--terminal-ansi-black` directly (the ANSI ground rung, exempt
 *    from the ink floor below — see the token group's doc comment in
 *    themes.css). Every other slot → its matching `--terminal-ansi-*` token.
 *
 * EVERY slot above except `black` then passes through `readableInk()` — the AA
 * floor (#386), preserved across this migration as defense-in-depth: the
 * `--terminal-ansi-*` group is already authored to clear ≥4.5:1 against
 * `--terminal-background` in every theme this repo ships (themes.css's own
 * measurement), but the floor still protects a consumer who retunes one ANSI
 * slot without re-checking contrast. Re-derived on every run by
 * `interactive-terminal.test.tsx`, which parses those palettes out of
 * `themes.css` rather than hard-coding them. Keep new slots inside `ink(...)`;
 * a raw token assigned straight to an ANSI slot is the bug.
 */
export function buildInteractiveTerminalTheme(rootEl?: Element | null): TerminalColorTheme {
  const el = rootEl ?? (typeof document !== "undefined" ? document.documentElement : null);
  const read = (name: string, fallback: string) => resolveTokenColor(name, { el, fallback });

  const background = read("--terminal-background", "#0b0e14");
  const foreground = read("--terminal-foreground", "#e5e7eb");
  const accent = read("--terminal-accent", foreground);
  const accentForeground = read("--terminal-accent-foreground", background);
  const cursor = read("--terminal-cursor", accent);
  const selection = read("--terminal-selection", background);

  // Every ANSI slot below is INK — clamp it to AA against this terminal's own
  // background (#386). `black` is the one exception: it is the background rung
  // by ANSI convention, not ink.
  const ink = (hex: string) => readableInk(hex, background);

  return {
    background,
    foreground,
    cursor,
    cursorAccent: accentForeground,
    selectionBackground: selection,

    black: read("--terminal-ansi-black", background),
    red: ink(read("--terminal-ansi-red", foreground)),
    green: ink(read("--terminal-ansi-green", foreground)),
    yellow: ink(read("--terminal-ansi-yellow", foreground)),
    blue: ink(read("--terminal-ansi-blue", foreground)),
    magenta: ink(read("--terminal-ansi-magenta", foreground)),
    cyan: ink(read("--terminal-ansi-cyan", foreground)),
    white: ink(read("--terminal-ansi-white", foreground)),

    brightBlack: ink(read("--terminal-ansi-bright-black", foreground)),
    brightRed: ink(read("--terminal-ansi-bright-red", foreground)),
    brightGreen: ink(read("--terminal-ansi-bright-green", foreground)),
    brightYellow: ink(read("--terminal-ansi-bright-yellow", foreground)),
    brightBlue: ink(read("--terminal-ansi-bright-blue", foreground)),
    brightMagenta: ink(read("--terminal-ansi-bright-magenta", foreground)),
    brightCyan: ink(read("--terminal-ansi-bright-cyan", foreground)),
    brightWhite: ink(read("--terminal-ansi-bright-white", foreground)),
  };
}

/** Reads the theme's mono font stack (the `--font-mono` seam — a theme
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
    // Set when the `@xterm/xterm` / `@xterm/addon-fit` optional peers
    // (issue #33) fail to load — an uninstalled peer, or any other engine
    // load failure. `null` = not (yet) failed.
    const [loadError, setLoadError] = useState<unknown>(null);
    // Bumped by `retryLoad` to re-run the mount effect below (the only way to
    // ask it to try the dynamic `import()` again — the effect's own deps stay
    // otherwise static, so this is a deliberate re-mount signal, not a value
    // the effect reads).
    const [reloadKey, setReloadKey] = useState(0);
    const { t } = useLocale();

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
          // The engine failed to load (issue #33 — a missing optional peer, or
          // any other load-time failure): nothing will ever drain this buffer,
          // so buffering here would grow it unboundedly for the lifetime of a
          // consumer that keeps calling `write()` against a terminal that can
          // never open. Drop instead of queueing once that's known.
          if (loadError) return;
          pendingWritesRef.current.push(data);
        },
        clear: () => {
          pendingWritesRef.current.length = 0;
          term?.clear();
        },
        fit: () => fitAddonRef.current?.fit(),
        focus: () => term?.focus(),
      }),
      [term, loadError],
    );

    // Mount once: fetch the engine chunk, create the xterm instance + FitAddon,
    // open into the container, wire the resize observer + no-keyboard-trap
    // handler. The engine arrives asynchronously (it is a lazy chunk), so the
    // cleanup below has to cope with unmounting mid-flight.
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      setLoadError(null);
      let disposed = false;
      let instance: XTerm | undefined;
      let fitAddon: FitAddon | undefined;
      let resizeObserver: ResizeObserver | undefined;

      void import("./_interactive-terminal-xterm")
        .then((module) => module.loadXTermEngine())
        .then((engine) => {
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
        })
        .catch((error: unknown) => {
          if (disposed) return;
          console.error("[InteractiveTerminal] the terminal engine failed to load:", error);
          setLoadError(error);
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
    }, [reloadKey]);

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

    if (loadError) {
      const feature = t("ai.terminal.feature");
      const isPeerMissing = isOptionalPeerMissing(loadError);
      return (
        <div
          className={cn(
            "rounded-lg border border-terminal-border bg-terminal-background p-2 shadow-sm",
            className,
          )}
          role={isPeerMissing ? "status" : undefined}
          aria-live={isPeerMissing ? "polite" : undefined}
          data-slot="interactive-terminal"
          {...props}
        >
          {isPeerMissing ? (
            <StatePanel
              kind="empty"
              // A dashed edge invites a drop; this panel accepts nothing.
              // Solid — mirrors `@elabs-ai/components-viewer`'s `FileViewerError`.
              className="border-solid"
              icon={<EyeOffIcon aria-hidden="true" />}
              title={t("ai.error.engineMissing", { feature })}
              description={t("ai.error.engineMissingBody", {
                feature,
                packages: "@xterm/xterm, @xterm/addon-fit",
              })}
            />
          ) : (
            <StatePanel
              kind="error"
              title={t("ai.terminal.renderError")}
              description={loadError instanceof Error ? loadError.message : String(loadError)}
              actions={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // This error branch renders instead of the terminal's
                    // `<div ref={containerRef}>` (see the final `return`
                    // below), so React has already detached `containerRef`
                    // (a ref goes `null` the moment its DOM node unmounts).
                    // Bumping `reloadKey` alone would re-run the mount
                    // effect with `containerRef.current` still `null` on
                    // THIS render — the tree still shows this error branch,
                    // since `loadError` hasn't cleared yet, and the effect's
                    // own `if (!container) return;` guard (issue #99) would
                    // silently no-op the retry before ever calling
                    // `loadXTermEngine()` again. Clearing `loadError` here,
                    // batched into the same handler as the `reloadKey`
                    // bump, makes React commit the terminal's container div
                    // in that same render pass, so the ref is re-attached
                    // before the effect's (deferred) body runs.
                    setLoadError(null);
                    setReloadKey((key) => key + 1);
                  }}
                >
                  {t("ai.error.retry")}
                </Button>
              }
            />
          )}
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          "overflow-hidden rounded-lg border border-terminal-border bg-terminal-background p-2 shadow-sm outline-none",
          "focus-ring-within",
          className,
        )}
        data-slot="interactive-terminal"
        {...props}
      />
    );
  },
);
