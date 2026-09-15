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
 */
export const tabsListVariants = cva(
  "max-w-full items-center overflow-x-auto text-muted-foreground",
  {
    variants: {
      variant: {
        // Recessed pill track with a raised active segment.
        segmented: "inline-flex h-9 justify-center-safe rounded-lg bg-muted p-1",
        // Line tabs: a transparent start-aligned row over a 1px rule; the active
        // tab's 2px underline sits on top of it (see `tabsTriggerVariants`).
        underline: "flex w-full justify-start border-b border-rule",
      },
    },
    defaultVariants: { variant: "segmented" },
  },
);

export const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-control transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        segmented: cn(
          "rounded-control px-3 py-1",
          // `ring-offset-1`, not `-2`: the compound indicator's reach is
          // `ring-offset` + 2px ring + 1px contour, and `TabsList` is an
          // `overflow-x-auto` strip with `p-1` (4px). At offset 2 the reach is 5px
          // and the scroll box clips the contour on three sides (#67 fix round 2,
          // measured on `patterns-templates-object-detail-hub--default` tab stop
          // 9); at offset 1 it is exactly 4px and the loop closes.
          "focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "data-[state=active]:bg-surface-elevated data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        ),
        underline: cn(
          // The underline is a bottom BORDER inside the fixed height, transparent
          // at rest, so activation never shifts layout. No negative margin to
          // overlap the list's rule: the list scrolls (`overflow-x-auto`), which
          // would clip anything hanging past its padding box. The strip has no
          // padding for an outer ring either, so the indicator is drawn inset.
          "h-12 rounded-none border-b-2 border-transparent px-4 hover:text-foreground",
          "focus-ring-inset",
          "data-[state=active]:border-primary data-[state=active]:text-foreground",
        ),
      },
    },
    defaultVariants: { variant: "segmented" },
  },
);

export type TabsVariant = NonNullable<VariantProps<typeof tabsListVariants>["variant"]>;

// The list owns the variant; its triggers read it, so a strip never mixes two.
const TabsVariantContext = createContext<TabsVariant>("segmented");

export interface TabsListProps
  extends
    ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  function TabsList({ className, variant, ...props }, ref) {
    const resolved = variant ?? "segmented";
    return (
      <TabsVariantContext.Provider value={resolved}>
        <TabsPrimitive.List
          ref={ref}
          data-slot="tabs-list"
          data-variant={resolved}
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
  const innerRef = useRef<HTMLButtonElement>(null);
  const mergedRef = useMemo(() => mergeRefs(ref, innerRef), [ref]);
  // Honours the in-app tri-state motion preference on `ThemeProvider` as well
  // as the OS setting, and degrades to OS-only outside a provider.
  const reducedMotion = useReducedMotion();

  // Keep the tab that BECOMES active inside the strip's visible bounds.
  //
  // Watching the attribute rather than reacting to a render is load-bearing on
  // both counts:
  //  - Radix flips `data-state` on the trigger it renders INSIDE this wrapper,
  //    and only its own context consumer re-renders — this component does not.
  //    A render-driven effect therefore never observes an activation at all
  //    (measured: 8 effect runs for 8 triggers at mount, zero on any later
  //    activation), so the scroll only ever ran when the CONSUMER's own state
  //    changed.
  //  - A MutationObserver fires on a genuine inactive → active TRANSITION and
  //    never at mount, which is what stops a freshly-mounted Tabs from
  //    scrolling anything (#344 shipped a version that scrolled the page 900px
  //    on every mount).
  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;

    const scrollIfActive = () => {
      if (node.getAttribute("data-state") !== "active") return;
      scrollTriggerIntoStrip(node, reducedMotion ? "auto" : "smooth");
    };

    const observer = new MutationObserver(scrollIfActive);
    observer.observe(node, { attributes: true, attributeFilter: ["data-state"] });

    // A relayout AFTER the scroll invalidates the target it was computed from:
    // a webfont swapping in on a cold load (measured — a mono-everything theme's
    // wider mono face left the last tab 45px outside the strip), or the strip
    // being resized. Re-measure whenever the tab or the strip changes size;
    // the delta check makes every unaffected pass a no-op.
    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(scrollIfActive) : undefined;
    resizeObserver?.observe(node);
    const strip = node.closest<HTMLElement>('[role="tablist"]');
    if (strip) resizeObserver?.observe(strip);

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
    };
  }, [reducedMotion]);

  return (
    <TabsPrimitive.Trigger
      ref={mergedRef}
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
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
