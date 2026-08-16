"use client";

/**
 * useCollapsiblePanel — THE canonical collapsing-panel mechanism (#190,
 * research 09 §B.2/§E.1).
 *
 * Extracted from Sidebar's collapse (sidebar.tsx): an always-mounted,
 * two-element width tween — a gap SPACER that reserves/releases the inline
 * width (`transition-[width] duration-base ease-linear`, collapsing to `w-0`)
 * and a fixed CONTAINER that slides off-screen
 * (`transition-[left,right,width] duration-base ease-linear`). `duration-base`
 * is the gated `--t-base` motion token, so reduced-motion is honoured for free
 * (pure CSS — the shared base stays motion-free, research 09 decision 2).
 *
 * The hook owns:
 *   - the state machine — controlled + uncontrolled `open` per
 *     component-api.md (`isControlled = open !== undefined`, never flips
 *     modes) with `setOpen`/`toggle`;
 *   - the `data-state`/`data-side` attrs for the group element;
 *   - the assembly of the two class fragments in the canonical order.
 *
 * Width / collapse-trigger / slide utilities are passed as LITERAL class
 * strings by the consumer (Tailwind's scanner must see each literal in
 * source — a template-interpolated class is never generated), with
 * state-keyed defaults for a generic panel. Sidebar passes its
 * `--sidebar-width` + `group-data-[collapsible=offcanvas]` literals and gets
 * back its exact original fragments (the byte-identical re-point).
 *
 * Fork-prevention: a second gap-spacer + fixed-slide width tween outside this
 * folder fails `pnpm collapse-fork:check` (scripts/check-collapse-fork.mjs).
 */
import { useCallback, useMemo, useState } from "react";
import { cn } from "../../lib/cn";

export type CollapsiblePanelSide = "left" | "right";
export type CollapsiblePanelState = "expanded" | "collapsed";

/**
 * State-keyed defaults for a generic panel: the consumer wraps the panel in a
 * `group` element carrying `attrs` and sets `--collapsible-panel-width` on it.
 */
const DEFAULT_WIDTH_CLASSNAME = "w-(--collapsible-panel-width)";
const DEFAULT_SPACER_COLLAPSED_CLASSNAME = "group-data-[state=collapsed]:w-0";
const DEFAULT_CONTAINER_SLIDE_CLASSNAMES: Record<CollapsiblePanelSide, string> = {
  left: "left-0 group-data-[state=collapsed]:left-[calc(var(--collapsible-panel-width)*-1)]",
  right: "right-0 group-data-[state=collapsed]:right-[calc(var(--collapsible-panel-width)*-1)]",
};

export interface UseCollapsiblePanelOptions {
  /** Which edge the panel lives on. Default `"left"`. */
  side?: CollapsiblePanelSide;
  /** Controlled open state (`isControlled = open !== undefined`). */
  open?: boolean;
  /** Uncontrolled initial open state. Default `true`. */
  defaultOpen?: boolean;
  /** Called with the next open state on `setOpen`/`toggle`. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Literal expanded-width utility (e.g. `"w-(--sidebar-width)"`). Must be a
   * literal in the consumer's source so Tailwind generates it.
   */
  widthClassName?: string;
  /**
   * Literal collapsed-state utility for the gap spacer (e.g.
   * `"group-data-[collapsible=offcanvas]:w-0"`).
   */
  spacerCollapsedClassName?: string;
  /**
   * Literal off-screen slide utilities for the fixed container, keyed by side
   * (e.g. `left: "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"`).
   */
  containerSlideClassNames?: Record<CollapsiblePanelSide, string>;
}

/** Data attributes for the panel's `group` element. */
export interface CollapsiblePanelAttrs {
  "data-state": CollapsiblePanelState;
  "data-side": CollapsiblePanelSide;
}

export interface UseCollapsiblePanelReturn {
  /** Resolved open state (controlled prop wins). */
  open: boolean;
  /** `"expanded"` when open, `"collapsed"` when closed. */
  state: CollapsiblePanelState;
  side: CollapsiblePanelSide;
  /** Set the open state (accepts a value or an updater fn). */
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  toggle: () => void;
  /** `data-state`/`data-side` for the group element wrapping both fragments. */
  attrs: CollapsiblePanelAttrs;
  /** The gap-spacer fragment: reserves/releases the inline width. */
  spacerClassName: string;
  /** The fixed-container fragment: slides the panel off-screen. */
  containerClassName: string;
}

export function useCollapsiblePanel({
  side = "left",
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  widthClassName = DEFAULT_WIDTH_CLASSNAME,
  spacerCollapsedClassName = DEFAULT_SPACER_COLLAPSED_CLASSNAME,
  containerSlideClassNames = DEFAULT_CONTAINER_SLIDE_CLASSNAMES,
}: UseCollapsiblePanelOptions = {}): UseCollapsiblePanelReturn {
  // Controlled/uncontrolled per component-api.md: controlled iff the `open`
  // prop is provided; the mode never flips mid-life.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const setOpen = useCallback(
    (value: boolean | ((open: boolean) => boolean)) => {
      const next = typeof value === "function" ? value(open) : value;
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange, open],
  );

  const toggle = useCallback(() => setOpen((o) => !o), [setOpen]);

  const state: CollapsiblePanelState = open ? "expanded" : "collapsed";

  // The two class fragments — the Sidebar collapse mechanism verbatim
  // (research 09 §A.1): assembly order is part of the contract (it is what
  // keeps Sidebar's emitted className strings byte-identical).
  const spacerClassName = useMemo(
    () =>
      cn(
        "relative",
        widthClassName,
        "bg-transparent transition-[width] duration-base ease-linear",
        spacerCollapsedClassName,
      ),
    [spacerCollapsedClassName, widthClassName],
  );
  const containerClassName = useMemo(
    () =>
      cn(
        "fixed inset-y-0 z-10 hidden h-svh",
        widthClassName,
        "transition-[left,right,width] duration-base ease-linear md:flex",
        containerSlideClassNames[side],
      ),
    [containerSlideClassNames, side, widthClassName],
  );

  const attrs = useMemo<CollapsiblePanelAttrs>(
    () => ({ "data-state": state, "data-side": side }),
    [side, state],
  );

  return useMemo(
    () => ({ open, state, side, setOpen, toggle, attrs, spacerClassName, containerClassName }),
    [open, state, side, setOpen, toggle, attrs, spacerClassName, containerClassName],
  );
}
