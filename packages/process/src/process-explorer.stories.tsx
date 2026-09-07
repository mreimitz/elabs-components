/**
 * Process Explorer — the flagship screen of `@elabs-ai/components-process` (RM-057).
 *
 * ## Intent
 *
 * An analyst opens this to answer one question: *where does this process actually go
 * wrong?* They should leave knowing the dominant path, which steps repeat or stall, and
 * be one click from interrogating any of it — without ever leaving the screen.
 *
 * ## Why it is a story and not a component
 *
 * Every part of it already ships: `ProcessKpiStrip`, `MetricLayerSwitch`,
 * `AbstractionControls` and `ProcessMap` are the package's exported views, and
 * `useProcessExplorer` is the state machine that keeps them agreeing with each other. The
 * screen is the ARRANGEMENT of those parts, and an arrangement is exactly what
 * `docs/DECISIONS.md` §D4 says to copy-own rather than import: a team building a
 * process-mining app wants this file's 200 lines in their repo, editable, not a
 * `<ProcessExplorer>` whose layout they cannot reach. So this is the reference screen —
 * read it, copy it, change it.
 *
 * ## Anatomy
 *
 * Three bands, top to bottom, and one rail:
 *
 * 1. **Header + KPI strip** — the reading a stakeholder needs before any interaction.
 * 2. **`ViewToolbar`** — the repo's one-row grammar for "what am I looking at / what can I
 *    do about it" (`Docs/View Toolbar Contract`). Active filters are `FilterChip`s here,
 *    not a bespoke pill row, and the case count is a `ResultCount` so "142 of 240" reads
 *    the same as it does on every table in the system.
 * 3. **Rail + canvas** — a `SplitPanel` with the two dials and the inspector on the
 *    recessed side, the map on the plain one. The dials sit BESIDE the canvas rather than
 *    floating over it because they are read as often as they are used.
 *
 * Selecting an activity or a transition fills the inspector; nothing is ever removed from
 * the canvas by a filter, only dimmed, so the reader can always click an excluded element
 * to bring it back (Invariant F — see `useProcessExplorer`).
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  Button,
  Descriptions,
  DescriptionsItem,
  FilterChip,
  ResultCount,
  SectionHeader,
  Separator,
  SplitPanel,
  StatePanel,
  ToggleGroup,
  ToggleGroupItem,
  ViewToolbar,
  ViewToolbarFilters,
} from "@elabs-ai/components-ui";
import { InspectorPanel } from "@elabs-ai/components-flow";
import type { FlowLayoutDirection } from "@elabs-ai/components-flow";
import { generateBpi2012Subset } from "./core/fixtures/generate-bpi-2012-subset";
import type { EventLog } from "./core/types";
import { AbstractionControls } from "./abstraction-controls";
import { MetricLayerSwitch } from "./metric-layer-switch";
import { ProcessKpiStrip } from "./process-kpi-strip";
import { ProcessMap, formatDurationMs, processEdgeId } from "./process-map";
import type { FilterIntent } from "./use-process-explorer";
import { useProcessExplorer } from "./use-process-explorer";

const log = generateBpi2012Subset({ cases: 240, seed: 1 });

/** A log with no events — the shape a too-narrow filter or an empty extract leaves behind. */
const emptyLog: EventLog = { events: [] };

/**
 * A filter intent as a sentence fragment.
 *
 * `FilterChip`'s contract is label-in-value text (`"Status: Failed"`, never a bare
 * `"Failed"`), because a chip has to read on its own in a screen reader's list of
 * controls. An intent is a discriminated union, so this is a `switch`, not a lookup.
 */
function intentLabel(intent: FilterIntent): string {
  switch (intent.kind) {
    case "with":
      return `Includes: ${intent.activity}`;
    case "without":
      return `Excludes: ${intent.activity}`;
    case "startsWith":
      return `Starts with: ${intent.activity}`;
    case "endsWith":
      return `Ends with: ${intent.activity}`;
    case "follower":
      return `${intent.direct ? "Directly follows" : "Eventually follows"}: ${intent.a} → ${intent.b}`;
    case "variant":
      return `Variants: ${intent.ids.length}`;
    default:
      return "Filter";
  }
}

