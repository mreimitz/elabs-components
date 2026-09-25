"use client";

import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../../lib/cn";
import { useCopyToClipboard } from "../../lib/use-copy-to-clipboard";
import { isMotionAtFloor, readMotionFactor } from "../../lib/use-scroll-progress";
import { Button } from "../button";
import { Card } from "../card";
import { CommandChip } from "../command-chip";
import { RevealOnEnter } from "../reveal-on-enter";
import { Skeleton } from "../skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

// ─────────────────────────────── AffordanceHint ───────────────────────────────

const HINT_DELAY_MS = 800;

function hintSeen(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markHintSeen(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage blocked (private mode, sandboxed iframe): the hint may show again. Harmless.
  }
}

export interface AffordanceHintProps extends HTMLAttributes<HTMLSpanElement> {
  /** `sessionStorage` key: once the hint has shown (or the visitor interacted), it never returns this session. */
  storageKey: string;
  /** ms after mount before the hint appears; skipped entirely when the motion gate is closed. Default 800. */
  delay?: number;
}

/**
 * A one-time visual nudge ("Drag a tile") pinned in the corner of its positioned parent. It
 * appears `delay` ms after mounting (at once when motion is reduced), leaves on the first
 * `pointerdown`/`keydown` inside that parent, and shows once per `storageKey` per session. It is
 * `aria-hidden` — the surface it points at is accessible on its own; this is a visual cue only.
 */
export const AffordanceHint = forwardRef<HTMLSpanElement, AffordanceHintProps>(
  function AffordanceHint(
    { storageKey, delay = HINT_DELAY_MS, className, children, ...props },
    ref,
  ) {
    const innerRef = useRef<HTMLSpanElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLSpanElement, []);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      const el = innerRef.current;
      const host = el?.parentElement;
      if (!el || !host || hintSeen(storageKey)) return;
      const wait = isMotionAtFloor(readMotionFactor(el)) ? 0 : delay;
      const timer = window.setTimeout(() => {
        markHintSeen(storageKey);
        setVisible(true);
      }, wait);
      const dismiss = () => {
        window.clearTimeout(timer);
        markHintSeen(storageKey);
        setVisible(false);
        host.removeEventListener("pointerdown", dismiss, true);
        host.removeEventListener("keydown", dismiss, true);
      };
      host.addEventListener("pointerdown", dismiss, true);
      host.addEventListener("keydown", dismiss, true);
      return () => {
        window.clearTimeout(timer);
        host.removeEventListener("pointerdown", dismiss, true);
        host.removeEventListener("keydown", dismiss, true);
      };
    }, [storageKey, delay]);

    return (
      <span
        ref={innerRef}
        aria-hidden="true"
        data-slot="affordance-hint"
        data-visible={visible ? "" : undefined}
        className={cn(
          "pointer-events-none absolute end-3 top-3 z-10 rounded-full bg-primary px-2.5 py-1 text-meta text-primary-foreground shadow-ring-sm transition-opacity duration-base ease-standard",
          visible ? "opacity-100" : "opacity-0",
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);

// ───────────────────────────── SurfaceTourActions ─────────────────────────────

/** Every string the actions row renders — pass your own to localize it. */
export interface SurfaceTourActionsLabels {
  openInStorybook: string;
  copyPrompt: string;
  promptCopied: string;
  promptCopyFailed: string;
  scaffold: string;
  copyCommand: string;
}

export const DEFAULT_SURFACE_TOUR_ACTIONS_LABELS: SurfaceTourActionsLabels = {
  openInStorybook: "Open in Storybook",
  copyPrompt: "Copy prompt",
  promptCopied: "Prompt copied",
  promptCopyFailed: "Could not copy the prompt",
  scaffold: "Scaffold",
  copyCommand: "Copy scaffold command",
};

export interface SurfaceTourActionsProps extends HTMLAttributes<HTMLDivElement> {
  /** Where "Open in Storybook" goes; it opens in a new tab. Omit to hide the link. */
  storybookHref?: string;
  /** The (multi-line) prompt "Copy prompt" writes to the clipboard. Omit to hide the button. */
  prompt?: string;
  /** The scaffold command shown in a copyable chip. Omit to hide the chip. */
  command?: string;
  /** Override any rendered string. */
  labels?: Partial<SurfaceTourActionsLabels>;
}

/** The per-surface actions row: open the story, copy an agent prompt, copy the scaffold command. */
export const SurfaceTourActions = forwardRef<HTMLDivElement, SurfaceTourActionsProps>(
  function SurfaceTourActions(
    { storybookHref, prompt, command, labels: labelsProp, className, ...props },
    ref,
  ) {
    const labels = { ...DEFAULT_SURFACE_TOUR_ACTIONS_LABELS, ...labelsProp };
    const { copied, copy } = useCopyToClipboard();
    const [failed, setFailed] = useState(false);

    return (
      <div
        ref={ref}
        data-slot="surface-tour-actions"
        className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
        {...props}
      >
        {storybookHref ? (
          <Button asChild variant="outline" size="sm">
            <a
              href={storybookHref}
              target="_blank"
              rel="noopener noreferrer"
              data-slot="surface-tour-actions-storybook"
            >
              {labels.openInStorybook}
            </a>
          </Button>
        ) : null}
        {prompt ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-slot="surface-tour-actions-prompt"
            data-copied={copied ? "" : undefined}
            onClick={() => {
              void copy(prompt).then((ok) => setFailed(!ok));
            }}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {labels.copyPrompt}
          </Button>
        ) : null}
        {command ? (
          <span className="flex min-w-0 max-w-full items-center gap-2">
            <span className="shrink-0 text-meta text-muted-foreground">{labels.scaffold}</span>
            <CommandChip
              className="min-w-0"
              hosts={[{ id: "scaffold", label: labels.scaffold, command }]}
              labels={{ copy: labels.copyCommand }}
            />
          </span>
        ) : null}
        <span role="status" aria-live="polite" className="sr-only">
          {copied ? labels.promptCopied : failed ? labels.promptCopyFailed : ""}
        </span>
      </div>
    );
  },
);

// ───────────────────────────────── SurfaceTour ────────────────────────────────

/** One surface in the tour. */
export interface SurfaceTourTab {
  /** Stable id — the tab value, the `#<hashKey>=<id>` deep link and the hint's session key. */
  id: string;
  /** Tab label. */
  label: ReactNode;
  /** One sentence under the frame saying what this surface is for. */
  useCase?: ReactNode;
  /** The actions row under the frame (typically a `SurfaceTourActions`). */
  actions?: ReactNode;
  /** Corner hint shown once per session when the surface first mounts. */
  hint?: ReactNode;
  /** Renders the surface. May suspend (a `React.lazy` or `next/dynamic` component). */
  render: () => ReactNode;
  /** Starts loading the surface's code; called on tab hover/focus, never on scroll. */
  prefetch?: () => void;
  /** Shown while the surface suspends. Default: a frame-filling `Skeleton`. */
  fallback?: ReactNode;
}

export interface SurfaceTourProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  tabs: SurfaceTourTab[];
  /** The tab shown first. Default: the first tab. */
  defaultTab?: string;
  /** Fires when the visitor picks another tab. */
  onTabChange?: (id: string) => void;
  /** Section heading. */
  title?: ReactNode;
  /** One sentence under the heading. */
  description?: ReactNode;
  /** When set, the active tab is read from and written to `#<hashKey>=<id>` (no history entries). */
  hashKey?: string;
  /** Classes for the frame — give it a height so every surface fills the same box. */
  frameClassName?: string;
}

