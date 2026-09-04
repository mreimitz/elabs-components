import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { seededRnd } from "../../marks/seeded-rnd";
import type { ChartDatapoint } from "../chart-datapoint";
import { NetworkChart, type NetworkDatapointDatum } from "./network-chart";
import type { NetworkLinkDatum, NetworkNodeDatum } from "./network-types";

const meta = {
  title: "Charts/NetworkChart",
  component: NetworkChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A node-link graph in three layouts — circular, a force-settled cloud, or a " +
          "bipartite arc — for arbitrary relationships between entities that carry no " +
          "inherent hierarchy: service dependencies, a social graph, a two-group flow. When " +
          "the relationship really is a hierarchy, `TreeChart` (branching structure) or " +
          "`TreemapChart` (structure sized by a measure) reads faster; see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof NetworkChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ── G6: a small service graph, twelve nodes, three groups ────────────────── */

const serviceNodes: NetworkNodeDatum[] = [
  { id: "gateway", label: "Gateway", value: 12, group: "Edge" },
  { id: "cdn", label: "CDN", value: 6, group: "Edge" },
  { id: "auth", label: "Auth", value: 9, group: "Core" },
  { id: "billing", label: "Billing", value: 7, group: "Core" },
  { id: "search", label: "Search", value: 8, group: "Core" },
  { id: "catalog", label: "Catalog", value: 10, group: "Core" },
  { id: "orders", label: "Orders", value: 11, group: "Core" },
  { id: "postgres", label: "Postgres", value: 14, group: "Data" },
  { id: "redis", label: "Redis", value: 5, group: "Data" },
  { id: "s3", label: "Object store", value: 4, group: "Data" },
  { id: "queue", label: "Queue", value: 6, group: "Data" },
  { id: "warehouse", label: "Warehouse", value: 3, group: "Data" },
];

const serviceLinks: NetworkLinkDatum[] = [
  { source: "cdn", target: "gateway" },
  { source: "gateway", target: "auth" },
  { source: "gateway", target: "search" },
  { source: "gateway", target: "catalog" },
  { source: "gateway", target: "orders" },
  { source: "auth", target: "postgres" },
  { source: "auth", target: "redis" },
  { source: "billing", target: "orders" },
  { source: "billing", target: "postgres" },
  { source: "search", target: "catalog" },
  { source: "search", target: "redis" },
  { source: "catalog", target: "postgres" },
  { source: "catalog", target: "s3" },
  { source: "orders", target: "postgres" },
  { source: "orders", target: "queue" },
  { source: "queue", target: "warehouse" },
];

/**
 * **G6 — the small ring.** Twelve nodes, every one labelled, chords bundled
 * toward the centre so a dense middle still reads. The ring is the right answer
 * under ~15 nodes: position carries no meaning, so nothing is lost by fixing it,
 * and the eye gets a stable place to look each node up.
 */
export const SmallCircular: Story = {
  args: {
    layout: "circular",
    nodes: serviceNodes,
    links: serviceLinks,
    accessibleDescription:
      "Twelve services in three groups — Edge, Core and Data — arranged on a ring, with sixteen dependencies drawn as chords.",
  },
  render: (args) => (
    <div className="h-[440px] w-[720px]">
      <NetworkChart {...args} />
    </div>
  ),
};

/**
 * **G11 — the small force cloud.** The same graph, laid out by attraction and
 * repulsion instead of by decree: clusters that talk to each other end up
 * together, and the Data tier falls out on its own.
 *
 * The simulation does NOT tick. It is solved to a fixed 300-tick budget from a
 * seeded start before React sees a coordinate, so the picture is identical on
 * every render, in every process — and nothing moves under
 * `prefers-reduced-motion`.
 */
export const SmallForce: Story = {
  args: {
    layout: "force",
    nodes: serviceNodes,
    links: serviceLinks,
    accessibleDescription:
      "The same twelve services, positioned by a settled force layout: the Data tier separates from the Edge tier.",
  },
  render: (args) => (
    <div className="h-[440px] w-[720px]">
      <NetworkChart {...args} />
    </div>
  ),
};

/* ── B1: sixty nodes, labels above a threshold, adjacency blur ────────────── */

const TEAMS = ["Platform", "Product", "Data", "Growth", "Security"];

/** Sixty contributors across five teams; deterministic, so the picture never moves. */
const contributors: NetworkNodeDatum[] = Array.from({ length: 60 }, (_, i) => ({
  id: `c${i}`,
  label: `Person ${i + 1}`,
  group: TEAMS[i % TEAMS.length],
  value: Math.round(2 + seededRnd(i, 41) * 28),
}));

const collaborations: NetworkLinkDatum[] = Array.from({ length: 140 }, (_, i) => {
  const source = Math.floor(seededRnd(i, 61) * 60);
  // Two thirds of the ties stay inside a team (a step of 5 keeps the group),
  // the rest cross it — which is what makes the ring's chords worth drawing.
  const step = seededRnd(i, 62) < 0.66 ? 5 * (1 + Math.floor(seededRnd(i, 63) * 4)) : 1;
  return { source: `c${source}`, target: `c${(source + step) % 60}`, value: 1 };
}).filter((link) => link.source !== link.target);

/**
 * **B1 — the big ring.** Sixty nodes is past the point where every label fits,
 * so `labelThreshold` names only the people worth naming; the rest stay dots.
 * Hover or focus any node: it and its neighbours stay lit and everything else
 * blurs, which is the only way a 140-chord ring answers "who does this one work
 * with".
 *
 * The blur is a CSS class on each `<g>`, driven by ONE piece of state — no node
 * re-renders on hover, which is what keeps it at 60 fps here and at 180 nodes.
 */
export const BigCircular: Story = {
  args: {
    layout: "circular",
    nodes: contributors,
    links: collaborations,
    labelThreshold: 24,
    aspectRatio: "1 / 1",
    accessibleDescription:
      "Sixty contributors on a ring, five teams by colour, 140 collaborations as chords. Only contributors with 24 or more contributions are labelled.",
  },
  render: (args) => (
    <div className="h-[620px] w-[620px]">
      <NetworkChart {...args} />
    </div>
  ),
};

/**
 * **B2 — the big force cloud.** 180 nodes, hubs and satellites. The whole layout
 * is solved synchronously in well under the 500 ms budget, and it is the SAME
 * layout every time.
 */
export const BigForce: Story = {
  args: {
    layout: "force",
    nodes: Array.from({ length: 180 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i + 1}`,
      group: TEAMS[i % TEAMS.length],
    })),
    // Every node hangs off one of six hubs, plus a sparse mesh between them.
    links: Array.from({ length: 180 }, (_, i) => ({
      source: `n${i}`,
      target: `n${i % 6}`,
    }))
      .filter((link) => link.source !== link.target)
      .concat(
        Array.from({ length: 90 }, (_, i) => ({
          source: `n${6 + Math.floor(seededRnd(i, 71) * 174)}`,
          target: `n${6 + Math.floor(seededRnd(i, 72) * 174)}`,
        })).filter((link) => link.source !== link.target),
      ),
    labelThreshold: 12,
    accessibleDescription:
      "180 nodes hanging off six hubs, laid out by a settled force simulation. Only the hubs are labelled.",
  },
  render: (args) => (
    <div className="h-[560px] w-[860px]">
      <NetworkChart {...args} />
    </div>
  ),
};

/* ── L12: bipartite ownership ─────────────────────────────────────────────── */

const ownershipNodes: NetworkNodeDatum[] = [
  { id: "core", label: "Core Platform", group: "Team" },
  { id: "growth", label: "Growth", group: "Team" },
  { id: "data-team", label: "Data", group: "Team" },
  { id: "billing-svc", label: "Billing", group: "Service" },
  { id: "auth-svc", label: "Auth", group: "Service" },
  { id: "search-svc", label: "Search", group: "Service" },
  { id: "onboarding-svc", label: "Onboarding", group: "Service" },
  { id: "pricing-svc", label: "Pricing", group: "Service" },
  { id: "warehouse-svc", label: "Warehouse", group: "Service" },
  { id: "events-svc", label: "Events", group: "Service" },
];

const ownershipLinks: NetworkLinkDatum[] = [
  { source: "core", target: "billing-svc" },
  { source: "core", target: "auth-svc" },
  { source: "core", target: "search-svc" },
  { source: "growth", target: "onboarding-svc" },
  { source: "growth", target: "pricing-svc" },
  { source: "growth", target: "search-svc" },
  { source: "data-team", target: "warehouse-svc" },
  { source: "data-team", target: "events-svc" },
  { source: "data-team", target: "billing-svc" },
];

/**
 * **L12 — the ownership colonnade.** Two columns, hairline béziers, and no node
 * `value` at all: with nothing to size by, a node's radius follows its DEGREE,
 * so a team that owns five services reads as a hub without anyone computing a
 * number for it.
 *
 * The split is derived, not declared — exactly two groups puts one on each side;
 * failing that, the nodes that are only ever a link's `source` go left.
 */
export const Ownership: Story = {
  args: {
    layout: "arc",
    nodes: ownershipNodes,
    links: ownershipLinks,
    accessibleDescription:
      "Three teams on the left, seven services on the right, joined by the services each team owns.",
  },
  render: (args) => (
    <div className="h-[440px] w-[720px]">
      <NetworkChart {...args} />
    </div>
  ),
};

/**
 * **Drag (force only).** Pull a node aside to look under a cluster; it springs
 * back to its settled position on release, because the settled layout IS the
 * answer and a dragged position would be a lie about the data.
 *
 * Dragging is a pointer affordance. The keyboard path is unchanged and still
 * complete: one tab stop into the chart, arrows across every node.
 */
export const Draggable: Story = {
  args: {
    layout: "force",
    nodes: serviceNodes,
    links: serviceLinks,
    draggable: true,
    accessibleDescription: "Twelve services, force-laid-out; nodes can be dragged and spring back.",
  },
  render: (args) => (
    <div className="h-[440px] w-[720px]">
      <NetworkChart {...args} />
    </div>
  ),
};

/* ── #349: the keyboard drill-down path ───────────────────────────────────── */

function InteractiveDemo() {
  const [selected, setSelected] = useState<ChartDatapoint<NetworkDatapointDatum> | null>(null);
  return (
    <div className="flex w-[720px] flex-col gap-3">
      <div className="h-[440px]">
        <NetworkChart
          accessibleLabel="Service dependencies"
          layout="circular"
          links={serviceLinks}
          nodes={serviceNodes}
          onDatapointClick={(point) => setSelected(point)}
        />
      </div>
      <output
        className="rounded-md border border-border bg-card px-3 py-2 text-body text-card-foreground"
        data-testid="drill-detail"
      >
        {selected
          ? `${selected.datum.label ?? selected.datum.id} — ${selected.datum.degree} links, ${selected.datum.group}`
          : "Tab into the chart, arrow to a node, press Enter."}
      </output>
    </div>
  );
}

/**
 * Every node is a keyboard datapoint target — a real `<button>` in a
 * `pointer-events: none` layer BESIDE the `aria-hidden` SVG, never inside it.
 * The target's own accessible name carries the node's degree, so the answer a
 * sighted user reads in the tooltip reaches a screen-reader user too.
 */
export const KeyboardDrilldown: Story = {
  args: { layout: "circular", nodes: serviceNodes, links: serviceLinks },
  render: () => <InteractiveDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const gateway = await waitFor(() => canvas.getByRole("button", { name: /^Gateway,/ }));
    // Degree is in the NAME, not only the tooltip: Gateway has five links.
    await expect(gateway).toHaveAccessibleName("Gateway, Edge, value 12, 5 links");

    // One tab stop for the whole chart — the rest is roving tabindex.
    const tabbable = canvas
      .getAllByRole("button")
      .filter((button) => button.getAttribute("tabindex") === "0");
    await expect(tabbable).toHaveLength(1);

    // Activated from the KEYBOARD, deliberately: the layer is
    // `pointer-events: none`, so a pointer click falls through to the SVG and
    // the targets exist for keyboard and screen-reader users alone.
    gateway.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(canvas.getByTestId("drill-detail")).toHaveTextContent("Gateway — 5 links, Edge");
    });
  },
};
