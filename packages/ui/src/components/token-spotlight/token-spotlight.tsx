"use client";

import * as React from "react";
import { cn } from "../../lib/cn";
import { formatColorAsOklch, formatLengthAsPx } from "./token-value-format";
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

/** Hard cap on elements a single scan pass examines (wave-4 ruling 26). */
export const TOKEN_SPOTLIGHT_SCAN_LIMIT = 2000;
/** Elements examined per idle slice before yielding back to the browser. */
const SCAN_CHUNK_SIZE = 150;
/** `data-token-consumer` marks written OR cleared per idle slice, so the restyle + outline paint
 * they cause is spread over several frames instead of landing in one long task (#583, #616). */
const MARK_CHUNK_SIZE = 40;

const BORDER_SIDES = ["Top", "Right", "Bottom", "Left"] as const;
/** SVG elements that paint their own `fill`/`stroke`; containers (`svg`, `g`) only pass it on. */
const SVG_PAINTING_ELEMENTS = new Set([
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "textPath",
  "tspan",
]);

/** True when `el` has a direct, non-whitespace text node — i.e. it paints glyphs in its own
 * `color`, rather than merely inheriting a `color` it never uses. */
function hasOwnText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && node.nodeValue?.trim()) return true;
  }
  return false;
}

/**
 * The element that visibly CONSUMES `matchValue`, or `null` (#583). Only real paint counts:
 * - `background-color` on the element itself;
 * - a border side's colour only where that side's width is > 0 (the base layer gives every element
 *   `border-color: var(--border)` at width 0 — that is not a consumer);
 * - `color` only on an element with its own non-empty text node (inherited `color` is not use);
 * - `fill`/`stroke` only on SVG shapes and text that paint (`stroke` needs a width > 0), reported
 *   as their owning `<svg>` so an icon or chart is one outline, not one per path.
 */
function consumerOf(el: Element, style: CSSStyleDeclaration, matchValue: string): Element | null {
  if (el instanceof SVGElement) {
    if (!SVG_PAINTING_ELEMENTS.has(el.localName)) return null;
    const paints =
      style.fill === matchValue ||
      (style.stroke === matchValue && parseFloat(style.strokeWidth) > 0);
    return paints ? (el.ownerSVGElement ?? el) : null;
  }
  if (style.backgroundColor === matchValue) return el;
  for (const side of BORDER_SIDES) {
    if (style[`border${side}Color`] === matchValue && parseFloat(style[`border${side}Width`]) > 0) {
      return el;
    }
  }
  if (style.color === matchValue && hasOwnText(el)) return el;
  return null;
}

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

const supportsCss = (property: string, value: string): boolean =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports(property, value);

/** `property: var(token)` on an off-screen probe inside `host`, read back as the browser's
 * computed value — so `calc()`, `rem`, named colours and `color-mix()` arrive resolved. Lengths go
 * through `letter-spacing`: an absolute computed length (negatives allowed) that, unlike `width`,
 * is never quantised to layout units (`1.6px`, not `1.59375px`). */
function probeComputed(host: Element, property: "color" | "letter-spacing", token: string): string {
  const doc = host.ownerDocument;
  const probe = doc.createElement("span");
  probe.style.cssText =
    "position:fixed;inset:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;" +
    `${property}:var(${token});`;
  host.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  host.removeChild(probe);
  return value;
}

/**
 * What a chip shows a person for `token` on `root` (#585): a colour as a rounded `oklch(L C H)`
 * — never the `lab()` a CSS build may have transpiled it to — and a length as resolved px, never
 * a raw `calc()`. Anything else (a font stack, a shadow) is shown as authored. `""` when there is
 * no `document` yet (SSR — the component fills it in after mount).
 */
export function resolveTokenDisplayValue(token: string, root?: HTMLElement): string {
  const target = root ?? (typeof document === "undefined" ? undefined : document.documentElement);
  if (!target) return "";
  const raw = getComputedStyle(target).getPropertyValue(token).trim();
  if (!raw) return "";
  const direct = formatColorAsOklch(raw);
  if (direct) return direct;
  // The probe must inherit `root`'s custom properties: `<html>` itself cannot host it visibly.
  const host = target === target.ownerDocument.documentElement ? target.ownerDocument.body : target;
  if (supportsCss("color", raw)) {
    return formatColorAsOklch(probeComputed(host, "color", token)) ?? raw;
  }
  if (supportsCss("width", raw)) {
    return formatLengthAsPx(probeComputed(host, "letter-spacing", token)) ?? raw;
  }
  return raw;
}

const isEmptyMatchValue = (value: string) =>
  value === "" || value === "rgba(0, 0, 0, 0)" || value === "transparent";

