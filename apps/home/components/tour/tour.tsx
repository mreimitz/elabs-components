"use client";

/**
 * The surface tour (RM-096, movement 2): seven tabs over one frame. Surfaces are registered in
 * `SURFACES` below — each a `next/dynamic` import so its engine enters the page only when its
 * tab is hovered, focused or opened (never on scroll). A tab with no entry renders a labelled
 * Skeleton. `ai-assistant` and `marketing` (RM-098) are `ssr: true` in `tabs.ts`, so they render
 * with a plain static import — no dynamic() — and land in the server HTML.
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
import { AiAssistantSurface } from "./surfaces/ai-assistant";
import { MarketingSurface } from "./surfaces/marketing";
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

// RM-097 — server-rendered surfaces (Dashboard, Data app, Settings). `next/dynamic` still
// code-splits each into its own chunk (kept out of the tour's own bundle until its tab is
// hovered/opened) while leaving `ssr` at its default `true`, so the tab's content is in the
// server HTML the way RM-096's `render: "server"` metadata expects.
const DashboardSurface = dynamic(
  () => import("./surfaces/dashboard").then((m) => m.DashboardSurface),
  { loading: () => <TabSkeleton label={tourCopy.tabs.dashboard.label} /> },
);
const DataAppSurface = dynamic(() => import("./surfaces/data-app").then((m) => m.DataAppSurface), {
  loading: () => <TabSkeleton label={tourCopy.tabs["data-app"].label} />,
});
const SettingsSurface = dynamic(
  () => import("./surfaces/settings").then((m) => m.SettingsSurface),
  { loading: () => <TabSkeleton label={tourCopy.tabs.settings.label} /> },
);

const FLOW_LABEL = tourCopy.tabs["flow-workspace"].label;
const loadFlow = () => import("./surfaces/flow-workspace");
const FlowWorkspaceLazy = dynamic(() => loadFlow().then((m) => m.FlowWorkspaceSurface), {
  ssr: false,
  loading: () => <TabSkeleton label={FLOW_LABEL} />,
});

const PROCESS_LABEL = tourCopy.tabs["process-explorer"].label;
const loadProcess = () => import("./surfaces/process-explorer");
const ProcessExplorerLazy = dynamic(() => loadProcess().then((m) => m.ProcessExplorerSurface), {
  ssr: false,
  loading: () => <TabSkeleton label={PROCESS_LABEL} />,
});

/** Registered surfaces, by tab id. A tab without an entry renders its labelled Skeleton. */
const SURFACES: Partial<Record<TourTabId, { render: () => ReactNode; prefetch?: () => void }>> = {
  "flow-workspace": { render: () => <FlowWorkspaceLazy />, prefetch: () => void loadFlow() },
  // RM-097
  dashboard: {
    render: () => <DashboardSurface />,
    prefetch: () => void import("./surfaces/dashboard"),
  },
  "data-app": {
    render: () => <DataAppSurface />,
    prefetch: () => void import("./surfaces/data-app"),
  },
  settings: {
    render: () => <SettingsSurface />,
    prefetch: () => void import("./surfaces/settings"),
  },

  // RM-098 — flow/process load React Flow only once opened (dynamic import above); ai-assistant
  // and marketing are `ssr: true` (tabs.ts), so they render through a plain static import.
  "ai-assistant": { render: () => <AiAssistantSurface /> },
  "process-explorer": { render: () => <ProcessExplorerLazy />, prefetch: () => void loadProcess() },
  marketing: { render: () => <MarketingSurface /> },
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
