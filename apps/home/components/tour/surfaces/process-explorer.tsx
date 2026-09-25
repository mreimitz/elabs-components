"use client";

/**
 * Process explorer tour surface (RM-098, concept §4.2 "an ops analyst finding why N% of cases
 * take twice as long"). One `useProcessExplorer` instance over `content/fixtures/process-log.ts`
 * (RM-095) drives `ProcessKpiStrip`, `ProcessFilterBar`, `ProcessMap`/`ConformanceOverlay`, the
 * `VariantExplorer` rail and `CaseTable` — the map, the filter chips, the KPI numbers and the
 * variant rail can never disagree about what is in scope (`useProcessExplorer`'s Invariant F).
 * The "12%" in the caption is `PROCESS_LOG_SLOW_VARIANT_SHARE`, read from the fixture, never
 * typed.
 *
 * `@elabs-ai/components-process` and `@xyflow/react` (the map canvas) load only when this tab
 * opens — the dynamic `import()` lives in `tour.tsx`, never here.
 *
 * Deviation (stop-and-report — see the RM-098 result file): the RM's "edges animate once from
 * source to sink on mount" assumes a reveal control on `ProcessMap`/`ConformanceOverlay` that
 * does not exist in `@elabs-ai/components-process` today. Adding one is a package change
 * (wave-2 ruling 6, "package change needed to fit the frame is stop-and-report"), so this
 * surface renders the map without that animation; the gap is filed as a follow-up rather than
 * hand-rolled outside the package.
 *
 * `CaseTable` lives in a bottom `Sheet` (see the result file's height-budget note), matching
 * `docs/playbooks/templates/process-explorer.tsx`'s own drill-down, not always inline: the
 * tour's shared frame (`h-128 md:h-160`, `tour.tsx`) has no room left over once the 6-metric,
 * 2-row `ProcessKpiStrip` claims its share, so the table is a drill-down here too.
 */
import { useMemo, useState } from "react";
import {
  activityColorScale,
  CaseTable,
  casesFromLog,
  ConformanceOverlay,
  ProcessFilterBar,
  ProcessKpiStrip,
  ProcessMap,
  useProcessExplorer,
  VariantExplorer,
} from "@elabs-ai/components-process";
import {
  discoverGraph,
  liftHappyPath,
  tokenReplay,
  type HappyPath,
} from "@elabs-ai/components-process/core";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import {
  PROCESS_LOG,
  PROCESS_LOG_ACTIVITIES,
  PROCESS_LOG_CASE_COUNT,
  PROCESS_LOG_SLOW_VARIANT_SHARE,
} from "../../../content/fixtures/process-log";
import { tourSurfaceCopy } from "../../../content/copy";

/** The 6-step standard trace — the manual-review variant's extra `Credit Check` reads as a real deviation. */
const HAPPY_PATH: HappyPath = {
  id: "order-to-cash-standard",
  label: "Standard order to cash",
  steps: PROCESS_LOG_ACTIVITIES.map((activity) => ({ activity })),
};

// Built once, module scope: the reference log never changes, so neither does its replay.
const CONFORMANCE_GRAPH = discoverGraph(PROCESS_LOG);
const CONFORMANCE_RESULT = tokenReplay(PROCESS_LOG, liftHappyPath(HAPPY_PATH));

const SLOW_SHARE_LABEL = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
}).format(PROCESS_LOG_SLOW_VARIANT_SHARE);

