"use client";

import { resolveTokenColor, type ResolveTokenColorOptions } from "@elabs-ai/components-tokens";
import { useLayoutEffect, useState } from "react";

import { useMap } from "../map-canvas/map-context";

/**
 * Resolve a semantic token (e.g. `"--primary"`) to a concrete color MapLibre's
 * WebGL paint can consume, re-resolving whenever the brand theme changes.
 * This is how default layer paints stay token-driven: WebGL can't read CSS
 * custom properties, so we read them at runtime off the map container.
 */
export function useTokenColor(name: string, fallback = "#000000"): string {
  const { map, themeKey } = useMap();
  const [color, setColor] = useState(fallback);

  useLayoutEffect(() => {
    setColor(resolveTokenColor(name, { el: map?.getContainer(), fallback }));
  }, [name, fallback, map, themeKey]);

  return color;
}

/** A bare token name, e.g. `--chart-1` — the form {@link resolveTokenColor} itself takes. */
const BARE_TOKEN_RE = /^(--[\w-]+)$/;
/** `var(--chart-1)` or `var(--chart-1, <fallback>)` — the CSS form a consumer reaches for first. */
const VAR_REF_RE = /^var\(\s*(--[\w-]+)\s*(?:,[\s\S]*)?\)$/;

/**
 * A single MapLibre paint value, resolved if it names a semantic token — either
 * form (`"var(--chart-1)"` or the bare `"--chart-1"`). WebGL can't read CSS
 * custom properties, so a raw token reference handed straight to MapLibre's
 * paint validator is silently rejected — this is the one place a consumer's
 * own `fillPaint`/`linePaint` token reference gets turned into a concrete
 * color before that happens. A MapLibre
 * expression is an array — walked recursively so a token reference nested
 * inside `["case", …]` or `["get", …]` still resolves. Anything else (plain
 * colors, numbers, expression operators) passes through untouched.
 */
export function resolveTokenPaintValue(
  value: unknown,
  options: ResolveTokenColorOptions = {},
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => resolveTokenPaintValue(entry, options));
  }
  if (typeof value === "string") {
    const tokenName = VAR_REF_RE.exec(value)?.[1] ?? (BARE_TOKEN_RE.test(value) ? value : null);
    if (tokenName) return resolveTokenColor(tokenName, options);
  }
  return value;
}

/**
 * {@link resolveTokenPaintValue} applied to every value of a MapLibre paint
 * object (`fill-color`, `line-color`, …). Returns the same object reference
 * when nothing needed resolving, so callers can keep memoizing on it.
 */
export function resolveTokenPaint<T extends Record<string, unknown>>(
  paint: T,
  options: ResolveTokenColorOptions = {},
): T {
  let changed = false;
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(paint)) {
    const next = resolveTokenPaintValue(value, options);
    resolved[key] = next;
    if (next !== value) changed = true;
  }
  return (changed ? resolved : paint) as T;
}

/**
 * {@link resolveTokenPaint}, kept in sync with the active theme — the paint-object
 * counterpart of {@link useTokenColor}, for a component that accepts a raw
 * `fillPaint`/`linePaint` object from the consumer instead of a single color
 * prop. `paint` may be `false` (the layer is omitted) or `undefined`; both
 * pass through unchanged.
 */
export function useTokenPaint<P extends Record<string, unknown> | false | undefined>(paint: P): P {
  const { map, themeKey } = useMap();
  const [resolved, setResolved] = useState(paint);

  useLayoutEffect(() => {
    setResolved(
      paint
        ? (resolveTokenPaint(paint as Record<string, unknown>, { el: map?.getContainer() }) as P)
        : paint,
    );
  }, [paint, map, themeKey]);

  return resolved;
}
