import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupedParts } from "./grouped-parts";
import { groupPartByType, type GroupablePart } from "./part-groups";

const meta = {
  title: "AI/GroupedParts",
  component: GroupedParts,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof GroupedParts>;
export default meta;
type Story = StoryObj<typeof meta>;

// A representative ordered part list, the shape an AI SDK UIMessage exposes.
const parts: GroupablePart[] = [
  {
    type: "reasoning",
    state: "done",
    text: "The user wants Q3 revenue by region. I'll query the warehouse and reconcile.",
  },
  {
    type: "tool-query_warehouse",
    state: "output-available",
    input: { sql: "select region, sum(amount) from sales group by region" },
    output: { rows: 4 },
  },
  {
    type: "tool-reconcile",
    state: "output-available",
    input: { source: "ledger" },
    output: { reconciled: 8 },
  },
  { type: "text", text: "Q3 revenue totalled $4.2M across 4 regions — EMEA led at $1.8M." },
];

/** Default — the reasoning + tool run folds into one collapsible trace; the
 *  final answer stays a top-level leaf. */
export const Default: Story = {
  args: { parts },
};

/** Streaming — a tool is still running, so the trace rolls up to "running" and
 *  opens automatically. */
export const Streaming: Story = {
  args: {
    parts: [
      { type: "reasoning", state: "streaming", text: "Deciding which tables to join…" },
      { type: "tool-query_warehouse", state: "input-available", input: { sql: "select …" } },
    ],
  },
};

/** Interaction cards never fold — an approval-style part is forced standalone,
 *  splitting the trace around it. */
export const StandaloneInteraction: Story = {
  args: {
    parts: [
      { type: "reasoning", state: "done", text: "This will delete 12 records." },
      { type: "approval-request", state: "approval-requested" },
      { type: "reasoning", state: "done", text: "Approved — proceeding." },
      { type: "text", text: "Done — 12 records removed." },
    ],
    children: ({ part, isGroup, children }) =>
      isGroup ? (
        <>{children}</>
      ) : part.type === "approval-request" ? (
        <div className="rounded-md border border-border-strong border-s-4 border-s-border-strong bg-card p-3 text-body">
          <p className="font-medium text-foreground">Approve deletion of 12 records?</p>
        </div>
      ) : part.type === "text" ? (
        <p className="text-body text-foreground">
          {String((part as { text?: string }).text ?? "")}
        </p>
      ) : undefined,
  },
};

/** Custom grouping — group everything into a single trace via a custom groupBy. */
export const CustomGrouping: Story = {
  args: {
    parts,
    groupBy: groupPartByType<GroupablePart>({
      groupKey: "group-analysis",
      inline: [/^reasoning$/, /^tool-/, "text"],
    }),
  },
};

/** Empty — an empty part list renders nothing (no broken UI). */
export const Empty: Story = {
  args: { parts: [] },
};

/** Dark theme — trace disclosure + tool cards in dark. */
export const DarkTheme: Story = {
  args: { parts },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};
