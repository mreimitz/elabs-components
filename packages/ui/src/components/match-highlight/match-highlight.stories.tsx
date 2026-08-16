import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../button";
import { MatchHighlight, queryToRanges } from "./match-highlight";

const meta = {
  title: "Typography/MatchHighlight",
  component: MatchHighlight,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Wraps query matches inside a string in real `<mark>` elements, styled with the semantic `--highlight` token pair (AA-legible ink in every theme). Presentation-only — pass `query` (case-insensitive by default) or precomputed `ranges` from your own fuzzy matcher.",
      },
    },
  },
  argTypes: {
    text: { control: "text" },
    query: { control: "text" },
    caseSensitive: { control: "boolean" },
    activeIndex: { control: "number" },
  },
} satisfies Meta<typeof MatchHighlight>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { text: "My Notes note", query: "note" },
  render: (args) => (
    <p className="max-w-md text-body text-foreground">
      <MatchHighlight {...args} />
    </p>
  ),
};

/** A search-result title inside a paragraph — the canonical omnisearch use. */
export const InParagraph: Story = {
  render: () => (
    <p className="max-w-md text-body text-foreground">
      The <MatchHighlight text="quarterly revenue report" query="revenue" /> was updated after the{" "}
      <MatchHighlight text="board meeting" query="board" /> concluded.
    </p>
  ),
};

/** Multiple needles (e.g. every token of a multi-word query). */
export const MultipleNeedles: Story = {
  args: { text: "red green blue amber", query: ["red", "blue"] },
  render: (args) => (
    <p className="text-body text-foreground">
      <MatchHighlight {...args} />
    </p>
  ),
};

/** Precomputed ranges from a fuzzy matcher (overlapping/adjacent are merged). */
export const PrecomputedRanges: Story = {
  render: () => (
    <p className="text-body text-foreground">
      <MatchHighlight
        text="src/features/document/backlinks-panel.tsx"
        ranges={[
          [4, 12],
          [13, 21],
        ]}
      />
    </p>
  ),
};

/**
 * `activeIndex` marks ONE of the matches as the current one — the "3 of 12" a
 * find bar or a document citation is pointing at. It is never colour-only: the
 * current mark also carries an outline and `aria-current="true"`, and it can be
 * found for scrolling via `[data-slot="match-highlight-mark"][data-active]`.
 */
export const CurrentMatch: Story = {
  args: {
    text: "Revenue rose in Q1. Revenue fell in Q2. Revenue held flat in Q3.",
    query: "revenue",
    activeIndex: 1,
  },
  render: (args) => (
    <p className="max-w-md text-body text-foreground">
      <MatchHighlight {...args} />
    </p>
  ),
};

/** Stepping through matches — what a find bar drives. */
export const SteppingThroughMatches: Story = {
  args: { text: "", query: "" },
  render: function SteppingThroughMatches() {
    const text =
      "The report notes a delay, the delay was escalated, and the delay is now resolved.";
    const total = queryToRanges(text, "delay").length;
    const [index, setIndex] = useState(0);
    const step = (by: number) => setIndex((i) => (i + by + total) % total);
    return (
      <div className="max-w-md space-y-3">
        <p className="text-body text-foreground">
          <MatchHighlight text={text} query="delay" activeIndex={index} />
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => step(-1)}>
            Previous
          </Button>
          <Button size="sm" variant="outline" onClick={() => step(1)}>
            Next
          </Button>
          <span aria-live="polite" className="text-meta text-muted-foreground">
            {index + 1} of {total}
          </span>
        </div>
      </div>
    );
  },
};

/** No match → the string renders normally (never broken markup). */
export const NoMatch: Story = {
  args: { text: "nothing to highlight here", query: "zzz" },
  render: (args) => (
    <p className="text-body text-foreground">
      <MatchHighlight {...args} />
    </p>
  ),
};

/**
 * Long content truncates cleanly. The flex child needs `min-w-0` for `truncate`
 * to engage (the interaction-guidelines "silent culprit").
 */
export const LongStringTruncation: Story = {
  render: () => (
    <div className="flex w-64 items-center gap-2 rounded-md border border-border bg-card p-2">
      <span className="min-w-0 flex-1 truncate text-body text-foreground">
        <MatchHighlight
          text="A very long document title that will definitely overflow its container and must ellipsis"
          query="document"
        />
      </span>
    </div>
  ),
};
