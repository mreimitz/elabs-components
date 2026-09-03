import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { ChangeReview, type ChangeHunk, type DiffLine } from "@elabs-ai/components-ui";
import { DiffView } from "./diff-view";

const meta = {
  title: "AI/DiffView",
  component: DiffView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The READ-ONLY patch renderer. Pick a diff surface by what the human is allowed " +
          "to do with the change: reading lines of a patch → `AI/DiffView` " +
          "(`@elabs-ai/components-ai`); accepting or rejecting per hunk → " +
          "`AI/ChangeReview` (`@elabs-ai/components-ui`); editing both sides, side by " +
          "side → `Editor/DiffEditor` (`@elabs-ai/components-editor`); reading a " +
          "patch in a console transcript → `Terminal/TerminalDiffHunk` " +
          "(`@elabs-ai/components-terminal`). See " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "This view renders a `DiffLine[]` someone else computed — it never diffs, " +
          "fetches or parses a patch itself. To put those lines behind an approve/reject " +
          "gate, the app that depends on both packages injects one into the other: pass a " +
          "`<DiffView>` through `ChangeReview`’s `renderHunk` render-prop or a " +
          "hunk’s `after` slot, as the *Composed into ChangeReview (ui)* story below " +
          "does. That seam is ratified, not unfinished — `ChangeHunk` gains no " +
          "`lines` field and `DiffLine` never moves, because `@elabs-ai/components-ui` " +
          "may not import `@elabs-ai/components-ai` and this view needs Shiki.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DiffView>;
export default meta;
type Story = StoryObj<typeof meta>;

// A representative mix of every DiffLineType — meta headers, a hunk range, a
// deletion, two additions and trailing context (#102 acceptance criteria).
const SAMPLE_LINES: DiffLine[] = [
  { type: "meta", text: "diff --git a/src/math.ts b/src/math.ts" },
  { type: "meta", text: "index a1b2c3d..e4f5g6h 100644" },
  { type: "meta", text: "--- a/src/math.ts" },
  { type: "meta", text: "+++ b/src/math.ts" },
  { type: "hunk", text: "@@ -1,5 +1,6 @@" },
  {
    type: "context",
    oldNumber: 1,
    newNumber: 1,
    text: "export function add(a: number, b: number) {",
  },
  { type: "del", oldNumber: 2, text: "  return a - b; // bug: subtracts instead of adds" },
  { type: "add", newNumber: 2, text: "  return a + b;" },
  { type: "add", newNumber: 3, text: "  // fixed the sign error" },
  { type: "context", oldNumber: 3, newNumber: 4, text: "}" },
  { type: "context", oldNumber: 4, newNumber: 5, text: "" },
  { type: "context", oldNumber: 5, newNumber: 6, text: "export const VERSION = 2;" },
];

export const Default: Story = {
  render: () => (
    <div className="max-w-2xl">
      <DiffView
        lines={SAMPLE_LINES}
        file="src/math.ts"
        stats={{ additions: 2, deletions: 1 }}
        language="typescript"
      />
    </div>
  ),
};

// Dark theme — the row tints (`bg-success/10` / `bg-destructive/10`), the
// marker/gutter tokens and the Shiki-derived syntax colour must all resolve
// from the SCOPED dark region, not the document root (same pattern as
// `code-block.stories.tsx`'s `DarkTheme`).
export const DarkTheme: Story = {
  render: () => (
    <div className="max-w-2xl" data-theme="dark">
      <div className="rounded-lg bg-background p-6 text-foreground">
        <DiffView lines={SAMPLE_LINES} file="src/math.ts" stats={{ additions: 2, deletions: 1 }} />
      </div>
    </div>
  ),
};

// variant="split" — two aligned columns (old-file view | new-file view).
export const SplitVariant: Story = {
  name: 'variant="split"',
  render: () => (
    <div className="max-w-3xl">
      <DiffView lines={SAMPLE_LINES} file="src/math.ts" variant="split" />
    </div>
  ),
};

// pager — absorbs the upstream CodexDiff shape: scroll-position indicator, a
// key legend, and a named `role="region"`.
const LONG_LINES: DiffLine[] = Array.from({ length: 60 }, (_, i) => ({
  type: i % 11 === 0 ? "del" : i % 13 === 0 ? "add" : "context",
  oldNumber: i % 13 === 0 ? undefined : i + 1,
  newNumber: i % 11 === 0 ? undefined : i + 1,
  text: `line ${i + 1} of a long file`,
})) as DiffLine[];

export const Pager: Story = {
  name: "pager",
  render: () => (
    <div className="max-w-2xl">
      <DiffView lines={LONG_LINES} file="src/very-long-file.ts" pager />
    </div>
  ),
};

// contextLines — a long run of unchanged lines collapses behind a "show more"
// control that restores it on click.
const CONTEXT_RUN_LINES: DiffLine[] = [
  { type: "hunk", text: "@@ -1,12 +1,13 @@" },
  ...Array.from({ length: 10 }, (_, i) => ({
    type: "context" as const,
    oldNumber: i + 1,
    newNumber: i + 1,
    text: `unchanged line ${i + 1}`,
  })),
  { type: "add", newNumber: 11, text: "// a single new line at the end" },
];

export const CollapsedContext: Story = {
  name: "contextLines",
  render: () => (
    <div className="max-w-2xl">
      <DiffView lines={CONTEXT_RUN_LINES} contextLines={4} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const showMore = await canvas.findByRole("button", { name: /more line/ });
    await expect(canvas.queryByText("unchanged line 5")).not.toBeInTheDocument();
    await userEvent.click(showMore);
    await expect(canvas.getByText("unchanged line 5")).toBeInTheDocument();
  },
};

// LOADING — no renderable diff yet (loading-states.md). Layout-shaped
// skeleton rows at the real row height; no layout shift once `lines` settles.
export const Loading: Story = {
  render: () => (
    <div className="max-w-2xl">
      <DiffView lines={[]} loading file="src/math.ts" />
    </div>
  ),
};

// STREAMING — lines are still arriving (loading-states.md `isStreaming`). What
// exists renders as-is, including a syntactically incomplete final line, and
// no error surface appears.
export const Streaming: Story = {
  name: "isStreaming",
  render: () => (
    <div className="max-w-2xl">
      <DiffView
        lines={[
          { type: "context", oldNumber: 1, newNumber: 1, text: "export function add(a, b) {" },
          { type: "add", newNumber: 2, text: "  return a + b" },
        ]}
        isStreaming
      />
    </div>
  ),
};

// ─── ChangeReview composition (binding decision — architecture § 3) ────────
//
// DiffView (ai) and ChangeReview (ui) never import each other. The app, which
// depends on both, wires them together through ChangeReview's existing
// injection seams — here, the `renderHunk` render-prop seam. `ChangeHunk`
// gains no `lines` field; `DiffLine` never moves into `ui`.
const REVIEW_HUNK_LINES: Record<string, DiffLine[]> = {
  "hunk-1": SAMPLE_LINES.filter((l) => l.type !== "meta"),
};

const REVIEW_HUNKS: ChangeHunk[] = [{ id: "hunk-1", title: "src/math.ts", status: "modified" }];

export const ChangeReviewComposition: Story = {
  name: "Composed into ChangeReview (ui)",
  render: () => (
    <div className="max-w-2xl">
      <ChangeReview
        hunks={REVIEW_HUNKS}
        renderHunk={(hunk) => (
          <DiffView lines={REVIEW_HUNK_LINES[hunk.id] ?? []} variant="inline" />
        )}
      />
    </div>
  ),
};
