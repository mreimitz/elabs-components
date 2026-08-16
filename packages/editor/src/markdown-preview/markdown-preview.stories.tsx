import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pin } from "lucide-react";
import { expect, within } from "storybook/test";
import { MarkdownPreview } from "./markdown-preview";

const meta = {
  title: "Editor/MarkdownPreview",
  component: MarkdownPreview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Renders markdown to REAL @brand components (Streamdown + a branded components " +
          "map): `#` → Heading, link → Link, table → Table, `---` → Separator, and the brand " +
          "directives `:::card` / `:::callout` / `::metric` / `:::timeline` → Card / Alert / " +
          "MetricBlock / Timeline. Uses the SAME shared remark pipeline as the Milkdown editor. " +
          "Unknown directives render an explicit error block instead of disappearing.",
      },
    },
  },
} satisfies Meta<typeof MarkdownPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

const DOC = `---
title: Migration Plan
status: review
---

# Migration Plan

Move the reporting estate to the new platform. **Scope is frozen.**

:::callout{type="warning" title="Missing component"}
This section needs a component that does not exist yet — track it as a gap.
:::

::metric{label="Migration scope" value="1,245" description="frozen report candidates" delta="+12%"}

:::card{title="Customer objective"}
Consolidate 9 legacy dashboards into a single governed app.
:::

## Timeline

:::timeline
- (done) Draft
- (active) Review
- (pending) Publish
:::

| Phase  | Owner  |
| ------ | ------ |
| Draft  | Manuel |
| Review | Team   |
`;

export const BrandDialect: Story = {
  args: { children: DOC },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Migration Plan" }, { timeout: 8000 }),
    ).toBeVisible();
    await expect(canvas.getByText("Customer objective")).toBeVisible();
    await expect(canvas.getByText("frozen report candidates")).toBeVisible();
  },
};

export const UnknownBlock: Story = {
  name: "Unknown directive → error",
  args: { children: `:::diagram\nnot mapped yet\n:::` },
};

/**
 * `headingActions` — hover affordances beside each heading (the workbench
 * uses it to pin sections as snippet favorites). The slot is revealed on
 * heading hover/focus and stays visible while it contains a pressed toggle.
 */
export const HeadingActions: Story = {
  args: {
    children: `# Migration Plan\n\nIntro paragraph.\n\n## Timeline\n\nPhase one starts in June.`,
    headingActions: (h) => (
      <button
        type="button"
        aria-label={`Pin section “${h.text}”`}
        aria-pressed={h.text === "Timeline"}
        className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Pin className="size-3.5" aria-hidden="true" />
      </button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Pin section “Timeline”" }, { timeout: 8000 }),
    ).toBeInTheDocument();
    // The pressed pin stays visible without hover (working-memory grammar).
    await expect(canvas.getByRole("button", { name: "Pin section “Timeline”" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
