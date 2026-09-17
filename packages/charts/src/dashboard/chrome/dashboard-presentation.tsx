"use client";

/**
 * `DashboardPresentation` (RM-087, analysis §2.4 "Qlik storytelling skipped", §4 R29) — the
 * kiosk wrapper for a sheet (or several, cycled) shown to an audience rather than edited:
 * full-bleed, no toolbar/asset/properties chrome (compose `DashboardSheet chrome={false}` —
 * and skip `DashboardSelectionBar` — in whatever you pass as `children`/`sheets`), an
 * optional auto-advance through `sheets`, and a host refresh hook. It never fetches or owns
 * routing itself (D5): `onRefresh` and `onExit` are callbacks the host drives.
 *
 * Real OS fullscreen is requested ONLY from the "Present" button — a user gesture, never on
 * mount — and the button is omitted where `document.documentElement.requestFullscreen` does
 * not exist (some browsers, every headless test runner). The kiosk LOOK (full-bleed, no
 * chrome) applies regardless of whether fullscreen was granted.
 *
 * Auto-advance is pausable (WCAG 2.2.2): hovering the surface, or focusing a control INSIDE
 * it (a dot, "Present"/"Exit"), stops the timer; Escape or the always-present "Exit
 * presentation" button leaves — Escape is never the ONLY way out. A polite live region
 * announces the sheet change; the root itself is focusable (`tabIndex={-1}`, `focus-ring`) and
 * is focused programmatically on mount so keyboard commands (Escape, arrows) work immediately
 * — that PROGRAMMATIC focus is deliberately excluded from the pause check (it targets the root
 * itself, never a descendant control), or auto-advance would never run at all.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Maximize2, X } from "lucide-react";
import { Button, cn } from "@elabs-ai/components-ui";

/** Strings `DashboardPresentation` renders; missing keys fall back to English. */
export interface DashboardPresentationLabels {
  /** The fullscreen-request button. */
  present: string;
  /** The always-visible exit control. */
  exitPresentation: string;
  /** The progress-dots navigation landmark. */
  sheetsNav: string;
  /** One progress dot's accessible name. 1-based. */
  goToSheet: (index: number) => string;
  /** The polite live-region announcement on every sheet change. 1-based. */
  sheetOf: (index: number, total: number) => string;
}

export const DEFAULT_DASHBOARD_PRESENTATION_LABELS: DashboardPresentationLabels = {
  present: "Present",
  exitPresentation: "Exit presentation",
  sheetsNav: "Presentation sheets",
  goToSheet: (index) => `Go to sheet ${index}`,
  sheetOf: (index, total) => `Sheet ${index} of ${total}`,
};

export interface DashboardPresentationProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /**
   * One already-composed sheet view per entry (typically `DashboardProvider` wrapping
   * `DashboardSheet chrome={false}`) — cycled when there is more than one. Omit for a single,
   * non-cycling view passed as `children` instead.
   */
  sheets?: ReactNode[];
  /** The single view shown when `sheets` is omitted. */
  children?: ReactNode;
  /** Advance to the next sheet on this interval (ms). Needs `sheets.length > 1`; omitted or
   * ≤ 0: no auto-advance (arrow-key stepping and the dots still work). */
  cycleMs?: number;
  /** Which sheet shows first. Default `0`. */
  initialIndex?: number;
  /** Fires whenever the shown sheet changes — cycling, arrow keys or a dot click. */
  onIndexChange?: (index: number) => void;
  /** Call `onRefresh` on this interval (ms); omitted or ≤ 0: never. */
  refreshMs?: number;
  /** The host's reload hook (D5: the surface never fetches) — called on `refreshMs`'s
   * schedule and never again once this component unmounts. */
  onRefresh?: () => void;
  /** Escape, or the "Exit presentation" button. */
  onExit?: () => void;
  labels?: Partial<DashboardPresentationLabels>;
}

/** Whether the runtime exposes the Fullscreen API at all — guards browsers/test runners
 * (jsdom included) that don't implement `requestFullscreen`. */
function supportsFullscreen(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.documentElement.requestFullscreen === "function"
  );
}

