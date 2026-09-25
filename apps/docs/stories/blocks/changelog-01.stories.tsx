import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Changelog } from "@/components/changelog-01/changelog";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: Changelog,
  title: "Patterns/Blocks/Content/Changelog",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle: "How do I publish release notes people can scan by version?",
      description: {
        component:
          "Versioned release notes down a rail: date, version badge and title per release, changes with a New / Improved / Fixed badge that carries an icon as well as a colour, a “Breaking” callout with a migration link where one applies, and docs links. The filter narrows to major or minor releases; a subscribe row and an RSS link close it.\n\nCopy-own it: `npx shadcn add changelog-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Changelog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Six releases, two of them major with a breaking-change callout. */
export const Default: Story = {};

/** Only the major releases — the ones with a migration note. */
export const MajorOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "Major" }));
    await expect(canvas.getByText("2 releases shown.")).toBeInTheDocument();
    await expect(canvas.getAllByRole("note")).toHaveLength(2);
  },
};

/** Dates in French. */
export const French: Story = { args: { locale: "fr-FR" } };