/**
 * What the inspector shows for the current selection.
 *
 * Read off the SAME graph the canvas draws, so the panel and the picture can never
 * disagree — the numbers are one derivation, presented twice.
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
      <DescriptionsItem label="Cases" numeric>
        {transition.caseCount.toLocaleString()}
      </DescriptionsItem>
      <DescriptionsItem label="Median wait" numeric>
        {formatDurationMs(transition.duration.median)}
      </DescriptionsItem>
    </Descriptions>
  );
}

/** The screen. Everything below is composition — no new primitive is authored here. */
function ProcessExplorer({ eventLog = log }: { eventLog?: EventLog }) {
  // Opening BELOW 100% is the product-correct default, not a legibility workaround — the
  // map handles legibility itself now, by refusing to open below a readable zoom. A
  // directly-follows graph discovered at FULL detail is the "spaghetti model" every
  // process-mining tool warns about, and every one of them (Disco, ProM, Celonis) opens
  // its sliders short of 100% for exactly that reason: the screen should open on the
  // readable core of the process, not on all 24 activities plus every rare path. The
  // analyst raises the dials to see the long tail, and the "N activities hidden" line
  // under them keeps what is missing stated rather than silent.
  const explorer = useProcessExplorer(eventLog, {
    abstraction: { activities: 0.55, paths: 0.4 },
  });
  const [direction, setDirection] = useState<FlowLayoutDirection>("TB");
  const [view, setView] = useState<"canvas" | "table">("canvas");

  // The UNFILTERED case count, so `ResultCount` can honestly read "142 of 240". The
  // explorer's own `kpis.cases` is the filtered figure — the other half of that sentence.
  const totalCases = useMemo(
    () => new Set(eventLog.events.map((event) => event.caseId)).size,
    [eventLog],
  );
  const selectionTitle = explorer.selection
    ? explorer.selection.kind === "activity"
      ? explorer.selection.id
      : explorer.selection.id.replace(" → ", " → ")
    : undefined;

  const hasProcess = explorer.graph.activities.length > 0;

  const trends = useMemo(() => ({}), []);

  return (
    // `min-h-0` on every link of the chain, and `overflow-hidden` at the root: without
    // them a flex child defaults to `min-height: auto` and refuses to shrink below its
    // content, so the canvas — the one region that should absorb the leftover height —
    // is instead the region that pushes the screen taller than its frame.
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-background p-6">
      <SectionHeader
        eyebrow="Order to cash"
        title="Process Explorer"
        description={`Discovered from ${totalCases.toLocaleString()} cases of the BPI-2012 loan-application log. Every number on this screen comes from one derivation, so the canvas and the tables cannot disagree.`}
      />

      <ProcessKpiStrip kpis={explorer.kpis} trends={trends} loading={explorer.loading} />

      <ViewToolbar
        info="Activities are sized by how many cases reach them; arrows are weighted by how often the handover happens. Click an activity to inspect it, or filter from its menu."
        actions={
          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={direction}
              onValueChange={(next) => next && setDirection(next as FlowLayoutDirection)}
              aria-label="Layout direction"
              size="sm"
            >
              <ToggleGroupItem value="TB">Top&nbsp;down</ToggleGroupItem>
              <ToggleGroupItem value="LR">Left&nbsp;to&nbsp;right</ToggleGroupItem>
            </ToggleGroup>
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
          </div>
        }
      >
        {explorer.intents.length > 0 ? (
          <ViewToolbarFilters
            onClearAll={() => {
              for (let index = explorer.intents.length - 1; index >= 0; index -= 1) {
                explorer.clearIntent(index);
              }
            }}
          >
            {explorer.intents.map((intent, index) => (
              <FilterChip
                key={`${intent.kind}-${index}`}
                label={intentLabel(intent)}
                onRemove={() => explorer.clearIntent(index)}
              />
            ))}
          </ViewToolbarFilters>
        ) : null}
        <ResultCount count={explorer.kpis.cases} total={totalCases} />
      </ViewToolbar>

      {hasProcess ? (
        <SplitPanel
          // The canvas is the screen's subject, so it takes every pixel the bands above
          // do not need — and never less than this floor, below which a process map stops
          // being readable at all and the reader is better served by the table twin.
          className="min-h-[26rem] flex-1"
          // 24rem, not less: the metric row puts two `Select`s and the lock side by side,
          // and below this width the default values truncate to a stem ("Occurren…") that
          // names nothing. The longest labels ("90th percentile duration") still truncate
          // — that is what the trigger's own `title` tooltip is for — but the values a
          // reader meets on arrival are whole. The rail is read as much as it is used.
          startSize="24rem"
          startTone="recessed"
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
              tableView={view === "table"}
              loading={explorer.loading}
            />
          }
        />
      ) : (
        <StatePanel
          kind="empty"
          title="No process to show"
          description="This log has no completed cases, so there is no directly-follows relation to discover. Widen the filter or load a different log."
          actions={<Button variant="outline">Load a sample log</Button>}
        />
      )}
    </div>
  );
}

const meta = {
  title: "Process/ProcessExplorer",
  component: ProcessExplorer,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The flagship screen of `@elabs-ai/components-process`, the repo's one layer-3 " +
          "package (ADR 0034): KPI strip, filter row, metric and abstraction dials, " +
          "inspector and process map, all driven by a single `useProcessExplorer` state " +
          "machine so no two panels can disagree about what is being shown. Every part is " +
          "an exported view of this package or a primitive from " +
          "`@elabs-ai/components-ui`/`-flow`/`-charts`/`-data` — the screen authors no " +
          "edge, mark, table or control of its own, which is the binding rule for this " +
          "package. Copy this file as the starting point for a process-mining app rather " +
          "than importing it: the value here is the arrangement, and an arrangement you " +
          "cannot edit is the wrong abstraction (`docs/DECISIONS.md` §D4).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[52rem] w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProcessExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The screen as an analyst first sees it: nothing filtered, frequency on both channels. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The reading a stakeholder needs is present before any interaction.
    await waitFor(() => expect(canvas.getByText("Process Explorer")).toBeInTheDocument());
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="process-activity-node"]').length),
    );

    // Selecting an activity fills the inspector — the panel reads the same graph the
    // canvas draws, so this also proves the two are wired to one model.
    const nodes = canvasElement.querySelectorAll<HTMLElement>(
      '[data-slot="process-activity-node"]',
    );
    expect(nodes.length).toBeGreaterThan(1);
    await userEvent.click(nodes[0]!);
    await waitFor(() => expect(canvas.getByText("Median duration")).toBeInTheDocument());

    // The table twin renders the identical numbers, so the screen is readable without
    // reading a picture.
    await userEvent.click(canvas.getByRole("radio", { name: "Table" }));
    await waitFor(() => expect(canvas.getByRole("table", { name: /Activities/ })).toBeVisible());
  },
};

/**
 * The empty state, designed with the happy path rather than retrofitted: a log whose
 * cases were all filtered away has nothing to discover, and says so with a way out.
 */
export const NoProcess: Story = {
  args: { eventLog: emptyLog },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByText("No process to show")).toBeInTheDocument());
    expect(canvas.getByRole("button", { name: "Load a sample log" })).toBeInTheDocument();
  },
};
