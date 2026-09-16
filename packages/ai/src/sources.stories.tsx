import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "vitest";
import { Source, SourceList, Sources, SourcesContent, SourcesTrigger } from "./sources";
const meta = {
  title: "AI/Sources",
  component: Sources,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Sources>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Sources>
      <SourcesTrigger count={2} />
      <SourcesContent>
        <Source href="https://docs.acme.com" title="Acme Docs" />
        <Source href="https://ci.acme.com" title="CI run #42" />
      </SourcesContent>
    </Sources>
  ),
};
// SourceList — the per-answer grounding footer preset (#191, research 11 §B.4).
export const GroundingFooter: Story = {
  name: "SourceList",
  render: () => (
    <SourceList
      defaultOpen
      sources={[
        { href: "https://warehouse.acme.com/q3-retention", title: "Q3 retention cohort" },
        { href: "https://crm.acme.com/renewals", title: "Renewal desk log" },
        { href: "https://docs.acme.com/churn", title: "Churn playbook" },
      ]}
    />
  ),
};

/**
 * Focus indicator: Tab to the trigger and assert a real box-shadow exists,
 * mirroring the library's compound indicator (not the browser default).
 */
export const FocusIndicator: Story = {
  name: "Focus indicator (#313)",
  render: () => (
    <Sources>
      <SourcesTrigger count={2} />
      <SourcesContent>
        <Source href="https://docs.acme.com" title="Acme Docs" />
        <Source href="https://ci.acme.com" title="CI run #42" />
      </SourcesContent>
    </Sources>
  ),
  play: async ({ canvas, userEvent }) => {
    // Find the trigger button inside the Collapsible component
    const trigger = canvas.getByRole("button");

    // Tab rather than .focus(): `:focus-visible` is what `focus-ring` keys
    // on, and a programmatic focus does not reliably match it.
    await userEvent.tab();
    await expect(trigger).toHaveFocus();

    const focused = getComputedStyle(trigger);
    await expect(focused.boxShadow).not.toBe("none");
  },
};
