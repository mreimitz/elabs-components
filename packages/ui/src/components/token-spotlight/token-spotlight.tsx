"use client";

import * as React from "react";
import { cn } from "../../lib/cn";
import "./token-spotlight.css";

/** One chip: a semantic token plus its display label. */
export interface TokenSpotlightToken {
  /** The CSS custom property name, including its leading `--` (e.g. `--primary`). */
  token: string;
  /** Display label for the chip — supply your own to localize. */
  label: string;
}

export interface TokenSpotlightLabels {
  /** Accessible name of the chip row (`role="group"`). */
  row: string;
  /** sr-only text appended to each chip's accessible name, describing what hovering does. */
  hint: string;
}

export const DEFAULT_TOKEN_SPOTLIGHT_LABELS: TokenSpotlightLabels = {
  row: "Design tokens",
  hint: "Highlights every element on this page that uses this token.",
};

/** Elements are scanned for these computed-style properties (RM-103 wave-4 ruling 20/26). */
const CONSUMER_PROPERTIES = ["backgroundColor", "color", "borderColor", "fill", "stroke"] as const;

/** Hard cap on elements a single scan pass examines (wave-4 ruling 26). */
export const TOKEN_SPOTLIGHT_SCAN_LIMIT = 2000;
/** Elements examined per idle slice before yielding back to the browser. */
const SCAN_CHUNK_SIZE = 150;

type IdleDeadline = { timeRemaining: () => number; didTimeout: boolean };

