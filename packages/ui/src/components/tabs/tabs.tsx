"use client";

import {
  createContext,
  forwardRef,
  use,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { cn } from "../../lib/cn";
import { mergeRefs } from "../../lib/merge-refs";

export const Tabs = TabsPrimitive.Root;

/**
 * Bring `trigger` inside the visible bounds of ITS OWN tab strip.
 *
 * Deliberately NOT `Element.scrollIntoView()`: that walks every scrollable
 * ancestor up to the document, so a Tabs sitting below the fold yanks the
 * whole PAGE (measured: `window.scrollY` 0 → 900 on a non-overflowing strip
 * under a 3000px spacer). Scrolling the strip itself is the only movement
 * this feature is entitled to make. It is also why nothing here throws under
 * jsdom, where `scrollIntoView` does not exist: the overflow gate below
 * returns first (`scrollWidth === clientWidth === 0`) and the scroll call is
 * feature-detected.
 */
function scrollTriggerIntoStrip(trigger: HTMLElement, behavior: ScrollBehavior) {
  const strip = trigger.closest<HTMLElement>('[role="tablist"]');
  if (!strip) return;
  // A strip that fits has nothing to scroll — keep it byte-for-byte inert.
  if (strip.scrollWidth <= strip.clientWidth) return;

  // Keep the strip's own padding as a gutter, so the tab lands inset (with its
  // focus ring / active shadow visible) rather than flush against the edge.
  const { paddingLeft, paddingRight } = getComputedStyle(strip);
  const triggerRect = trigger.getBoundingClientRect();
  const stripRect = strip.getBoundingClientRect();
  const visibleLeft = stripRect.left + (parseFloat(paddingLeft) || 0);
  const visibleRight = stripRect.right - (parseFloat(paddingRight) || 0);
  const delta =
    triggerRect.left < visibleLeft
      ? triggerRect.left - visibleLeft
      : triggerRect.right > visibleRight
        ? triggerRect.right - visibleRight
        : 0;
  // Nothing to do: the tab is already fully visible — typically because the
  // browser's own focus-scroll got there first on a keyboard/pointer
  // activation. That check is what keeps this from fighting the browser.
  if (delta === 0) return;

  // An ABSOLUTE target, not `scrollBy(delta)`: a relative scroll issued while
  // an earlier smooth scroll is still in flight accumulates against a moving
  // offset and lands short. `scrollLeft + delta` is read in the same instant
  // as the rects, so it is exact whatever the animation is doing.
  const left = strip.scrollLeft + delta;
  if (typeof strip.scrollTo === "function") strip.scrollTo({ left, behavior });
  else strip.scrollLeft = left;
}

/**
 * `overflow-x-auto` + `max-w-full` turn an overflowing tab strip into a
 * scroll container instead of silently clipping it — a bare `inline-flex`
 * has no bound on this element's own width, so without `max-w-full` it would
 * just grow past its parent instead of scrolling. `justify-center-safe`
 * (not `justify-center`) is required too: plain `justify-center` strands the
 * first tab off the left edge once the set overflows; `safe` falls back to
 * start-alignment on overflow while staying visually identical when the
 * strip fits (see #344).
 *
 * Token-driven default (`--tabs-variant`, default `segmented`): when the
 * caller passes NO `variant`, `TabsList`/`TabsTrigger` render with no
 * `data-variant` attribute at all — the `segmented` cva branch below, plus
 * these `tabs-underline:`-prefixed overrides, which the `tabs-underline`
 * custom variant (`themes.css`) only activates via a container style query
 * on an ancestor's `--tabs-variant`. An explicit `variant` prop always
 * renders `data-variant`, which the same custom variant's `:not([data-variant])`
 * guard excludes — so these overrides are inert on an explicit strip and its
 * own `underline` branch (below) renders unchanged. Literal strings, not
 * built via interpolation — see `badge.tsx`'s note on the same rule.
 */
const TABS_UNDERLINE_LIST_OVERRIDE =
  "tabs-underline:flex tabs-underline:h-auto tabs-underline:w-full tabs-underline:justify-start tabs-underline:rounded-none tabs-underline:bg-transparent tabs-underline:p-0 tabs-underline:border-b tabs-underline:border-rule";

const TABS_UNDERLINE_TRIGGER_OVERRIDE =
  "tabs-underline:h-12 tabs-underline:rounded-none tabs-underline:border-b-(length:--tabs-indicator-width) tabs-underline:border-transparent tabs-underline:px-4 tabs-underline:py-0 tabs-underline:hover:text-foreground tabs-underline:focus-ring-inset tabs-underline:focus-visible:ring-offset-0 tabs-underline:data-[state=active]:bg-transparent tabs-underline:data-[state=active]:shadow-none tabs-underline:data-[state=active]:border-primary";

export const tabsListVariants = cva(
  "max-w-full items-center overflow-x-auto text-muted-foreground",
  {
    variants: {
      variant: {
        // Recessed pill track with a raised active segment. Also the
        // TOKEN-DRIVEN DEFAULT's base — see `TABS_UNDERLINE_LIST_OVERRIDE`.
        segmented: cn(
          "inline-flex h-9 justify-center-safe rounded-lg bg-muted p-1",
          TABS_UNDERLINE_LIST_OVERRIDE,
        ),
        // Line tabs: a transparent start-aligned row over a 1px rule; the active
        // tab's underline sits on top of it (see `tabsTriggerVariants`).
        underline: "flex w-full justify-start border-b border-rule",
        // Rail tabs: a vertical stack for `<Tabs orientation="vertical">` —
        // a settings nav, a feature switcher beside its preview. The list
        // grows with its triggers (no fixed height, no horizontal scroll) and
        // the active tab is marked by a start-edge bar + a muted fill.
        rail: "flex h-auto w-full flex-col items-stretch gap-1 overflow-visible",
      },
    },
    defaultVariants: { variant: "segmented" },
  },
);

export const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-body font-control transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Also the TOKEN-DRIVEN DEFAULT's base — see `TABS_UNDERLINE_TRIGGER_OVERRIDE`.
        segmented: cn(
          "rounded-control px-3 py-1",
          // `ring-offset-1`, not `-2`: the compound indicator's reach is
          // `ring-offset` + 2px ring + 1px contour, and `TabsList` is an
          // `overflow-x-auto` strip with `p-1` (4px). At offset 2 the reach is 5px
          // and the scroll box clips the contour on three sides (#67 fix round 2,
          // measured on `patterns-templates-starters-object-detail-hub--default` tab stop
          // 9); at offset 1 it is exactly 4px and the loop closes.
          "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "data-[state=active]:bg-surface-elevated data-[state=active]:text-foreground data-[state=active]:shadow-sm",
          "data-[state=active]:font-tabs-active",
          TABS_UNDERLINE_TRIGGER_OVERRIDE,
        ),
        underline: cn(
          // The underline is a bottom BORDER inside the fixed height, transparent
          // at rest, so activation never shifts layout. No negative margin to
          // overlap the list's rule: the list scrolls (`overflow-x-auto`), which
          // would clip anything hanging past its padding box. The strip has no
          // padding for an outer ring either, so the indicator is drawn inset.
          "h-12 rounded-none border-b-(length:--tabs-indicator-width) border-transparent px-4 hover:text-foreground",
          "focus-ring-inset",
          "data-[state=active]:border-primary data-[state=active]:text-foreground",
          "data-[state=active]:font-tabs-active",
        ),
        rail: cn(
          // A start-edge bar inside the box (transparent at rest) so activation
          // never shifts layout; rich triggers (icon + title + summary) wrap.
          "justify-start rounded-lg border-s-2 border-transparent px-3 py-2 text-start whitespace-normal hover:text-foreground",
          "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "data-[state=active]:border-s-primary data-[state=active]:bg-surface-muted data-[state=active]:text-foreground",
          "data-[state=active]:font-tabs-active",
        ),
      },
    },
    defaultVariants: { variant: "segmented" },
  },
);