interface Layer {
  id: string;
  leaving: boolean;
  entering: boolean;
}

/** Resolved `transition-duration` of `el` in ms (0 when motion is off or unmeasurable). */
function transitionMs(el: Element | null): number {
  if (!el || typeof window === "undefined") return 0;
  const raw = window.getComputedStyle(el).transitionDuration.split(",")[0]?.trim() ?? "";
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.endsWith("ms") ? value : value * 1000;
}

function readHash(hashKey: string): string | null {
  const match = new RegExp(`^#${hashKey}=([^&]+)$`).exec(window.location.hash);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * A tour of full-size surfaces behind a sticky tab strip. The frame stays put while the
 * surfaces crossfade (`--t-base`, instant under reduced motion); the frame's min-height only
 * ever grows, so switching never jumps the page. Surfaces mount on first selection and may
 * suspend (lazy code) behind a `Skeleton`; `prefetch` runs on hover/focus of a tab. The sticky
 * offset is the `--surface-tour-sticky-top` custom property (set it to your nav height).
 */
export const SurfaceTour = forwardRef<HTMLElement, SurfaceTourProps>(function SurfaceTour(
  {
    tabs,
    defaultTab,
    onTabChange,
    title,
    description,
    hashKey,
    frameClassName,
    className,
    ...props
  },
  ref,
) {
  const rootRef = useRef<HTMLElement>(null);
  useImperativeHandle(ref, () => rootRef.current as HTMLElement, []);
  const titleId = useId();
  const initial = tabs.find((t) => t.id === defaultTab)?.id ?? tabs[0]?.id ?? "";
  const [active, setActive] = useState(initial);
  const [layers, setLayers] = useState<Layer[]>([{ id: initial, leaving: false, entering: false }]);
  const frameRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(new Set<string>());

  const prefetch = useCallback((tab: SurfaceTourTab) => {
    if (!tab.prefetch || prefetched.current.has(tab.id)) return;
    prefetched.current.add(tab.id);
    tab.prefetch();
  }, []);

  const select = useCallback(
    (id: string, { fromHash = false } = {}) => {
      if (id === active || !tabs.some((t) => t.id === id)) return;
      setLayers([
        { id: active, leaving: true, entering: false },
        { id, leaving: false, entering: !fromHash },
      ]);
      setActive(id);
      if (hashKey && !fromHash && typeof window !== "undefined") {
        const { pathname, search } = window.location;
        window.history.replaceState(
          window.history.state,
          "",
          `${pathname}${search}#${hashKey}=${encodeURIComponent(id)}`,
        );
      }
      onTabChange?.(id);
    },
    [active, tabs, hashKey, onTabChange],
  );

  // Deep link: `#<hashKey>=<id>` opens that tab on load (a browser-only read, once).
  useEffect(() => {
    if (!hashKey) return;
    const id = readHash(hashKey);
    if (id && tabs.some((t) => t.id === id)) {
      select(id, { fromHash: true });
      rootRef.current?.scrollIntoView({ block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only read of the URL
  }, []);

  // The outgoing surface unmounts once the fade (the frame's resolved `--t-base`) is over.
  useEffect(() => {
    if (!layers.some((l) => l.leaving)) return;
    const ms = transitionMs(frameRef.current?.querySelector("[data-leaving]") ?? null);
    const done = () => setLayers((current) => current.filter((l) => !l.leaving));
    if (ms <= 1) {
      done();
      return;
    }
    const timer = window.setTimeout(done, ms);
    return () => window.clearTimeout(timer);
  }, [layers]);

  // Height lock: the frame's min-height ratchets up to the tallest surface seen.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver !== "function") return;
    let tallest = 0;
    const observer = new ResizeObserver(() => {
      const height = frame.getBoundingClientRect().height;
      if (height > tallest) {
        tallest = height;
        frame.style.minHeight = `${Math.ceil(height)}px`;
      }
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const activeTab = tabs.find((t) => t.id === active);

  return (
    <section
      ref={rootRef}
      data-slot="surface-tour"
      aria-labelledby={title ? titleId : undefined}
      className={cn("flex w-full min-w-0 flex-col gap-6", className)}
      {...props}
    >
      {title || description ? (
        <RevealOnEnter as="header" data-slot="surface-tour-header" className="flex flex-col gap-2">
          {title ? (
            <h2 id={titleId} className="text-display text-foreground">
              {title}
            </h2>
          ) : null}
          {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
        </RevealOnEnter>
      ) : null}
      <Tabs
        value={active}
        onValueChange={(id) => select(id)}
        className="flex min-w-0 flex-col gap-4"
      >
        <div
          data-slot="surface-tour-tabs"
          className={cn(
            "sticky z-20 bg-background py-2",
            // Overflow affordance on narrow screens: the strip scrolls, the end edge fades.
            "max-md:after:pointer-events-none max-md:after:absolute max-md:after:inset-y-0 max-md:after:end-0 max-md:after:w-10 max-md:after:from-background ltr:max-md:after:bg-linear-to-l rtl:max-md:after:bg-linear-to-r",
          )}
          style={{ top: "var(--surface-tour-sticky-top, 0px)" }}
        >
          <TabsList className="w-full justify-start md:w-auto">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                onPointerEnter={() => prefetch(tab)}
                onFocus={() => prefetch(tab)}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Card
          ref={frameRef}
          data-slot="surface-tour-frame"
          className={cn("relative grid min-h-96 overflow-hidden p-0 shadow-md", frameClassName)}
        >
          {tabs.map((tab) => {
            const layer = layers.find((l) => l.id === tab.id);
            return (
              <TabsContent
                key={tab.id}
                value={tab.id}
                forceMount
                hidden={!layer}
                inert={layer?.leaving || undefined}
                aria-hidden={layer?.leaving || undefined}
                data-leaving={layer?.leaving ? "" : undefined}
                className={cn(
                  "relative col-start-1 row-start-1 mt-0 min-h-0 min-w-0 transition-opacity duration-base ease-standard",
                  layer?.leaving && "pointer-events-none opacity-0",
                  layer?.entering && "starting:opacity-0",
                )}
              >
                {layer ? (
                  <>
                    <Suspense
                      fallback={tab.fallback ?? <Skeleton className="size-full min-h-96" />}
                    >
                      {tab.render()}
                    </Suspense>
                    {tab.hint && !layer.leaving ? (
                      <AffordanceHint
                        storageKey={`surface-tour-hint:${hashKey ?? "tour"}:${tab.id}`}
                      >
                        {tab.hint}
                      </AffordanceHint>
                    ) : null}
                  </>
                ) : null}
              </TabsContent>
            );
          })}
        </Card>
        {activeTab?.useCase || activeTab?.actions ? (
          <div data-slot="surface-tour-footer" className="flex min-w-0 flex-col gap-3">
            {activeTab.useCase ? (
              <p className="text-body text-muted-foreground">{activeTab.useCase}</p>
            ) : null}
            {activeTab.actions}
          </div>
        ) : null}
      </Tabs>
    </section>
  );
});
