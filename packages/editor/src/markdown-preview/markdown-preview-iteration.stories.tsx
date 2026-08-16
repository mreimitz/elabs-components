import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { MarkdownPreview } from "./markdown-preview";
import type { IterationData, IterationSpec } from "../markdown-iteration";

const meta = {
  title: "Editor/MarkdownPreview/Iteration",
  component: MarkdownPreview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "`:::iterate` / `:::pivot` repeat a per-cell markdown TEMPLATE (the directive body) " +
          "over consumer-resolved data. `evaluateIteration(spec)` returns the data (the app owns " +
          "the source); `interpolate(template, ctx)` fills each cell (a minimal `{{path}}` default " +
          "is provided). Layouts: `stacked` (vertical), `grid` + `matrix` (a `@elabs-ai/components-ui` Table). " +
          "Cells render through a nested, depth-capped `MarkdownPreview`.",
      },
    },
  },
} satisfies Meta<typeof MarkdownPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/* A small in-app data source (would be a query / binding in a real app). */
const TEAM = [
  { name: "Ada Lovelace", role: "Engineering", commits: 128 },
  { name: "Grace Hopper", role: "Compilers", commits: 211 },
  { name: "Alan Turing", role: "Theory", commits: 97 },
];

const REVENUE: Record<string, Record<string, number>> = {
  Q1: { EU: 120, US: 240 },
  Q2: { EU: 150, US: 265 },
};

const evaluateIteration = (spec: IterationSpec): IterationData | null => {
  if (spec.kind === "pivot") {
    const rowHeaders = Object.keys(REVENUE);
    const colHeaders = ["EU", "US"];
    return {
      rowHeaders,
      colHeaders,
      cells: rowHeaders.flatMap((r) =>
        colHeaders.map((c) => ({ row: r, col: c, context: { amount: REVENUE[r]?.[c] ?? 0 } })),
      ),
    };
  }
  return {
    columns: ["Member"],
    cells: TEAM.map((m) => ({ context: m, key: m.name })),
  };
};

export const Stacked: Story = {
  args: {
    evaluateIteration,
    children: `# Team

:::iterate{as="m" layout="stacked"}
:::card{title="{{m.name}}"}
**{{m.role}}** · {{m.commits}} commits
:::
:::`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Ada Lovelace", {}, { timeout: 8000 })).toBeVisible();
    await expect(canvas.getByText("Grace Hopper")).toBeVisible();
  },
};

export const Grid: Story = {
  args: {
    evaluateIteration,
    children: `# Team grid

:::iterate{as="m" layout="grid"}
**{{m.name}}** — {{m.role}}
:::`,
  },
};

export const Bento: Story = {
  args: {
    evaluateIteration,
    children: `# Team bento

:::iterate{as="m" layout="bento"}
**{{m.name}}**

{{m.role}}
:::`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Ada Lovelace", {}, { timeout: 8000 })).toBeVisible();
    await expect(canvas.getByText("Alan Turing")).toBeVisible();
  },
};

/**
 * A nested `:::card` (with content AFTER it) inside an `:::iterate` cell. Authored
 * with a FOUR-colon outer fence (`::::iterate … ::::`) so the inner `:::card`'s
 * close can't terminate the outer block — the card renders as a real component and
 * the trailing line survives. The guided builder emits this fence automatically.
 */
export const NestedCard: Story = {
  name: "Nested :::card (+ trailing)",
  args: {
    evaluateIteration,
    children: `::::iterate{as="m" layout="stacked"}
:::card{title="{{m.name}}"}
**{{m.role}}** · {{m.commits}} commits
:::

Reviewed {{m.name}}.
::::`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Ada Lovelace", {}, { timeout: 8000 })).toBeVisible();
    // The trailing line after the nested card survives (the fence-collision fix).
    await expect(canvas.getByText("Reviewed Ada Lovelace.")).toBeVisible();
    await expect(canvas.getByText("Reviewed Grace Hopper.")).toBeVisible();
  },
};

export const Pivot: Story = {
  name: "Pivot (matrix)",
  args: {
    evaluateIteration,
    children: `# Revenue by quarter × region

:::pivot
**\${{amount}}**M
:::`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("columnheader", { name: "EU" }, { timeout: 8000 }),
    ).toBeVisible();
    await expect(canvas.getByRole("rowheader", { name: "Q1" })).toBeVisible();
  },
};

/**
 * Nested iteration: an outer per-member repeat whose template contains an inner
 * `:::iterate` over that member's data. The outer pass leaves the inner tokens
 * literal; the inner pass (one level deeper, depth-capped) resolves them.
 */
export const Nested: Story = {
  args: {
    evaluateIteration: (spec: IterationSpec): IterationData | null => {
      if (spec.source === "skills") {
        const skills = (spec.attributes.of ?? "").split(",").filter(Boolean);
        return { cells: skills.map((s) => ({ context: { skill: s.trim() }, key: s })) };
      }
      return {
        cells: [
          { context: { name: "Ada", of: "Math, Engines, Notes" }, key: "Ada" },
          { context: { name: "Grace", of: "Compilers, Teaching" }, key: "Grace" },
        ],
      };
    },
    children: `:::iterate{as="person"}
### {{person.name}}

:::iterate{source="skills" of="{{person.of}}"}
- {{skill}}
:::
:::`,
  },
};

export const EmptyState: Story = {
  name: "Empty (no data)",
  args: {
    evaluateIteration: () => ({ cells: [] }),
    children: `:::iterate{as="m"}\n{{m.name}}\n:::`,
  },
};
