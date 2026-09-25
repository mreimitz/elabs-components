import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Careers } from "@/components/careers-01/careers";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: Careers,
  title: "Patterns/Blocks/Content/Careers",
  parameters: {
    layout: "fullscreen",
    docs: {
      subtitle:
        "How do I list open roles with filters that work and an empty state that keeps the candidate?",
      description: {
        component:
          "Open roles under three reasons to join: team and location selects plus a remote switch narrow the list, roles are grouped by team as rows with location, type, a “New” badge and an apply link, and the count is announced. When nothing matches, an empty state asks for an email and offers to clear the filters.\n\nCopy-own it: `npx shadcn add careers-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Careers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Eleven roles across five teams. */
export const Default: Story = {};

/** The remote switch and the location select narrow the list; the count follows. */
export const RemoteInOslo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("switch", { name: "Remote only" }));
    await expect(canvas.getByText("8 roles shown of 11.")).toBeVisible();
  },
};

/** No role matches — the empty state takes an email instead of losing the candidate. */
export const NothingMatches: Story = {
  args: {
    roles: [
      {
        id: "eng-sre",
        title: "Site Reliability Engineer",
        team: "Engineering",
        location: "Singapore",
        remote: false,
        type: "Full-time",
        opened: "2026-08-20",
        href: "#/careers/eng-sre",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("switch", { name: "Remote only" }));
    // The empty panel fades in, so wait for the entrance animation to settle.
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "No roles match" })).toBeVisible(),
    );
  },
};
