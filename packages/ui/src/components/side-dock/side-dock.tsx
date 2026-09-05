"use client";

/**
 * SideDock — a *summoned* panel that docks to one edge of the content area:
 * closed by default, opened by something the user does, resizable by
 * pointer AND keyboard, and — below a viewport threshold — presented as an
 * overlay `Sheet` instead of a column. See
 * `docs/ADR/0035-context-rail-and-side-dock.md` §5. `ContextRail` (the
 * sibling in this package) is a *persistent* rail with a 48px icon collapsed
 * state; SideDock is not persistent and has no icon state.
 *
 * Built on the mandatory `useCollapsiblePanel` mechanism (open/close tween)
 * and `useIsMobile(overlayBreakpoint)` (the column/overlay switch) — both
 * shared with `ContextRail`, never re-implemented here.
 */
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { useIsMobile } from "../../lib/use-mobile";
import { useCollapsiblePanel } from "../collapsible-panel";
import { useLocale } from "../locale-provider/locale-provider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../sheet";

export interface SideDockProps extends Omit<ComponentProps<"aside">, "title"> {
  /**
   * The dock's name. Rendered as its header heading, and as the `SheetTitle`
   * of the overlay presentation. REQUIRED: the overlay cannot be accessible
   * without it, and an optional prop with a generic default would ship a
   * meaningless announced name into real apps.
   */
  title: ReactNode;
  /**
   * Optional longer description. Visible under the title in the column
   * presentation; `sr-only` in the overlay presentation (the compact sheet
   * header has no room for it, but it still reaches assistive tech).
   */
  description?: ReactNode;
  /** Optional controls placed in the header row beside the built-in close button. */
  headerActions?: ReactNode;

  /** Controlled open state. Closed means zero width (content stays mounted, inert). */
  open?: boolean;
  /** Uncontrolled initial open state. Default `false` — a dock is summoned. */
  defaultOpen?: boolean;
  /** Called with the next open state. */
  onOpenChange?: (open: boolean) => void;

  /** Which edge it docks to. Default `"right"`. */
  side?: "left" | "right";

  /**
   * `width`, `defaultWidth`, `minWidth`, `maxWidth`, `minContentWidth` and
   * `resizable` (below) govern the COLUMN presentation only — viewport at or
   * above `overlayBreakpoint`. Below that breakpoint the dock renders as an
   * overlay `Sheet` sized by the viewport (`Sheet`'s own `w-3/4 max-w-sm`),
   * so none of these props have any effect there.
   */
  /** Controlled width in px. */
  width?: number;
  /** Uncontrolled initial width in px. Default `400`. */
  defaultWidth?: number;
  /** Fires continuously during a resize — drive layout from this. */
  onWidthChange?: (width: number) => void;
  /** Fires once when an interaction ends — PERSIST from this. */
  onWidthCommit?: (width: number) => void;

  /** Lower bound in px. Default `320`. */
  minWidth?: number;
  /** Upper bound in px. Default `640`. */
  maxWidth?: number;
  /** Content width preserved when clamping against the live viewport, px. Default `480`. */
  minContentWidth?: number;
  /** Whether the resize handle renders. Default `true`. */
  resizable?: boolean;

  /**
   * Viewport width in px below which the dock renders as an overlay `Sheet`
   * instead of a column. Default `1100`. Deliberately ABOVE the library's
   * 768px mobile breakpoint: a 400px dock at 768px leaves ~360px of content.
   * This is the switch point for the column-only sizing props above — the
   * overlay presentation ignores them entirely.
   */
  overlayBreakpoint?: number;
}

const DEFAULT_WIDTH = 400;
const DEFAULT_MIN_WIDTH = 320;
const DEFAULT_MAX_WIDTH = 640;
const DEFAULT_MIN_CONTENT_WIDTH = 480;
const DEFAULT_OVERLAY_BREAKPOINT = 1100;
// A single arrow-key step, and Shift's multiplier on it (Mechanism §3).
const KEY_STEP = 16;
const KEY_STEP_SHIFT_MULTIPLIER = 4;
// SSR-only fallback — "use client" means this never actually renders on a
// server, but a hook initializer still runs once during any non-browser
// render pass (e.g. a framework's SSR pass before hydration).
const FALLBACK_VIEWPORT_WIDTH = 1024;

/**
 * The clamp, written out exactly as specified (Ruling 26 §3):
 * `minWidth` wins last, so a hostile viewport can never render a
 * sub-minimum dock.
 */
function clampWidth(
  requested: number,
  viewportWidth: number,
  minWidth: number,
  maxWidth: number,
  minContentWidth: number,
): number {
  const upperBound = Math.min(maxWidth, viewportWidth - minContentWidth);
  return Math.max(minWidth, Math.min(requested, upperBound));
}

