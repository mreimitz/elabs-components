import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { AbstractionControls, type ObjectTypeAbstraction } from "../abstraction-controls";
import type { AbstractionOptions } from "../core/abstract-graph";
import { fromOcel, type OcelEvent, type OcelJson, type OcelObject } from "../core/adapters/ocel";
import {
  abstractObjectCentricGraph,
  discoverObjectCentricGraph,
  objectCentricProcessGraph,
  type ObjectCentricGraph,
} from "../core/discover-object-centric-graph";
import { OCEL_SAMPLE } from "../core/fixtures/ocel-sample";
import { ProcessMap } from "./process-map";

/**
 * A deterministic order-to-delivery OCEL 2.0 log: orders own items, items are picked (and
 * sometimes checked or re-picked) and packed, packages ship and are delivered. `Place
 * Order` is shared by orders and items, `Pack` by all three types, `Ship` by orders and
 * packages — the shapes an object-centric map exists to show.
 */
function orderToDeliveryOcel(orders = 12): OcelJson {
  const objects: OcelObject[] = [];
  const events: OcelEvent[] = [];
  let clock = Date.UTC(2026, 0, 5, 8);
  let eventId = 0;
  const at = (minutes: number) => {
    clock += minutes * 60_000;
    return new Date(clock).toISOString();
  };
  const emit = (type: string, minutes: number, objectIds: string[]) => {
    eventId += 1;
    events.push({
      id: `e${eventId}`,
      type,
      time: at(minutes),
      relationships: objectIds.map((objectId) => ({ objectId })),
    });
  };

  for (let o = 1; o <= orders; o += 1) {
    const order = `o${o}`;
    const items = Array.from({ length: 1 + (o % 3) }, (_, i) => `o${o}-i${i + 1}`);
    const pkg = `o${o}-p1`;
    objects.push({ id: order, type: "order" });
    for (const item of items) objects.push({ id: item, type: "item" });
    objects.push({ id: pkg, type: "package" });

    emit("Place Order", 30, [order, ...items]);
    emit("Confirm Payment", 20, [order]);
    items.forEach((item, index) => {
      emit("Pick Item", 15, [item]);
      if ((o + index) % 3 === 0) emit("Quality Check", 10, [item]);
      if ((o + index) % 5 === 0) {
        emit("Repick", 10, [item]);
        emit("Pick Item", 10, [item]);
      }
    });
    emit("Pack", 25, [order, ...items, pkg]);
    emit("Ship", 60, [order, pkg]);
    emit("Deliver", 240, [pkg]);
    if (o % 2 === 0) emit("Send Invoice", 30, [order]);
  }

  return {
    objectTypes: [{ name: "order" }, { name: "item" }, { name: "package" }],
    objects,
    events,
  };
}

function discover(document: OcelJson, objectTypes?: string[]): ObjectCentricGraph {
  const result = fromOcel(document, objectTypes ? { objectTypes } : undefined);
  if (!result.ok) throw new Error(result.errors.map((error) => error.message).join("; "));
  return discoverObjectCentricGraph(result.logs, { objectTypes: result.objectTypes });
}

const deliveryLog = orderToDeliveryOcel();
const twoTypes = discover(deliveryLog, ["order", "item"]);
const threeTypes = discover(deliveryLog);
const sample = discover(OCEL_SAMPLE);

const metric = { node: "absolute_case", edge: "absolute" } as const;

