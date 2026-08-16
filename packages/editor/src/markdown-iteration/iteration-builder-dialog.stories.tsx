import { Button } from "@elabs/components-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { IterationBuilderDialog } from "./iteration-builder-dialog";
import type { IterationBuilderValue } from "./iteration-builder";
import type { EvaluateCalc } from "../calc-block";

// A minimal stand-in calc engine for the story (the app brings its own): every
// non-empty line resolves to a fixed value, enough to show a ```calc cell
// RESOLVING into a CalcBlock inside the pivot rather than showing raw text.
const evaluateCalc: EvaluateCalc = (source) => ({
  results: source
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((_, i) => ({
      line: i + 1,
      tokens: [],
      value: { kind: "number" as const, raw: 42, display: "42" },
    })),
});

/**
 * Room between a focused child's border box and its scroll-container ancestor's
 * SCROLLPORT — see `packages/ui/src/components/dialog/dialog-focus-ring-clearance.stories.tsx`
 * for the full derivation. Reused here (not imported — `@elabs/components-editor`
 * doesn't depend on `@elabs/components-ui`'s story files) to confirm #425's fix
 * reaches this dialog now that its scroll region is a real `DialogBody`.
 */
const room = (child: HTMLElement, box: HTMLElement) => {
  const c = child.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const l = b.left + box.clientLeft;
  const t = b.top + box.clientTop;
  return {
    left: c.left - l,
    right: l + box.clientWidth - c.right,
    top: c.top - t,
    bottom: t + box.clientHeight - c.bottom,
  };
};

const meta = {
  title: "Editor/Iteration/BuilderDialog",
  component: IterationBuilderDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The #223 GUIDED builder (A5) — collects the DATA (value list(s) + bind name + layout) " +
          "as well as the per-cell template, shows a LIVE populated preview, and writes a " +
          "fully-bound `:::iterate` / `:::pivot` directive whose value lists live in its " +
          "attributes (rendered by the built-in `evaluateEmbedded`). Wire the node-view `⋯` " +
          "re-edit to it with `IterationBuilderProvider` for a lossless round-trip.",
      },
    },
  },
} satisfies Meta<typeof IterationBuilderDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const PIVOT_SEED: IterationBuilderValue = {
  kind: "pivot",
  as: "item",
  layout: "matrix",
  values: ["Q1", "Q2", "Q3"],
  cols: ["North", "South"],
  template: "{{row}} · {{col}}",
};

/**
 * Pivot: two value lists → a populated matrix in the live preview. Opening this
 * (the `⋯` re-edit scenario, seeded via `value`) shows the matrix filling in from
 * the embedded row/column lists with no consumer data engine.
 */
export const PivotBuilder: Story = {
  args: { open: false, onOpenChange: () => {}, onSave: () => {} },
  render: function PivotBuilderStory() {
    const [open, setOpen] = useState(false);
    const [saved, setSaved] = useState<string | null>(null);
    return (
      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setOpen(true)}>Edit pivot…</Button>
        {saved ? (
          <pre className="max-w-md rounded-md bg-surface-muted p-3 text-caption">{saved}</pre>
        ) : null}
        <IterationBuilderDialog
          open={open}
          onOpenChange={setOpen}
          value={PIVOT_SEED}
          onSave={setSaved}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Edit pivot/i }));
    const dialog = await within(document.body).findByRole("dialog", {}, { timeout: 12000 });
    const d = within(dialog);
    // Each value string renders TWICE — once as a TagInput chip in the left
    // column, once in the live preview — so scope queries to the preview region
    // (the confirming pattern from PivotWithCalc / WithNestedCard below).
    const preview = within(
      await d.findByRole("region", { name: /live preview/i }, { timeout: 8000 }),
    );
    // The live preview renders a populated matrix from the embedded value lists:
    // axis headers + an interpolated cell.
    await expect(await preview.findByText("North", {}, { timeout: 8000 })).toBeVisible();
    await expect(preview.getByText("Q1")).toBeVisible();
    await expect(preview.getByText("Q1 · North")).toBeVisible();
  },
};

/**
 * Iterate: one value list → one rendered cell per value (stacked).
 */