export const SideDock = forwardRef<HTMLElement, SideDockProps>(function SideDock(
  {
    title,
    description,
    headerActions,
    open,
    defaultOpen = false,
    onOpenChange,
    side = "right",
    width,
    defaultWidth = DEFAULT_WIDTH,
    onWidthChange,
    onWidthCommit,
    minWidth = DEFAULT_MIN_WIDTH,
    maxWidth = DEFAULT_MAX_WIDTH,
    minContentWidth = DEFAULT_MIN_CONTENT_WIDTH,
    resizable = true,
    overlayBreakpoint = DEFAULT_OVERLAY_BREAKPOINT,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const { t, formatNumber } = useLocale();
  const titleId = useId();
  const resizeLabelId = useId();

  const panel = useCollapsiblePanel({ side, open, defaultOpen, onOpenChange });
  const isOverlay = useIsMobile(overlayBreakpoint);

  // The live viewport width the clamp reads — `useIsMobile` only exposes a
  // boolean threshold, not the pixel value clamping needs.
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : FALLBACK_VIEWPORT_WIDTH,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isWidthControlled = width !== undefined;
  const [uncontrolledWidth, setUncontrolledWidth] = useState(defaultWidth);
  const requestedWidth = isWidthControlled ? (width as number) : uncontrolledWidth;
  const upperBound = Math.min(maxWidth, viewportWidth - minContentWidth);
  const clampedWidth = clampWidth(
    requestedWidth,
    viewportWidth,
    minWidth,
    maxWidth,
    minContentWidth,
  );

  // A ref mirror of the currently-rendered clamped width, refreshed on every
  // render (not via an effect) so the keyboard/pointer handlers below can
  // read and update it synchronously between two native browser events —
  // React may not have committed a re-render from the previous event yet.
  const latestWidthRef = useRef(clampedWidth);
  latestWidthRef.current = clampedWidth;

  // Convergence (fixed contract decision): a CONTROLLED width outside the
  // clamp renders the clamped number and reports it back once — on mount,
  // and again whenever a viewport resize moves the bound. Deps are scoped to
  // the VALUES only (not the callback props), so an inline
  // onWidthChange/onWidthCommit from the caller can't re-trigger this on
  // every render — it fires only when what it reports actually changes.
  useEffect(() => {
    if (!isWidthControlled) return;
    if (clampedWidth === width) return;
    onWidthChange?.(clampedWidth);
    onWidthCommit?.(clampedWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWidthControlled, clampedWidth, width]);

  /** A no-op never emits (Ruling 26 §2). Returns whether it actually changed. */
  function requestWidth(next: number): boolean {
    if (next === latestWidthRef.current) return false;
    latestWidthRef.current = next;
    if (!isWidthControlled) setUncontrolledWidth(next);
    onWidthChange?.(next);
    return true;
  }

  // Shared across the keyboard and pointer gestures below: did THIS gesture
  // (the run of keydowns between focus and keyup, or the pointerdown-to-
  // pointerup drag) actually change the value? `onWidthCommit` is a
  // persistence trigger — firing it for a no-op gesture is noise.
  const gestureChangedRef = useRef(false);

  function handleResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Physical, not logical/RTL-aware (Mechanism §3): on a right-hand dock
    // ArrowLeft widens (the handle moves toward the content); a left-hand
    // dock swaps the two.
    const widenKey = side === "right" ? "ArrowLeft" : "ArrowRight";
    const narrowKey = side === "right" ? "ArrowRight" : "ArrowLeft";
    const step = event.shiftKey ? KEY_STEP * KEY_STEP_SHIFT_MULTIPLIER : KEY_STEP;
    let requested: number | undefined;
    if (event.key === widenKey) requested = latestWidthRef.current + step;
    else if (event.key === narrowKey) requested = latestWidthRef.current - step;
    else if (event.key === "Home") requested = minWidth;
    else if (event.key === "End") requested = upperBound;
    else return;
    event.preventDefault();
    const next = clampWidth(requested, viewportWidth, minWidth, maxWidth, minContentWidth);
    if (requestWidth(next)) gestureChangedRef.current = true;
  }

  function handleResizeKeyUp() {
    if (gestureChangedRef.current) onWidthCommit?.(latestWidthRef.current);
    gestureChangedRef.current = false;
  }

  const pointerStartRef = useRef<{ x: number; width: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureChangedRef.current = false;
    pointerStartRef.current = { x: event.clientX, width: latestWidthRef.current };
    setIsDragging(true);
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current;
    if (!start) return;
    const delta = event.clientX - start.x;
    const signedDelta = side === "right" ? -delta : delta;
    const next = clampWidth(
      start.width + signedDelta,
      viewportWidth,
      minWidth,
      maxWidth,
      minContentWidth,
    );
    if (requestWidth(next)) gestureChangedRef.current = true;
  }

  function endPointerGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerStartRef.current) return;
    pointerStartRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (gestureChangedRef.current) onWidthCommit?.(latestWidthRef.current);
    gestureChangedRef.current = false;
  }

  // The generic `close` key (messages.ts "Generic" section) — reused per the
  // brief rather than minting a new one.
  const closeLabel = t("close");
  const resizeValueText = t("ui.sideDock.widthValue", {
    count: Math.round(clampedWidth),
    size: formatNumber(Math.round(clampedWidth)),
  });

  const resizeHandle = resizable && (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-labelledby={`${resizeLabelId} ${titleId}`}
      aria-valuenow={Math.round(clampedWidth)}
      aria-valuemin={minWidth}
      aria-valuemax={Math.round(upperBound)}
      aria-valuetext={resizeValueText}
      tabIndex={0}
      data-slot="side-dock-resize-handle"
      onPointerDown={handleResizePointerDown}
      onPointerMove={handleResizePointerMove}
      onPointerUp={endPointerGesture}
      onPointerCancel={endPointerGesture}
      onKeyDown={handleResizeKeyDown}
      onKeyUp={handleResizeKeyUp}
      className={cn(
        // A literal px hit box, not a `w-*` spacing utility — `--spacing` is
        // what `data-density="compact"` rescales (Mechanism §3).
        "absolute inset-y-0 w-[min(24px,50%)] cursor-col-resize touch-none select-none",
        side === "right" ? "left-0" : "right-0",
        "focus-visible:outline-none",
        isDragging
          ? cn(
              "after:absolute after:inset-y-0 after:w-1 after:bg-primary after:content-['']",
              side === "right" ? "after:left-0" : "after:right-0",
            )
          : cn(
              "after:absolute after:inset-y-0 after:w-px after:bg-muted-foreground after:content-['']",
              "hover:after:w-1 focus-visible:after:w-1",
              side === "right" ? "after:left-0" : "after:right-0",
            ),
        "focus-visible:after:focus-ring-static",
      )}
    >
      <span id={resizeLabelId} className="sr-only">
        {t("ui.sideDock.resize")}
      </span>
    </div>
  );

  if (isOverlay) {
    return (
      <Sheet open={panel.open} onOpenChange={panel.setOpen}>
        <SheetContent
          // Runtime-safe: Radix's Content ref resolves to a plain
          // HTMLDivElement, same as the column branch's <aside> ref target
          // at the type level (both extend HTMLElement).
          ref={ref as unknown as Ref<HTMLDivElement>}
          side={side}
          data-slot="side-dock"
          className={cn("flex flex-col bg-card p-0", className)}
          style={style}
          // With no description the dialog is still named by its title, so
          // opt out of `aria-describedby` explicitly rather than let Radix
          // warn about a missing description (mirrors ExpandDialogContent).
          {...(description ? {} : { "aria-describedby": undefined })}
          {...props}
        >
          <SheetHeader
            data-slot="side-dock-header"
            className="flex-row items-start gap-2 space-y-0 border-b border-border px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <SheetTitle data-slot="side-dock-title" className="text-title">
                {title}
              </SheetTitle>
            </div>
            {headerActions}
          </SheetHeader>
          {description && <SheetDescription className="sr-only">{description}</SheetDescription>}
          <div data-slot="side-dock-body" className="min-h-0 flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      data-slot="side-dock"
      // `group`: the ancestor `group-data-[state=collapsed]:…` selectors in
      // `panel.spacerClassName`/`panel.containerClassName` resolve against
      // THIS element (Mechanism §1 — mirrors Sidebar's outer `group` div).
      className="group"
      {...panel.attrs}
      style={{ "--collapsible-panel-width": `${clampedWidth}px` } as CSSProperties}
    >
      <div data-slot="side-dock-spacer" className={panel.spacerClassName} />
      <aside
        ref={ref}
        data-slot="side-dock-container"
        aria-labelledby={titleId}
        // The collapsed container stays mounted (for the closing transition)
        // but stops being interactive/reachable (fixed contract decision).
        inert={!panel.open}
        className={cn(
          panel.containerClassName,
          "flex-col bg-card",
          side === "right" ? "border-l" : "border-r",
          className,
        )}
        style={style}
        {...props}
      >
        <div
          data-slot="side-dock-header"
          className="flex items-start gap-2 border-b border-border px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <div id={titleId} data-slot="side-dock-title" className="text-title">
              {title}
            </div>
            {description && <div className="text-body text-muted-foreground">{description}</div>}
          </div>
          {headerActions}
          <button
            type="button"
            data-slot="side-dock-close"
            aria-label={closeLabel}
            onClick={() => panel.setOpen(false)}
            className="shrink-0 rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div data-slot="side-dock-body" className="min-h-0 flex-1 overflow-y-auto p-4">
          {children}
        </div>
        {resizeHandle}
      </aside>
    </div>
  );
});
