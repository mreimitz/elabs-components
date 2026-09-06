import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../button";
import { SectionHeader } from "./section-header";

const meta = {
  title: "Layout/SectionHeader",
  component: SectionHeader,
  tags: ["autodocs"],
} satisfies Meta<typeof SectionHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    eyebrow: "Workspace",
    title: "Projects",
    description: "Everything your team is working on.",
    actions: <Button size="sm">New project</Button>,
  },
};

/**
 * `as` picks the heading LEVEL, never the size — the title renders at
 * `text-title` for every value. Reach for `as="h1"` when this header titles the
 * page itself; a screen whose highest heading is an `<h2>` has no document
 * outline root at all (WCAG 1.3.1).
 */
export const PageTitle: Story = {
  args: {
    eyebrow: "Workspace",
    as: "h1",
    title: "Projects",
    description: "The page’s own title, so it owns the h1.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Resolve BY ROLE AND LEVEL: `getByText` would find the same node whatever
    // tag it rendered as, so it could not tell an <h1> from the <h2> default.
    const h1 = canvas.getByRole("heading", { level: 1, name: "Projects" });
    await expect(h1.tagName).toBe("H1");
    // The visual is unchanged by the level — that is the whole point of the
    // prop, and the reason nobody should reach for it to get a bigger title.
    await expect(h1.classList.contains("text-title")).toBe(true);
  },
};

/** The default is still `<h2>`, so every existing caller is untouched. */
export const DefaultLevelIsH2: Story = {
  args: { title: "Projects" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const heading = canvas.getByRole("heading", { name: "Projects" });
    await expect(heading.tagName).toBe("H2");
    await expect(canvas.queryByRole("heading", { level: 1 })).toBeNull();
  },
};
