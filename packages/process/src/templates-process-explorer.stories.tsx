/**
 * Process explorer template — the canonical full-screen `process-explorer` archetype
 * (RM-057, issue #206): KPI strip on top, a filter bar above the map, the map centred
 * with its accessible table twin, a variant rail on the right, and a case table that
 * opens a single case's timeline in a bottom sheet. This story is the single source of
 * truth: `pnpm gen` derives the consumer template source
 * (`docs/playbooks/templates/process-explorer.tsx`) and the copy-own registry block
 * (`registry/blocks/process-explorer-page/`) from it. One `useProcessExplorer` instance
 * drives every panel, so the map, the filter chips, the KPI numbers and the variant rail
 * can never disagree about what is currently in scope (see `useProcessExplorer`'s own
 * module docblock, Invariant F: filtering re-inks, it never removes).
 * Remember `import "@xyflow/react/dist/style.css"` is wired in Storybook preview.
 * Verify across every theme with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { ArrowLeft, LayoutGrid, ListOrdered, Table2 } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Button,
  Descriptions,
  DescriptionsItem,
  SectionHeader,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SplitPanel,
  StatePanel,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { InspectorPanel } from "@elabs-ai/components-flow";
import type { FlowLayoutDirection } from "@elabs-ai/components-flow";
import { AbstractionControls } from "./abstraction-controls";
import { activityColorScale } from "./core/activity-color-scale";
import { CaseTable, casesFromLog } from "./case-table";
import { CaseTimeline } from "./case-timeline";
import { MetricLayerSwitch } from "./metric-layer-switch";
import { ProcessFilterBar } from "./process-filter-bar";
import { ProcessKpiStrip } from "./process-kpi-strip";
import { ProcessMap, formatDurationMs, processEdgeId } from "./process-map";
import { useProcessExplorer } from "./use-process-explorer";
import { VariantExplorer } from "./variant-explorer";

/**
 * A small order-to-cash log: two cases share the happy path, one is rejected early, one
 * amends and retries a credit check, one ships before it invoices. Four variants over
 * five cases is enough to exercise every panel — the variant rail has more than one row
 * to pick from, the filter bar has something to narrow, and the case table opens into a
 * timeline with real waiting time. Swap this for your own event log; nothing else on
 * this screen depends on its shape beyond `EventRow`'s own contract.
 */
