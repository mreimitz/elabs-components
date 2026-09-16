"use client";

/**
 * `useBreakpoint` (RM-084, analysis §2.1/§4 R8-R9) — a container-query breakpoint: the
 * observed ELEMENT's own width via `ResizeObserver`, never `window`/`matchMedia`. A sheet
 * embedded in a narrow side panel on a wide monitor reads "sm", the same sheet embedded full
 * width on a phone reads "sm" too — both true container queries, unlike a media query.
 */
import { useEffect, useState, type RefObject } from "react";

/** Width thresholds (px) `useBreakpoint` resolves against. Defaults: `md` 1024, `sm` 640. */
export interface BreakpointThresholds {
  /** Width at/above which the breakpoint is `"lg"`. Default 1024. */
  md?: number;
  /** Width at/above which the breakpoint is `"md"` (below `md`'s threshold). Default 640. */
  sm?: number;
}

/** `"lg"` (unconstrained), `"md"` (narrower host, e.g. a side panel or tablet) or `"sm"` (a phone, or a narrow embed). */
export type Breakpoint = "lg" | "md" | "sm";

const DEFAULT_MD_THRESHOLD = 1024;
const DEFAULT_SM_THRESHOLD = 640;

function resolveBreakpoint(width: number, md: number, sm: number): Breakpoint {
  if (width >= md) return "lg";
  if (width >= sm) return "md";
  return "sm";
}

/**
 * The referenced element's own width, resolved to a `Breakpoint` through a `ResizeObserver`
 * (a container query, not the viewport). Before the element is measured, and in environments
 * without `ResizeObserver` (jsdom without a polyfill, very old browsers), resolves `"lg"` —
 * the unconstrained default — so anything not yet measurable renders the full layout rather
 * than guessing narrow.
 */
export function useBreakpoint(
  ref: RefObject<Element | null>,
  thresholds?: BreakpointThresholds,
): Breakpoint {
  const md = thresholds?.md ?? DEFAULT_MD_THRESHOLD;
  const sm = thresholds?.sm ?? DEFAULT_SM_THRESHOLD;
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("lg");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    // A width of 0 means "not laid out yet" (unmounted, `display: none`, or a jsdom test
    // without a real layout engine) — leave the default `"lg"` rather than resolving a false
    // `"sm"` for anything the environment cannot actually measure.
    const apply = (width: number) => {
      if (width > 0) setBreakpoint(resolveBreakpoint(width, md, sm));
    };
    apply(el.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect.width ?? el.getBoundingClientRect().width);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ref` is a stable RefObject
  }, [ref.current, md, sm]);

  return breakpoint;
}