/**
 * Scans `root` in idle-time chunks for elements that visibly paint `matchValue` (from
 * {@link resolveTokenMatchValue}) — a background, a border side with width, their own text, or an
 * SVG shape's fill/stroke (reported as its `<svg>`) — capped at `limit` elements EXAMINED. Never a
 * long task, never inline styles (callers add/remove a `data-token-consumer` attribute instead).
 * `onDone`'s elements are typed `HTMLElement[]` for caller compatibility, but an SVG consumer is
 * reported as its `<svg>` root, so it arrives as an `SVGSVGElement` there, not an `HTMLElement` —
 * narrow with `instanceof SVGElement` before touching HTML-only members (#616).
 * Returns a canceller for effect cleanup.
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
  const found = new Set<Element>();
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
      const consumer = consumerOf(el, getComputedStyle(el), matchValue);
      if (consumer) found.add(consumer);
    }
    if (index < candidates.length) {
      cancelIdle = scheduleIdle(step);
    } else {
      // See the SVGSVGElement note in this function's JSDoc above.
      onDone(Array.from(found) as HTMLElement[]);
    }
  };
  cancelIdle = scheduleIdle(step);
  return () => {
    cancelled = true;
    cancelIdle();
  };
}

/**
 * Writes `data-token-consumer="<name>"` onto `elements` in idle slices of {@link MARK_CHUNK_SIZE},
 * pushing each marked element onto `written` as it goes so the caller can always clear exactly
 * what landed — even mid-way. Returns a canceller that stops further slices (#583).
 */
function writeMarksInSlices(elements: Element[], name: string, written: Element[]): () => void {
  let index = 0;
  let cancelled = false;
  let cancelIdle = () => {};
  const step = () => {
    if (cancelled) return;
    const end = Math.min(index + MARK_CHUNK_SIZE, elements.length);
    for (const el of elements.slice(index, end)) {
      el.setAttribute("data-token-consumer", name);
      written.push(el);
    }
    index = end;
    if (index < elements.length) cancelIdle = scheduleIdle(step);
  };
  if (elements.length > 0) cancelIdle = scheduleIdle(step);
  return () => {
    cancelled = true;
    cancelIdle();
  };
}

/**
 * Removes `data-token-consumer` from `elements` in idle slices of {@link MARK_CHUNK_SIZE} — the
 * same shape as {@link writeMarksInSlices}, so unmarking a large consumer set is never a long task
 * either (#616). Fire-and-forget: the elements are plain DOM nodes outside React, so there is
 * nothing to cancel — a page navigating away or unmounting mid-clear just stops needing it.
 */
function clearConsumersInSlices(elements: Element[]): void {
  let index = 0;
  const step = () => {
    const end = Math.min(index + MARK_CHUNK_SIZE, elements.length);
    for (const el of elements.slice(index, end)) {
      el.removeAttribute("data-token-consumer");
    }
    index = end;
    if (index < elements.length) scheduleIdle(step);
  };
  if (elements.length > 0) scheduleIdle(step);
}

/** Tracks one attribute of `document.documentElement`, so a change re-renders. */
function useRootAttribute(name: "data-theme" | "data-decoration"): string {
  const [value, setValue] = React.useState<string>(() =>
    typeof document === "undefined" ? "" : (document.documentElement.getAttribute(name) ?? ""),
  );
  React.useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setValue(root.getAttribute(name) ?? "");
    });
    observer.observe(root, { attributes: true, attributeFilter: [name] });
    return () => observer.disconnect();
  }, [name]);
  return value;
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
  /** Opt-in upper bound on elements MARKED as consumers, unlike {@link scanLimit} (which only
   * bounds elements EXAMINED). Unset by default — no cap. A token like `--foreground` or
   * `--border` can visibly mark hundreds of elements on a real page; set `maxMarks` when that
   * flood is a problem for your host page (#616). */
  maxMarks?: number;
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
      maxMarks,
      labels: labelsProp,
      className,
      ...props
    },
    ref,
  ) {
    const labels = { ...DEFAULT_TOKEN_SPOTLIGHT_LABELS, ...labelsProp };
    const theme = useRootAttribute("data-theme");
    const decoration = useRootAttribute("data-decoration");
    const [active, setActive] = React.useState<string | null>(null);
    const consumersRef = React.useRef<Element[]>([]);
    // Read once after mount and again on every theme or decoration switch (a decoration-scaled
    // token like `--radius` changes with `data-decoration`, #585) — never during SSR/hydration,
    // so the server and the first client render agree (both start from `{}`).
    const [displayValues, setDisplayValues] = React.useState<Record<string, string>>({});
    React.useEffect(() => {
      const next: Record<string, string> = {};
      for (const { token } of tokens) next[token] = resolveTokenDisplayValue(token);
      setDisplayValues(next);
    }, [theme, decoration, tokens]);

    const clearConsumers = React.useCallback(() => {
      const toClear = consumersRef.current;
      consumersRef.current = [];
      clearConsumersInSlices(toClear);
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
      let cancelMarks = () => {};
      const cancelScan = scanForConsumers(document.body, matchValue, scanLimit, (elements) => {
        clearConsumers();
        // `maxMarks` is opt-in (unset = no cap, #616): a token like `--foreground` can match
        // hundreds of elements, and marking stops at the cap rather than truncating what was found.
        const capped = maxMarks != null ? elements.slice(0, maxMarks) : elements;
        cancelMarks = writeMarksInSlices(capped, bareToken, consumersRef.current);
      });
      return () => {
        cancelScan();
        cancelMarks();
        clearConsumers();
        delete root.dataset.tokenSpotlight;
      };
      // `theme` re-runs the scan on a theme switch (Acceptance: "re-scans consumers"); `onSpotlight`
      // and `clearConsumers` are stable identities the caller/`useCallback` control.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
    }, [active, theme, scanLimit, maxMarks]);

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