const meta = {
  title: "Process/ProcessMap/Object-centric",
  component: ProcessMap,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "`ProcessMap`’s object-centric mode (RM-066), fed by `fromOcel` and " +
          "`discoverObjectCentricGraph`. An activity shared by several object types is ONE " +
          "node carrying a chip per type — a chart-token square, the type’s printed " +
          "two-letter code and its object count, named for assistive technology. Edges are " +
          "never merged across types: each type draws its own, side by side, in its own " +
          "colour, and every pill is prefixed with the type’s code, so no type is told " +
          "apart by colour alone.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[36rem] w-full bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProcessMap>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Orders and their items: `Place Order` and `Pack` are shared, picking is item-only. */
export const TwoObjectTypes: Story = {
  args: { objectCentric: twoTypes, metric },
};

/** Orders, items and packages — `Pack` joins all three, `Ship` joins orders and packages. */
export const ThreeObjectTypes: Story = {
  args: { objectCentric: threeTypes, metric },
};

/**
 * The hand-verifiable fixture (`core/fixtures/ocel-sample.ts`): `Pack` is referenced by an
 * order, two items and a package, so its node shows three chips.
 */
export const SharedActivityMerge: Story = {
  args: { objectCentric: sample, metric },
  play: async ({ canvasElement }) => {
    const chips = await waitFor(() => {
      const node = canvasElement.querySelector<HTMLElement>(
        '.react-flow__node[data-id="Pack"] [data-slot="process-activity-node-object-types"]',
      );
      expect(node).not.toBeNull();
      return [...node!.querySelectorAll<HTMLElement>("[data-object-type]")];
    });
    await expect(chips).toHaveLength(3);
    const names = chips.map((chip) => chip.getAttribute("aria-label"));
    await expect(new Set(names).size).toBe(3);
    // Never colour-only: every chip prints its type's code.
    for (const chip of chips) await expect(chip.textContent?.trim()).toMatch(/^\S{2}\s*\d+$/);
  },
};

function PerTypeAbstractionDemo({ graph }: { graph: ObjectCentricGraph }) {
  const [abstraction, setAbstraction] = useState<AbstractionOptions>({ activities: 1, paths: 1 });
  const [perType, setPerType] = useState<Record<string, ObjectTypeAbstraction>>(() =>
    Object.fromEntries(graph.objectTypes.map((type) => [type, { activities: 1, paths: 1 }])),
  );
  const abstracted = useMemo(() => abstractObjectCentricGraph(graph, perType), [graph, perType]);
  const flat = useMemo(() => objectCentricProcessGraph(abstracted), [abstracted]);
  const hidden = Object.values(abstracted.hiddenByType).reduce(
    (sum, entry) => ({
      activities: sum.activities + entry.activities,
      paths: sum.paths + entry.paths,
    }),
    { activities: 0, paths: 0 },
  );
  return (
    <div className="flex size-full gap-4 p-4">
      <AbstractionControls
        className="w-72 shrink-0"
        abstraction={abstraction}
        onAbstractionChange={(next) => setAbstraction((current) => ({ ...current, ...next }))}
        graph={flat}
        hiddenCounts={hidden}
        perType={perType}
        onPerTypeChange={setPerType}
      />
      <div className="min-w-0 flex-1">
        <ProcessMap objectCentric={abstracted} metric={metric} />
      </div>
    </div>
  );
}

/**
 * A global slider pair plus one collapsible, linkable pair per object type. Unlinking
 * `item` and abstracting it on its own thins the item-coloured edges while the order
 * edges stay exactly as they were.
 */
export const PerTypeAbstraction: Story = {
  args: { objectCentric: twoTypes, metric },
  render: () => <PerTypeAbstractionDemo graph={twoTypes} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const count = (type: string) =>
      canvasElement.querySelectorAll(
        `[data-slot="process-transition-edge"][data-object-type="${type}"]`,
      ).length;
    await waitFor(() => expect(count("item")).toBeGreaterThan(0));
    const orderBefore = count("order");
    const itemBefore = count("item");

    await userEvent.click(canvas.getByRole("button", { name: "Link item to the global sliders" }));
    await userEvent.click(canvas.getByRole("button", { name: /^item/, expanded: false }));
    const activities = canvas.getByRole("slider", { name: "item activities" });
    activities.focus();
    await userEvent.keyboard("{Home}");
    const paths = canvas.getByRole("slider", { name: "item paths" });
    paths.focus();
    await userEvent.keyboard("{Home}");

    await waitFor(() => expect(count("item")).toBeLessThan(itemBefore));
    await expect(count("order")).toBe(orderBefore);
  },
};

/** No graph yet — the same whole-region loading panel as the single-case map. */
export const Loading: Story = {
  args: { objectCentric: threeTypes, metric, loading: true },
};

/** A log whose projections carry no events. */
export const Empty: Story = {
  args: { objectCentric: discoverObjectCentricGraph({ order: { events: [] } }), metric },
};