/** `requestIdleCallback` where it exists; a same-shaped `setTimeout` fallback otherwise (Safari). */
function scheduleIdle(callback: (deadline: IdleDeadline) => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: (d: IdleDeadline) => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const handle = w.requestIdleCallback(callback, { timeout: 100 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const handle = window.setTimeout(
    () => callback({ timeRemaining: () => 50, didTimeout: true }),
    0,
  );
  return () => window.clearTimeout(handle);
}

/**
 * Resolves `token`'s CURRENT value the same way the browser will compare it: an off-screen probe
 * element takes `background-color: var(token)`, so whatever colour-space normalisation the
 * browser applies happens identically for the probe and for every candidate element below —
 * string equality holds regardless of how a theme authored the value (oklch, rgb, …).
 */
export function resolveTokenMatchValue(token: string, doc: Document = document): string {
  const probe = doc.createElement("span");
  probe.style.cssText =
    "position:fixed;inset:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;" +
    `background-color:var(${token});`;
  doc.body.appendChild(probe);
  const value = getComputedStyle(probe).backgroundColor;
  doc.body.removeChild(probe);
  return value;
}

/** The literal, authored value of `token` on `root` — what a chip shows to a person. `""` when
 * there is no `document` yet (SSR — the effect below fills it in after mount). */
export function resolveTokenDisplayValue(token: string, root?: HTMLElement): string {
  const target = root ?? (typeof document === "undefined" ? undefined : document.documentElement);
  if (!target) return "";
  return getComputedStyle(target).getPropertyValue(token).trim();
}

const isEmptyMatchValue = (value: string) =>
  value === "" || value === "rgba(0, 0, 0, 0)" || value === "transparent";

/**
 * Scans `root` in idle-time chunks for elements whose computed `backgroundColor`/`color`/
 * `borderColor`/`fill`/`stroke` equals `matchValue` (from {@link resolveTokenMatchValue}), capped
 * at `limit` elements EXAMINED — never a long task, never inline styles (callers add/remove a
 * `data-token-consumer` attribute instead). Returns a canceller for effect cleanup.
 */
export function scanForConsumers(
  root: ParentNode,
  matchValue: string,
  limit: number,
  onDone: (elements: HTMLElement[]) => void,
): () => void {
  if (isEmptyMatchValue(matchValue)) {
    onDone([]);
    return () => {};
  }
  const candidates = Array.from(root.querySelectorAll("*")).slice(0, limit);
  const found: HTMLElement[] = [];
  let index = 0;
  let cancelled = false;
  let cancelIdle = () => {};

  const step = (deadline: IdleDeadline) => {
    if (cancelled) return;
    let examinedInSlice = 0;
    while (
      index < candidates.length &&
      examinedInSlice < SCAN_CHUNK_SIZE &&
      (deadline.timeRemaining() > 0 || deadline.didTimeout)
    ) {
      const el = candidates[index++];
      examinedInSlice++;
      if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) continue;
      const style = getComputedStyle(el);
      const matches = CONSUMER_PROPERTIES.some(
        (prop) => (style as unknown as Record<string, string>)[prop] === matchValue,
      );
      if (matches) found.push(el as HTMLElement);
    }
    if (index < candidates.length) {
      cancelIdle = scheduleIdle(step);
    } else {
      onDone(found);
    }
  };
  cancelIdle = scheduleIdle(step);
  return () => {
    cancelled = true;
    cancelIdle();
  };
}

/** Tracks `document.documentElement`'s `data-theme` attribute, so a theme switch re-renders. */
function useDataTheme(): string {
  const [theme, setTheme] = React.useState<string>(() =>
    typeof document === "undefined"
      ? ""
      : (document.documentElement.getAttribute("data-theme") ?? ""),
  );
  React.useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(root.getAttribute("data-theme") ?? "");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export interface TokenSpotlightProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onSelect"
> {
  /** Chips to render, in order. */
  tokens: readonly TokenSpotlightToken[];
  /** Fires with the token on hover/focus, and `null` when the spotlight clears. */
  onSpotlight?: (token: string | null) => void;
  /** Upper bound on elements a scan pass examines. Default {@link TOKEN_SPOTLIGHT_SCAN_LIMIT}. */
  scanLimit?: number;
  labels?: Partial<TokenSpotlightLabels>;
}

/**
 * A row of token chips (concept §4.5, §5a "Scroll choreography 5"): hovering or focusing one sets
 * `data-token-spotlight` on `<html>` and marks every element on the page that resolves to the
 * same colour with `data-token-consumer` (never an inline style), so a stylesheet can draw the
 * highlight. `onSpotlight` lets the host tint an `AmbientField` to match. Each chip shows the
 * token's own resolved value, re-read on every theme change.
 */
export const TokenSpotlight = React.forwardRef<HTMLDivElement, TokenSpotlightProps>(
  function TokenSpotlight(
    {
      tokens,
      onSpotlight,
      scanLimit = TOKEN_SPOTLIGHT_SCAN_LIMIT,
      labels: labelsProp,
      className,
      ...props
    },
    ref,
  ) {
    const labels = { ...DEFAULT_TOKEN_SPOTLIGHT_LABELS, ...labelsProp };
    const theme = useDataTheme();
    const [active, setActive] = React.useState<string | null>(null);
    const consumersRef = React.useRef<HTMLElement[]>([]);
    // Read once after mount and again on every theme switch (Acceptance: "Switching the theme
    // updates every chip's resolved value") — never during SSR/hydration, so the server and the
    // first client render agree (both start from `{}`).
    const [displayValues, setDisplayValues] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
      const next: Record<string, string> = {};
      for (const { token } of tokens) next[token] = resolveTokenDisplayValue(token);
      setDisplayValues(next);
    }, [theme, tokens]);

    const clearConsumers = React.useCallback(() => {
      for (const el of consumersRef.current) el.removeAttribute("data-token-consumer");
      consumersRef.current = [];
    }, []);

    React.useEffect(() => {
      const root = document.documentElement;
      if (!active) {
        delete root.dataset.tokenSpotlight;
        clearConsumers();
        onSpotlight?.(null);
        return;
      }
      const bareToken = active.replace(/^--/, "");
      root.dataset.tokenSpotlight = bareToken;
      onSpotlight?.(active);
      const matchValue = resolveTokenMatchValue(active);
      const cancelScan = scanForConsumers(document.body, matchValue, scanLimit, (elements) => {
        clearConsumers();
        for (const el of elements) el.setAttribute("data-token-consumer", bareToken);
        consumersRef.current = elements;
      });
      return () => {
        cancelScan();
        clearConsumers();
        delete root.dataset.tokenSpotlight;
      };
      // `theme` re-runs the scan on a theme switch (Acceptance: "re-scans consumers"); `onSpotlight`
      // and `clearConsumers` are stable identities the caller/`useCallback` control.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
    }, [active, theme, scanLimit]);

    return (
      <div
        ref={ref}
        role="group"
        aria-label={labels.row}
        data-slot="token-spotlight"
        className={cn("flex flex-wrap items-center gap-2", className)}
        {...props}
      >
        {tokens.map(({ token, label }) => (
          <button
            key={token}
            type="button"
            data-slot="token-spotlight-chip"
            data-active={active === token ? "" : undefined}
            className={cn(
              "focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-meta font-medium",
              "bg-card text-foreground transition-colors",
              active === token ? "border-ring" : "border-border-strong",
            )}
            onMouseEnter={() => setActive(token)}
            onMouseLeave={() => setActive((current) => (current === token ? null : current))}
            onFocus={() => setActive(token)}
            onBlur={() => setActive((current) => (current === token ? null : current))}
          >
            <span aria-hidden="true" className="font-mono text-code">
              {token}
            </span>
            <span className="text-muted-foreground">{displayValues[token] || "—"}</span>
            <span className="sr-only">{` — ${label}. ${labels.hint}`}</span>
          </button>
        ))}
      </div>
    );
  },
);
TokenSpotlight.displayName = "TokenSpotlight";
