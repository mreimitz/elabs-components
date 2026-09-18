"use client";

/**
 * The surface tour (RM-096, movement 2): seven tabs over one frame. Surfaces are registered in
 * `SURFACES` below — each a `next/dynamic` import so its engine enters the page only when its
 * tab is hovered, focused or opened (never on scroll). Until RM-097 / RM-098 register the real
 * surfaces, a tab renders a labelled Skeleton; the flow tab already loads a small React Flow
 * canvas so the lazy path (prefetch on hover, chunk on click) is exercised end to end.
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  Skeleton,
  SurfaceTour,
  SurfaceTourActions,
  type SurfaceTourTab,
} from "@elabs-ai/components-ui";
import { tourCopy } from "../../content/copy";
import type { TourTabId, TourTabMeta } from "./tabs";

/** A frame-filling Skeleton in the rough shape of a screen, named for screen readers. */
function TabSkeleton({ label }: { label: string }) {
  return (
    <div className="flex size-full flex-col gap-4 p-6">
      <span className="sr-only">{tourCopy.placeholder(label)}</span>
      <Skeleton className="h-8 w-1/3" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="min-h-40 flex-1" />
    </div>
  );
}

const FLOW_LABEL = tourCopy.tabs["flow-workspace"].label;
const loadFlow = () => import("@elabs-ai/components-flow");
const FlowPreview = dynamic(
  () =>
    loadFlow().then(({ CanvasShell }) => {
      function FlowPreview() {
        return (
          <div className="size-full min-h-96">
            <CanvasShell
              aria-label={FLOW_LABEL}
              fitView
              nodes={[
                { id: "a", position: { x: 0, y: 0 }, data: { label: "Source" } },
                { id: "b", position: { x: 220, y: 80 }, data: { label: "Transform" } },
                { id: "c", position: { x: 440, y: 0 }, data: { label: "Sink" } },
              ]}
              edges={[
                { id: "a-b", source: "a", target: "b" },
                { id: "b-c", source: "b", target: "c" },
              ]}
            />
          </div>
        );
      }
      return FlowPreview;
    }),
  { ssr: false, loading: () => <TabSkeleton label={FLOW_LABEL} /> },
);

/** Registered surfaces, by tab id. A tab without an entry renders its labelled Skeleton. */
const SURFACES: Partial<Record<TourTabId, { render: () => ReactNode; prefetch?: () => void }>> = {
  "flow-workspace": { render: () => <FlowPreview />, prefetch: () => void loadFlow() },
  // RM-097

  // RM-098
};

const STICKY_TOP = "calc(var(--spacing) * var(--header-size))";

/** `meta` is `TOUR_TABS` from `./tabs`, resolved on the server so story-ids.json stays out of the client bundle. */
export function Tour({ meta: tabMeta }: { meta: TourTabMeta[] }) {
  const ref = useRef<HTMLElement>(null);

  // Scroll choreography (§5a 2): once the tour HEADER has entered (its top in the upper three
  // quarters of the viewport, or scrolled past), `<html data-past-hero>` lets the hero scene dim.
  // Observing the header, not the section: at 1440×900 the section's top edge is already on
  // screen at load, which would dim the hero before anyone scrolled.
  useEffect(() => {
    const header = ref.current?.querySelector('[data-slot="surface-tour-header"]');
    const root = document.documentElement;
    if (!header || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        root.toggleAttribute(
          "data-past-hero",
          entry.isIntersecting || entry.boundingClientRect.top < 0,
        );
      },
      { rootMargin: "0px 0px -25% 0px" },
    );
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.removeAttribute("data-past-hero");
    };
  }, []);

  const tabs: SurfaceTourTab[] = tabMeta.map((meta) => {
    const surface = SURFACES[meta.id];
    return {
      id: meta.id,
      label: meta.label,
      useCase: meta.useCase,
      hint: meta.hint ?? undefined,
      render: surface?.render ?? (() => <TabSkeleton label={meta.label} />),
      prefetch: surface?.prefetch,
      fallback: <TabSkeleton label={meta.label} />,
      actions: (
        <SurfaceTourActions
          storybookHref={meta.storybookHref}
          prompt={meta.prompt}
          command={meta.scaffold ?? undefined}
          labels={tourCopy.actions}
        />
      ),
    };
  });

  return (
    <SurfaceTour
      ref={ref}
      id="tour"
      hashKey="tour"
      tabs={tabs}
      defaultTab="dashboard"
      title={tourCopy.title}
      description={tourCopy.description}
      frameClassName="h-128 md:h-160"
      className="mx-auto max-w-7xl px-6 py-16"
      style={
        {
          "--surface-tour-sticky-top": STICKY_TOP,
          scrollMarginTop: STICKY_TOP,
        } as CSSProperties
      }
    />
  );
}