const SAMPLE_LOG = {
  events: [
    { caseId: "case-1", activity: "Create Order", timestamp: "2026-01-05T09:00:00.000Z" },
    { caseId: "case-1", activity: "Check Credit", timestamp: "2026-01-05T10:00:00.000Z" },
    { caseId: "case-1", activity: "Approve Order", timestamp: "2026-01-05T11:00:00.000Z" },
    { caseId: "case-1", activity: "Ship Order", timestamp: "2026-01-05T12:00:00.000Z" },
    { caseId: "case-1", activity: "Send Invoice", timestamp: "2026-01-05T13:00:00.000Z" },
    { caseId: "case-1", activity: "Receive Payment", timestamp: "2026-01-05T14:00:00.000Z" },
    { caseId: "case-2", activity: "Create Order", timestamp: "2026-01-06T09:00:00.000Z" },
    { caseId: "case-2", activity: "Check Credit", timestamp: "2026-01-06T10:00:00.000Z" },
    { caseId: "case-2", activity: "Approve Order", timestamp: "2026-01-06T11:00:00.000Z" },
    { caseId: "case-2", activity: "Ship Order", timestamp: "2026-01-06T12:00:00.000Z" },
    { caseId: "case-2", activity: "Send Invoice", timestamp: "2026-01-06T13:00:00.000Z" },
    { caseId: "case-2", activity: "Receive Payment", timestamp: "2026-01-06T14:00:00.000Z" },
    { caseId: "case-3", activity: "Create Order", timestamp: "2026-01-07T09:00:00.000Z" },
    { caseId: "case-3", activity: "Check Credit", timestamp: "2026-01-07T10:00:00.000Z" },
    { caseId: "case-3", activity: "Reject Order", timestamp: "2026-01-07T11:00:00.000Z" },
    { caseId: "case-4", activity: "Create Order", timestamp: "2026-01-08T09:00:00.000Z" },
    { caseId: "case-4", activity: "Check Credit", timestamp: "2026-01-08T10:00:00.000Z" },
    { caseId: "case-4", activity: "Amend Order", timestamp: "2026-01-08T11:00:00.000Z" },
    { caseId: "case-4", activity: "Check Credit", timestamp: "2026-01-08T12:00:00.000Z" },
    { caseId: "case-4", activity: "Approve Order", timestamp: "2026-01-08T13:00:00.000Z" },
    { caseId: "case-4", activity: "Ship Order", timestamp: "2026-01-08T14:00:00.000Z" },
    { caseId: "case-4", activity: "Send Invoice", timestamp: "2026-01-08T15:00:00.000Z" },
    { caseId: "case-4", activity: "Receive Payment", timestamp: "2026-01-08T16:00:00.000Z" },
    { caseId: "case-5", activity: "Create Order", timestamp: "2026-01-09T09:00:00.000Z" },
    { caseId: "case-5", activity: "Check Credit", timestamp: "2026-01-09T11:00:00.000Z" },
    { caseId: "case-5", activity: "Approve Order", timestamp: "2026-01-09T13:00:00.000Z" },
    { caseId: "case-5", activity: "Send Invoice", timestamp: "2026-01-09T15:00:00.000Z" },
    { caseId: "case-5", activity: "Ship Order", timestamp: "2026-01-09T17:00:00.000Z" },
    { caseId: "case-5", activity: "Receive Payment", timestamp: "2026-01-09T19:00:00.000Z" },
  ],
};

const TOTAL_CASES = new Set(SAMPLE_LOG.events.map((event) => event.caseId)).size;

/**
 * What the inspector shows for the current selection — read off the SAME graph the
 * canvas draws, so the panel and the picture can never disagree.
 */
function SelectionDetail({
  graph,
  selection,
}: {
  graph: ReturnType<typeof useProcessExplorer>["graph"];
  selection: { kind: "activity" | "transition"; id: string } | null;
}) {
  if (!selection) return null;

  if (selection.kind === "activity") {
    const activity = graph.activities.find((candidate) => candidate.id === selection.id);
    if (!activity) return null;
    return (
      <Descriptions>
        <DescriptionsItem label="Cases" numeric>
          {activity.cases.toLocaleString()}
        </DescriptionsItem>
        <DescriptionsItem label="Executions" numeric>
          {activity.instances.toLocaleString()}
        </DescriptionsItem>
        <DescriptionsItem label="Median duration" numeric>
          {formatDurationMs(activity.duration.median)}
        </DescriptionsItem>
        <DescriptionsItem label="Role">
          {activity.isStart ? "Start" : activity.isEnd ? "End" : "Intermediate"}
        </DescriptionsItem>
      </Descriptions>
    );
  }

  const transition = graph.transitions.find(
    (candidate) => processEdgeId(candidate.source, candidate.target) === selection.id,
  );
  if (!transition) return null;
  return (
    <Descriptions>
      <DescriptionsItem label="From">{transition.source}</DescriptionsItem>
      <DescriptionsItem label="To">{transition.target}</DescriptionsItem>
      <DescriptionsItem label="Transitions" numeric>
        {transition.count.toLocaleString()}
      </DescriptionsItem>
      <DescriptionsItem label="Median wait" numeric>
        {formatDurationMs(transition.duration.median)}
      </DescriptionsItem>
    </Descriptions>
  );
}