export function ProcessExplorerSurface() {
  const explorer = useProcessExplorer(PROCESS_LOG, { abstraction: { activities: 1, paths: 1 } });
  const [view, setView] = useState<"map" | "conformance">("map");
  const [casesOpen, setCasesOpen] = useState(false);

  // Built ONCE per graph and handed to both the map and the variant rail, so a swatch matches
  // in both views (the map-and-rail colour-match invariant the process-explorer template ships).
  const colorScale = useMemo(() => activityColorScale(explorer.graph), [explorer.graph]);
  const cases = useMemo(() => casesFromLog(explorer.filteredLog), [explorer.filteredLog]);

  // The variant rail emits ids to select; it never filters itself. Keeping at most ONE
  // `"variant"` intent, updated in place, is what keeps "last interaction wins" true.
  function applyVariantSelection(ids: string[], mode: "replace" | "toggle") {
    const activeIndex = explorer.intents.findIndex((intent) => intent.kind === "variant");
    const active = activeIndex >= 0 ? explorer.intents[activeIndex] : undefined;
    const previousIds = active && active.kind === "variant" ? active.ids : [];
    const toggled = ids[0]!;
    const nextIds =
      mode === "replace"
        ? ids
        : previousIds.includes(toggled)
          ? previousIds.filter((id) => id !== toggled)
          : [...previousIds, toggled];
    if (activeIndex >= 0) explorer.clearIntent(activeIndex);
    if (nextIds.length > 0) explorer.applyIntent({ kind: "variant", ids: nextIds });
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-6"
      aria-label={tourSurfaceCopy.processExplorer.demoLabel}
    >
      <p className="text-body text-muted-foreground">
        {tourSurfaceCopy.processExplorer.slowVariantNote(SLOW_SHARE_LABEL)}
      </p>

      <ProcessKpiStrip kpis={explorer.kpis} loading={explorer.loading} />

      <div className="flex items-center gap-3">
        <ProcessFilterBar
          className="min-w-0 flex-1"
          intents={explorer.intents}
          excludedByIntent={explorer.excludedByIntent}
          totalCases={PROCESS_LOG_CASE_COUNT}
          filteredCases={explorer.kpis.cases}
          hiddenCounts={explorer.hiddenCounts}
          onRemove={explorer.clearIntent}
          onClearAll={() => {
            for (let index = explorer.intents.length - 1; index >= 0; index -= 1) {
              explorer.clearIntent(index);
            }
          }}
        />
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(next) => next && setView(next as "map" | "conformance")}
          aria-label={tourSurfaceCopy.processExplorer.viewToggleLabel}
          size="sm"
        >
          <ToggleGroupItem value="map">{tourSurfaceCopy.processExplorer.mapView}</ToggleGroupItem>
          <ToggleGroupItem value="conformance">
            {tourSurfaceCopy.processExplorer.conformanceView}
          </ToggleGroupItem>
        </ToggleGroup>
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {tourSurfaceCopy.processExplorer.casesButton}
          </Button>
        </SheetTrigger>
      </div>

      {/* Narrow screens: the DFG needs real width to read — a note instead of a cramped map. */}
      <p className="text-body text-muted-foreground md:hidden">
        {tourSurfaceCopy.processExplorer.narrow}
      </p>

      <div className="hidden min-h-0 flex-1 md:flex md:gap-3">
        <div className="min-h-0 min-w-0 flex-1">
          {view === "map" ? (
            <ProcessMap
              className="h-full"
              graph={explorer.graph}
              metric={explorer.metric}
              rework={explorer.rework}
              direction="TB"
              selection={explorer.selection}
              onSelect={explorer.onSelect}
              selectionStates={explorer.selectionStates}
              onFilterIntent={explorer.applyIntent}
              colorScale={colorScale}
              loading={explorer.loading}
            />
          ) : (
            <ConformanceOverlay
              className="h-full"
              graph={CONFORMANCE_GRAPH}
              conformance={CONFORMANCE_RESULT}
              direction="TB"
              selection={explorer.selection}
              onSelect={explorer.onSelect}
              onFilterIntent={explorer.applyIntent}
            />
          )}
        </div>
        {/* `min-h-0`: a flex child's default `min-height: auto` would otherwise let its
            content (the virtualized `VariantExplorer` list) grow the rail past the frame
            instead of scrolling inside it. */}
        <div className="flex min-h-0 w-72 shrink-0 flex-col gap-3 overflow-auto">
          <VariantExplorer
            className="flex-1"
            variants={explorer.variants}
            colorScale={colorScale}
            selectionStates={explorer.selectionStates}
            onSelect={applyVariantSelection}
            loading={explorer.loading}
          />
        </div>
      </div>

      <Sheet open={casesOpen} onOpenChange={setCasesOpen}>
        <SheetContent side="bottom" className="flex h-[70vh] max-h-[85dvh] flex-col gap-4">
          <SheetHeader>
            <SheetTitle>{tourSurfaceCopy.processExplorer.casesTitle}</SheetTitle>
            <SheetDescription>{tourSurfaceCopy.processExplorer.casesDescription}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-auto">
            <CaseTable cases={cases} loading={explorer.loading} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