export const IterateBuilder: Story = {
  args: { open: false, onOpenChange: () => {}, onSave: () => {} },
  render: function IterateBuilderStory() {
    const [open, setOpen] = useState(false);
    const [saved, setSaved] = useState<string | null>(null);
    return (
      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setOpen(true)}>Edit iteration…</Button>
        {saved ? (
          <pre className="max-w-md rounded-md bg-surface-muted p-3 text-caption">{saved}</pre>
        ) : null}
        <IterationBuilderDialog
          open={open}
          onOpenChange={setOpen}
          value={{
            kind: "iterate",
            as: "item",
            layout: "stacked",
            values: ["Alice", "Bob", "Charlie"],
            template: "{{item.name}}",
          }}
          onSave={setSaved}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Edit iteration/i }));
    const dialog = await within(document.body).findByRole("dialog", {}, { timeout: 12000 });
    // "Alice" renders TWICE — as a TagInput chip AND in the live preview — so
    // scope to the preview region (mirrors the PivotBuilder fix above).
    const preview = within(
      await within(dialog).findByRole("region", { name: /live preview/i }, { timeout: 8000 }),
    );
    // The live preview renders one cell per embedded value.
    await expect(await preview.findByText("Alice", {}, { timeout: 8000 })).toBeVisible();

    // #425 acceptance criterion: this dialog's `Bind name` field sits directly
    // against the (now real) `DialogBody` scrollport as its first child — the
    // same worst case `FocusRingClearance` locks on `DialogBody` itself. Assert
    // the fix reaches this consumer rather than assuming it from the swap alone.
    const body = dialog.querySelector<HTMLElement>('[data-slot="dialog-body"]')!;
    const bindNameInput = within(dialog).getByLabelText("Bind name");
    bindNameInput.focus();
    const r = room(bindNameInput, body);
    expect(r.left).toBeGreaterThanOrEqual(3.5);
    expect(r.right).toBeGreaterThanOrEqual(3.5);
    expect(r.top).toBeGreaterThanOrEqual(3.5);
  },
};

/**
 * Pivot with a ```calc cell: objects inside a cell RESOLVE in the live preview
 * (not raw text). With a calc `evaluate` wired, each cell's fence renders a real
 * CalcBlock — the same path the saved block renders through, in matrix and
 * stacked alike.
 */
export const PivotWithCalc: Story = {
  args: { open: false, onOpenChange: () => {}, onSave: () => {} },
  render: function PivotWithCalcStory() {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setOpen(true)}>Edit pivot with calc…</Button>
        <IterationBuilderDialog
          open={open}
          onOpenChange={setOpen}
          evaluate={evaluateCalc}
          value={{
            kind: "pivot",
            as: "item",
            layout: "matrix",
            values: ["1", "2"],
            cols: ["1", "2"],
            template: "```calc\nitems = {{row}} + {{col}}\ntotal = items\n```",
          }}
          onSave={() => {}}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Edit pivot with calc/i }));
    const dialog = await within(document.body).findByRole("dialog", {}, { timeout: 12000 });
    // The calc fence resolved into real CalcBlock(s) inside the matrix cells.
    await within(dialog).findAllByTestId("calc-block", {}, { timeout: 8000 });
  },
};

/**
 * A nested `:::card` (with content AFTER it) inside the iteration template. The live
 * preview renders a REAL Card per item — not truncated plain text — and keeps the
 * trailing line, because the builder serializes the directive with a fence longer
 * than the nested one (`outerDirectiveFence`). This is the #223 "other components
 * inside iterations don't render" fix, shown in the dialog the author actually uses.
 */
export const WithNestedCard: Story = {
  args: { open: false, onOpenChange: () => {}, onSave: () => {} },
  render: function WithNestedCardStory() {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setOpen(true)}>Edit iteration with card…</Button>
        <IterationBuilderDialog
          open={open}
          onOpenChange={setOpen}
          value={{
            kind: "iterate",
            as: "item",
            layout: "stacked",
            values: ["Ada", "Grace"],
            template:
              ':::card{title="{{item.name}}"}\nLead engineer for {{item.name}}\n:::\n\nNotes for {{item.name}}',
          }}
          onSave={() => {}}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Edit iteration with card/i }));
    const dialog = await within(document.body).findByRole("dialog", {}, { timeout: 12000 });
    const d = within(dialog);
    // The nested card rendered as a real component (title + body interpolated)...
    await expect(await d.findByText("Lead engineer for Ada", {}, { timeout: 8000 })).toBeVisible();
    // ...and the content AFTER it survived (dropped before the fence-collision fix).
    await expect(d.getByText("Notes for Ada")).toBeVisible();
    await expect(d.getByText("Notes for Grace")).toBeVisible();
  },
};

/**
 * Bento layout: the values render as varied-size BentoGrid tiles in the live preview.
 */
export const BentoBuilder: Story = {
  args: { open: false, onOpenChange: () => {}, onSave: () => {} },
  render: function BentoBuilderStory() {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex flex-col items-center gap-3">
        <Button onClick={() => setOpen(true)}>Edit bento…</Button>
        <IterationBuilderDialog
          open={open}
          onOpenChange={setOpen}
          value={{
            kind: "iterate",
            as: "item",
            layout: "bento",
            values: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
            template: "**{{item.name}}**",
          }}
          onSave={() => {}}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Edit bento/i }));
    const dialog = await within(document.body).findByRole("dialog", {}, { timeout: 12000 });
    // "Alpha"/"Epsilon" render TWICE — as TagInput chips AND in the live
    // preview's BentoGrid tiles — so scope to the preview region.
    const preview = within(
      await within(dialog).findByRole("region", { name: /live preview/i }, { timeout: 8000 }),
    );
    await expect(await preview.findByText("Alpha", {}, { timeout: 8000 })).toBeVisible();
    await expect(preview.getByText("Epsilon")).toBeVisible();
  },
};
