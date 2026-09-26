import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FileText, GitMerge, MessageSquareText } from "lucide-react";
import { UserProfile } from "@/components/user-profile-01/user-profile";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: UserProfile,
  title: "Patterns/Blocks/Account and Settings/User Profile",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Who is this person and what have they done here?",
      description: {
        component:
          "A public profile page: a token-painted cover, the avatar, the facts a colleague looks for first and Follow / Message that work. Four stat tiles in tabular figures, then three tabs — an overview with the bio, skills and a 26-week contribution heat strip (colour plus a count on every cell and a legend), recent activity as a `Timeline`, and projects as a card grid with a written status on each. Every list is a prop.\n\nCopy-own it: `npx shadcn add user-profile-01`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof UserProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The strip is the charts package's calendar heatmap: one real cell per
    // day, a figure with a spoken total and a legend — not a hand-painted grid.
    const figure = await canvas.findByRole("figure", {
      name: /contributions in the last 26 weeks, one cell per day/,
    });
    await waitFor(() =>
      expect(figure.querySelectorAll('[data-slot="heatmap-cell"]')).toHaveLength(26 * 7),
    );
    await expect(figure.querySelector('[data-slot="heatmap-legend"]')).toBeInTheDocument();
    // Follow / Message work.
    await userEvent.click(canvas.getByRole("button", { name: "Follow" }));
    await expect(canvas.getByRole("button", { name: "Following" })).toBeInTheDocument();
  },
};

/** The viewer already follows this person: the button reads “Following” and toggles back. */
export const AlreadyFollowing: Story = { args: { defaultFollowing: true } };

/** A new colleague: a short bio, a handful of events, one project and a mostly empty strip. */
export const NewMember: Story = {
  args: {
    person: {
      name: "Tomás Herrera",
      handle: "tomas",
      role: "Product designer",
      team: "Payments",
      location: "Lisbon, Portugal",
      joined: "2026-08-03",
      about:
        "Joined in August from a fintech in Porto. Currently learning the settlement flows and redrawing the refund screens.",
      skills: ["Figma", "Design systems", "Prototyping"],
    },
    stats: [
      { label: "Projects", value: 1 },
      { label: "Followers", value: 18 },
      { label: "Following", value: 42 },
      { label: "Contributions", value: 37 },
    ],
    contributions: Array.from({ length: 26 * 7 }, (_, i) =>
      i < 26 * 7 - 50 ? 0 : (i * 31) % 7 === 0 ? 3 : (i * 31) % 3 === 0 ? 1 : 0,
    ),
    events: [
      {
        id: "1",
        icon: FileText,
        title: "Published “Refund flow, round 2” for review",
        description: "12 screens · 3 open comments",
        at: "2026-09-24T10:15:00Z",
      },
      {
        id: "2",
        icon: MessageSquareText,
        title: "Commented on “Chargeback evidence upload”",
        at: "2026-09-22T16:02:00Z",
      },
      {
        id: "3",
        icon: GitMerge,
        title: "Merged “Icon set: refunds and disputes”",
        description: "atlas/design-tokens · reviewed by Priya",
        at: "2026-09-12T13:48:00Z",
      },
    ],
    projects: [
      {
        id: "refunds",
        name: "Refund flow, round 2",
        summary: "Fewer steps, the reason first, and a receipt the customer can forward.",
        tone: 2,
        stars: 9,
        status: "draft",
        updated: "2026-09-24",
      },
    ],
  },
};