/** The screen. Everything below is composition — no new primitive is authored here. */
function ProcessExplorerTemplate() {
  const explorer = useProcessExplorer(SAMPLE_LOG, { abstraction: { activities: 1, paths: 1 } });
  const [direction, setDirection] = useState<FlowLayoutDirection>("TB");
  const [view, setView] = useState<"canvas" | "table">("canvas");
  const [casesOpen, setCasesOpen] = useState(false);
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);

  // Built ONCE per graph and handed to both the map and the variant rail, so "Create
  // Order" is the same swatch in both views (RM-054's colour-match acceptance criterion).
  const colorScale = useMemo(() => activityColorScale(explorer.graph), [explorer.graph]);
  const cases = useMemo(() => casesFromLog(explorer.filteredLog), [explorer.filteredLog]);
  const openCaseEvents = useMemo(
    () =>
      openCaseId ? explorer.filteredLog.events.filter((event) => event.caseId === openCaseId) : [],
    [explorer.filteredLog, openCaseId],
  );

  const hasProcess = explorer.graph.activities.length > 0;
  const selectionTitle = explorer.selection?.id;

  // The variant rail emits ids to select and how to apply them — it never filters
  // itself (see `VariantExplorer`'s own docblock). Keeping at most ONE `"variant"`
  // intent in the chain, updated in place, is what keeps "last interaction wins" true
  // (RM-057's own "decisions you own": the map and the rail write to the same
  // `useProcessExplorer` instance, so there is only one intent list to read).
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
    // `min-h-0` on every link of the chain, and `overflow-hidden` at the root: without
    // them a flex child defaults to `min-height: auto` and refuses to shrink below its
    // content, so the canvas — the one region that should absorb the leftover height —
    // is instead the region that pushes the screen taller than its frame.
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-background p-6">
      <SectionHeader
        eyebrow="Order to cash"
        title="Process Explorer"
        description={`Discovered from ${TOTAL_CASES} cases. The map, the filter bar, the KPI strip and the variant rail all read the same useProcessExplorer state, so nothing on this screen can disagree.`}
      />

      <ProcessKpiStrip kpis={explorer.kpis} loading={explorer.loading} />

      <div className="flex items-center gap-3">
        <ProcessFilterBar
          className="min-w-0 flex-1"
          intents={explorer.intents}
          excludedByIntent={explorer.excludedByIntent}
          totalCases={TOTAL_CASES}
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
          onValueChange={(next) => next && setView(next as "canvas" | "table")}
          aria-label="View"
          size="sm"
        >
          <ToggleGroupItem value="canvas" aria-label="Canvas">
            <LayoutGrid aria-hidden="true" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table">
            <Table2 aria-hidden="true" />
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={direction}
          onValueChange={(next) => next && setDirection(next as FlowLayoutDirection)}
          aria-label="Layout direction"
          size="sm"
        >
          <ToggleGroupItem value="TB">Top down</ToggleGroupItem>
          <ToggleGroupItem value="LR">Left to right</ToggleGroupItem>
        </ToggleGroup>
        <Button variant="outline" size="sm" onClick={() => setCasesOpen(true)}>
          <ListOrdered aria-hidden="true" />
          Case table
        </Button>
      </div>

      {hasProcess ? (
        <SplitPanel
          className="min-h-[26rem] flex-1"
          startSize="18rem"
          startTone="muted"
          start={
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
              <MetricLayerSwitch
                layer={explorer.layer}
                onLayerChange={explorer.setLayer}
                metric={explorer.metric}
                onMetricChange={explorer.setMetric}
              />
              <Separator />
              <AbstractionControls
                abstraction={explorer.abstraction}
                onAbstractionChange={explorer.setAbstraction}
                graph={explorer.graph}
                hiddenCounts={explorer.hiddenCounts}
              />
              <Separator />
              <InspectorPanel
                title={selectionTitle ?? "Details"}
                hasSelection={explorer.selection !== null}
                selectionKey={explorer.selection?.id}
                onClose={() => explorer.onSelect(null)}
                emptyMessage="Select an activity or a transition to see its numbers."
              >
                <SelectionDetail graph={explorer.graph} selection={explorer.selection} />
              </InspectorPanel>
            </div>
          }
          end={
            <SplitPanel
              startSize="1fr"
              endTone="muted"
              start={
                <ProcessMap
                  className="h-full"
                  graph={explorer.graph}
                  metric={explorer.metric}
                  rework={explorer.rework}
                  direction={direction}
                  selection={explorer.selection}
                  onSelect={explorer.onSelect}
                  selectionStates={explorer.selectionStates}
                  onFilterIntent={explorer.applyIntent}
                  colorScale={colorScale}
                  tableView={view === "table"}
                  loading={explorer.loading}
                />
              }
              end={
                <div className="flex h-full min-h-0 flex-col gap-2 p-3">
                  <VariantExplorer
                    className="h-full"
                    variants={explorer.variants}
                    colorScale={colorScale}
                    selectionStates={explorer.selectionStates}
                    onSelect={applyVariantSelection}
                    loading={explorer.loading}
                  />
                </div>
              }
              endClassName="w-80 shrink-0"
            />
          }
        />
      ) : (
        <StatePanel
          kind="empty"
          title="No process to show"
          description="This log has no completed cases, so there is no directly-follows relation to discover. Widen the filter or load a different log."
        />
      )}

      {/* Case drill-down: the table opens in a bottom sheet; opening a row swaps the
          sheet's own body to that case's timeline (§2's "drill path is always variant →
          case table → single case", RM-057). */}
      <Sheet
        open={casesOpen}
        onOpenChange={(open) => {
          setCasesOpen(open);
          if (!open) setOpenCaseId(null);
        }}
      >
        <SheetContent side="bottom" className="flex h-[70vh] max-h-[85dvh] flex-col gap-4">
          {openCaseId ? (
            <>
              <SheetHeader>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit"
                  onClick={() => setOpenCaseId(null)}
                >
                  <ArrowLeft aria-hidden="true" />
                  Back to cases
                </Button>
                <SheetTitle>{`Case ${openCaseId}`}</SheetTitle>
                <SheetDescription>
                  Activity durations and waiting time for this case.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-auto">
                <CaseTimeline caseId={openCaseId} events={openCaseEvents} />
              </div>
            </>
          ) : (
            <>
              <SheetHeader>
                <SheetTitle>Cases</SheetTitle>
                <SheetDescription>
                  {`${cases.length} of ${TOTAL_CASES} cases match the current filters.`}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-auto">
                <CaseTable cases={cases} onCaseOpen={setOpenCaseId} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const meta = {
  title: "Patterns/Templates/Process Explorer",
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ProcessExplorerTemplate />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("Process Explorer")).toBeInTheDocument());

    const filterSummary = () =>
      canvasElement.querySelector<HTMLElement>('[data-slot="process-filter-bar-summary"]');
    const kpiStrip = () =>
      canvasElement.querySelector<HTMLElement>('[data-slot="process-kpi-strip"]');

    await waitFor(() => expect(filterSummary()?.textContent ?? "").toMatch(/showing all/i));
    const initialFilterText = filterSummary()!.textContent;
    const initialKpiText = kpiStrip()!.textContent;

    // Select the first (most frequent) variant from the rail — the filter chain and the
    // KPI strip both read the same `useProcessExplorer` state, so both must move.
    const rows = canvasElement.querySelectorAll<HTMLElement>('[data-slot="variant-explorer-row"]');
    expect(rows.length).toBeGreaterThan(0);
    const firstSequence = within(rows[0]!).getByRole("img");
    await userEvent.click(firstSequence);

    await waitFor(() => expect(filterSummary()!.textContent).not.toBe(initialFilterText));
    expect(filterSummary()!.textContent ?? "").not.toMatch(/showing all/i);
    await waitFor(() => expect(kpiStrip()!.textContent).not.toBe(initialKpiText));
  },
};
