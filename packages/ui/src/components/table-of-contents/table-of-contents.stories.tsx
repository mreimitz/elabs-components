import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { TableOfContents, type TableOfContentsItem } from "./table-of-contents";
import { Heading, Text } from "../typography";

const ITEMS: TableOfContentsItem[] = [
  { id: "toc-problem", label: "The problem" },
  { id: "toc-approach", label: "What we built" },
  { id: "toc-model", label: "The model", level: 2 },
  { id: "toc-rollout", label: "The rollout", level: 2 },
  { id: "toc-numbers", label: "What the numbers did" },
  { id: "toc-next", label: "What’s next" },
];

const FILLER =
  "Every ocean carrier sends an estimated arrival with the booking. It is updated, on average, 1.8 times over a 30-day voyage. The second update usually lands after the vessel has already anchored outside the port.";

function Article({ offset = 96 }: { offset?: number }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-6 py-8 md:grid-cols-4">
      <div className="flex min-w-0 flex-col gap-10 md:col-span-3">
        {ITEMS.map((item, i) => (
          <section
            aria-labelledby={`${item.id}-title`}
            className="flex flex-col gap-3"
            id={item.id}
            key={item.id}
            style={{ scrollMarginTop: offset }}
          >
            <Heading id={`${item.id}-title`} level={item.level === 2 ? 3 : 2}>
              {item.label}
            </Heading>
            {Array.from({ length: i % 2 === 0 ? 4 : 2 }, (_, p) => (
              <Text className="max-w-prose" key={p} tone="muted">
                {FILLER}
              </Text>
            ))}
          </section>
        ))}
      </div>
      <TableOfContents className="md:sticky md:top-6 md:self-start" items={ITEMS} offset={offset} />
    </div>
  );
}

const meta = {
  title: "Navigation/TableOfContents",
  component: TableOfContents,
  parameters: { layout: "fullscreen" },
  args: { items: ITEMS },
} satisfies Meta<typeof TableOfContents>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Follows the scroll position; click a link and the accent slides, the page scrolls, focus lands on the section. */
export const Default: Story = {
  render: () => <Article />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvas.getByRole("navigation", { name: "On this page" });
    await waitFor(() =>
      expect(within(nav).getByRole("link", { name: "The problem" })).toHaveAttribute(
        "aria-current",
        "location",
      ),
    );
    await userEvent.click(within(nav).getByRole("link", { name: "What the numbers did" }));
    await expect(within(nav).getByRole("link", { name: "What the numbers did" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await waitFor(() => expect(canvasElement.querySelector("#toc-numbers")).toHaveFocus());
  },
};

/** `activeId` controlled by the owner — no scroll-spy, the marker simply follows the prop. */
export const Controlled: Story = {
  render: function ControlledStory() {
    const [active, setActive] = useState("toc-approach");
    return (
      <div className="flex gap-10 p-6">
        <TableOfContents activeId={active} items={ITEMS} onActiveChange={setActive} />
        <Text tone="muted">
          Current: <code className="text-code">{active}</code>
        </Text>
      </div>
    );
  },
};

/** `title={null}` drops the eyebrow (the landmark keeps its name); `scroll="native"` leaves the anchors to the browser. */
export const Bare: Story = {
  render: () => (
    <div className="p-6">
      <TableOfContents activeId="toc-model" items={ITEMS} scroll="native" title={null} />
    </div>
  ),
};