export type TabsVariant = NonNullable<VariantProps<typeof tabsListVariants>["variant"]>;

/**
 * The list owns the variant; its triggers read it, so a strip never mixes
 * two. `undefined` = the caller passed no `variant` on `TabsList` — the
 * token-driven default (`--tabs-variant`): neither the list nor its triggers
 * render a `data-variant` attribute, so the `tabs-underline:` custom
 * variant's container style query decides the look.
 */
const TabsVariantContext = createContext<TabsVariant | undefined>(undefined);

export interface TabsListProps
  extends
    ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  function TabsList({ className, variant, ...props }, ref) {
    // cva's `VariantProps` types `variant` as possibly `null` (an explicit
    // opt-out); normalize it to `undefined` so it matches `TabsVariant |
    // undefined` — same DOM/CSS effect either way (no `data-variant`).
    const explicitVariant = variant ?? undefined;
    const resolved = explicitVariant ?? "segmented";
    const innerRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useMemo(() => mergeRefs(ref, innerRef), [ref]);
    // Honours the in-app tri-state motion preference on `ThemeProvider` as well
    // as the OS setting, and degrades to OS-only outside a provider.
    const reducedMotion = useReducedMotion();

    // Keep the tab that BECOMES active inside the strip's visible bounds.
    //
    // ONE set of observers per LIST, not one per trigger (#387 perf finding:
    // N triggers used to mean N independent `MutationObserver`s (each
    // watching only its own node) plus N independent `ResizeObserver`s (each
    // ALSO watching this same shared strip) — a resize of a 20-tab strip fired
    // 20 redundant callbacks. Watching the list's subtree in one callback
    // gets the same behaviour for the cost of one.
    //
    // Watching attributes rather than reacting to a render is still
    // load-bearing: Radix flips `data-state` on the trigger it renders, and
    // only ITS OWN context consumer re-renders — this component does not, so
    // a render-driven effect would never observe an activation at all
    // (measured: 8 effect runs for 8 triggers at mount, zero on any later
    // activation). A MutationObserver fires on a genuine inactive → active
    // TRANSITION and never at mount, which is what stops a freshly-mounted
    // Tabs from scrolling anything (#344 shipped a version that scrolled the
    // page 900px on every mount).
    useEffect(() => {
      const node = innerRef.current;
      if (!node) return;

      const scrollActiveIntoView = () => {
        const active = node.querySelector<HTMLElement>(
          '[data-slot="tabs-trigger"][data-state="active"]',
        );
        if (active) scrollTriggerIntoStrip(active, reducedMotion ? "auto" : "smooth");
      };

      const activationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const el = mutation.target as HTMLElement;
          if (el.getAttribute("data-state") === "active") {
            scrollTriggerIntoStrip(el, reducedMotion ? "auto" : "smooth");
            break;
          }
        }
      });
      activationObserver.observe(node, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-state"],
      });

      // A relayout AFTER the scroll invalidates the target it was computed
      // from: a webfont swapping in on a cold load (measured — a
      // mono-everything theme's wider mono face left the last tab 45px
      // outside the strip), or the strip itself being resized. One
      // `ResizeObserver` instance covers both — it watches the strip AND
      // every trigger inside it, not a second instance per trigger.
      let resizeObserver: ResizeObserver | undefined;
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(scrollActiveIntoView);
        resizeObserver.observe(node);
        for (const trigger of node.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]')) {
          resizeObserver.observe(trigger);
        }
      }

      // A dynamic tab list can add/remove triggers later — keep the single
      // `ResizeObserver`'s target set in sync instead of spinning up a new
      // observer per trigger mount.
      const childListObserver = new MutationObserver((mutations) => {
        if (!resizeObserver) return;
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((added) => {
            if (added instanceof HTMLElement && added.matches('[data-slot="tabs-trigger"]')) {
              resizeObserver!.observe(added);
            }
          });
          mutation.removedNodes.forEach((removed) => {
            if (removed instanceof HTMLElement && removed.matches('[data-slot="tabs-trigger"]')) {
              resizeObserver!.unobserve(removed);
            }
          });
        }
      });
      childListObserver.observe(node, { childList: true, subtree: true });

      return () => {
        activationObserver.disconnect();
        resizeObserver?.disconnect();
        childListObserver.disconnect();
      };
    }, [reducedMotion]);

    return (
      // The normalized `explicitVariant` (undefined when unset), not
      // `resolved` — an undefined Provider value is what lets a
      // variant-less `TabsTrigger` also omit its own `data-variant` below.
      <TabsVariantContext.Provider value={explicitVariant}>
        <TabsPrimitive.List
          ref={mergedRef}
          data-slot="tabs-list"
          data-variant={explicitVariant}
          className={cn(tabsListVariants({ variant: resolved }), className)}
          {...props}
        />
      </TabsVariantContext.Provider>
    );
  },
);

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  const variant = use(TabsVariantContext);
  const resolved = variant ?? "segmented";

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(tabsTriggerVariants({ variant: resolved }), className)}
      {...props}
    />
  );
});

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:[--tw-ease:var(--ease-entrance)]",
        className,
      )}
      {...props}
    />
  );
});