export const DashboardPresentation = forwardRef<HTMLDivElement, DashboardPresentationProps>(
  function DashboardPresentation(
    {
      sheets,
      children,
      cycleMs,
      initialIndex = 0,
      onIndexChange,
      refreshMs,
      onRefresh,
      onExit,
      labels,
      className,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      ...props
    },
    forwardedRef,
  ) {
    const mergedLabels = { ...DEFAULT_DASHBOARD_PRESENTATION_LABELS, ...labels };
    const views = sheets ?? (children !== undefined ? [children] : []);
    const total = views.length;
    const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), total - 1 || 0));
    const [paused, setPaused] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const statusId = useId();

    const setRefs = useCallback(
      (el: HTMLDivElement | null) => {
        rootRef.current = el;
        if (typeof forwardedRef === "function") forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef],
    );

    const goTo = useCallback(
      (next: number) => {
        if (total === 0) return;
        const wrapped = ((next % total) + total) % total;
        setIndex(wrapped);
        onIndexChange?.(wrapped);
      },
      [total, onIndexChange],
    );

    // Auto-advance — pausable (WCAG 2.2.2): hover/focus (below) stops it; unmount always clears it.
    useEffect(() => {
      if (!cycleMs || cycleMs <= 0 || total <= 1 || paused) return;
      const id = setInterval(() => goTo(index + 1), cycleMs);
      return () => clearInterval(id);
    }, [cycleMs, total, paused, index, goTo]);

    // Host refresh hook (D5) — never fires again after unmount.
    useEffect(() => {
      if (!refreshMs || refreshMs <= 0) return;
      const id = setInterval(() => onRefresh?.(), refreshMs);
      return () => clearInterval(id);
    }, [refreshMs, onRefresh]);

    // A visible focus target lands on the surface itself as soon as it mounts.
    useEffect(() => {
      rootRef.current?.focus();
    }, []);

    const handleKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onExit?.();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goTo(index + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          goTo(index - 1);
        }
      },
      [goTo, index, onExit],
    );

    const requestPresent = useCallback(() => {
      rootRef.current?.requestFullscreen?.().catch(() => {
        // Browsers reject a request outside a trusted user gesture or when a policy blocks
        // it; the kiosk look (full-bleed, no chrome) already holds either way.
      });
    }, []);

    return (
      <div
        ref={setRefs}
        data-slot="dashboard-presentation"
        tabIndex={-1}
        aria-describedby={statusId}
        className={cn("flex h-full w-full flex-col bg-background focus-ring", className)}
        onKeyDown={handleKeyDown}
        onMouseEnter={(event) => {
          setPaused(true);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setPaused(false);
          onMouseLeave?.(event);
        }}
        onFocus={(event) => {
          // Skip the root's own programmatic mount-focus (below) — only a focused DESCENDANT
          // control (a dot, "Present"/"Exit") should pause auto-advance.
          if (event.target !== rootRef.current) setPaused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setPaused(false);
          onBlur?.(event);
        }}
        {...props}
      >
        <div
          data-slot="dashboard-presentation-controls"
          className="flex items-center justify-end gap-2 p-2"
        >
          {supportsFullscreen() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-slot="dashboard-presentation-present"
              onClick={requestPresent}
            >
              <Maximize2 aria-hidden="true" />
              {mergedLabels.present}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-slot="dashboard-presentation-exit"
            aria-label={mergedLabels.exitPresentation}
            onClick={() => onExit?.()}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div
          id={statusId}
          data-slot="dashboard-presentation-status"
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {total > 0 ? mergedLabels.sheetOf(index + 1, total) : ""}
        </div>
        <div data-slot="dashboard-presentation-view" className="min-h-0 flex-1">
          {views[index]}
        </div>
        {total > 1 && (
          <nav
            data-slot="dashboard-presentation-dots"
            aria-label={mergedLabels.sheetsNav}
            className="flex items-center justify-center gap-2 p-3"
          >
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={mergedLabels.goToSheet(i + 1)}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "size-2 rounded-full focus-ring",
                  i === index ? "bg-foreground" : "bg-muted-foreground/40",
                )}
                onClick={() => goTo(i)}
              />
            ))}
          </nav>
        )}
      </div>
    );
  },
);
