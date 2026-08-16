import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { useRef, useState } from "react";
import { ThemeProvider } from "@elabs/components-tokens";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";
import { IterationBuilderProvider } from "../markdown-iteration/iteration-builder-dialog";

const meta = {
  title: "Editor/MarkdownEditor",
  component: MarkdownEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A headless Milkdown (ProseMirror) WYSIWYG markdown surface vendored onto " +
          "brand-ui. Companion to the Monaco `CodeEditor` (source) in the same package. " +
          "Theming is 100% semantic tokens, so it tracks all three themes via `data-theme`. " +
          "Depends on only `@milkdown/kit` — no Vue/Crepe.",
      },
    },
  },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Post-condition every node-menu play owes (#386). A Radix MODAL menu marks the
 * rest of the document `aria-hidden` while it is open, so a play that returns
 * with one still up (or still tearing down) fails axe's `aria-hidden-focus` —
 * and the marker survives into the NEXT story in this file, where `findByRole`
 * then can't see the `⋯` button at all ("Unable to find role=button and name
 * 'Iteration actions'") even though `findByText` still matches, because only
 * role queries consult the accessibility tree. Waiting on the marker is the
 * behavioural assertion "dismissing the menu restores the document".
 */
async function expectDocumentRestored(canvasElement: HTMLElement) {
  const doc = canvasElement.ownerDocument;
  await waitFor(() => expect(within(doc.body).queryByRole("menu")).toBeNull());
  await waitFor(() => expect(doc.querySelector('[data-aria-hidden="true"]')).toBeNull());
}

const SAMPLE = `# Customer Objective

Migrate **1,245 reports** to the new platform by Q3. Track scope, owners and risk.

## Checklist

- [x] Freeze scope
- [ ] Map data sources
- [ ] Pilot with finance

> Frozen scope candidates are the migration baseline.

| Phase  | Owner   | Status |
| ------ | ------- | ------ |
| Draft  | Manuel  | done   |
| Review | Team    | active |

Inline \`code\`, a [link](https://example.com), and a divider:

---

\`\`\`ts
export const scope = 1245;
\`\`\`
`;

export const Default: Story = {
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <MarkdownEditor defaultValue={SAMPLE} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Milkdown mounts asynchronously — wait for the rendered heading.
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Customer Objective", {}, { timeout: 8000 }),
    ).toBeVisible();
    // #21: the contenteditable role="textbox" surface must have an accessible name
    // (axe `aria-input-field-name`). Defaults to "Markdown editor".
    await expect(
      await canvas.findByRole("textbox", { name: "Markdown editor" }, { timeout: 8000 }),
    ).toBeVisible();
  },
};

export const Controlled: Story = {
  render: function ControlledStory() {
    const [value, setValue] = useState("# Type here\n\nEdits flow through `onChange`.");
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <MarkdownEditor value={value} onChange={setValue} />
        <p className="text-meta text-muted-foreground">{value.length} characters</p>
      </div>
    );
  },
};

export const ReadOnly: Story = {
  name: "Read-only",
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <MarkdownEditor defaultValue={SAMPLE} readOnly />
    </div>
  ),
};

const DIRECTIVES = `# Migration plan

:::card{title="Objective"}

Migrate the reporting estate to the new platform by Q3.

:::

:::callout{type="warning" title="At risk"}

Two upstream data sources are still un-mapped.

:::

::metric{label="Reports in scope" value="1,245" description="across 9 domains" delta="+12%"}

:::timeline

- (done) Freeze scope
- (active) Map data sources
- (pending) Pilot with finance

:::
`;

/**
 * The brand `:::` directives render as the REAL @brand components inside the editor
 * (a live `Card`, `Alert`, `MetricBlock`), with the card/callout title and the metric
 * label/value editable inline — not the old token-styled `toDOM` chrome. Switch the
 * Storybook theme to confirm they track all three themes.
 */
export const LiveDirectives: Story = {
  name: "Live directives (inline-editable)",
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <MarkdownEditor defaultValue={DIRECTIVES} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The directive node-views expose their editable attributes as textboxes.
    await expect(
      await canvas.findByRole("textbox", { name: "Card title" }, { timeout: 8000 }),
    ).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: "Metric value" })).toHaveTextContent("1,245");
    // The callout renders as a real Alert (role="alert").
    await expect(canvas.getByRole("alert")).toBeVisible();
  },
};

/**
 * Demonstrates `onEmbedAsset` — the paste/drop image-embed hook.
 *
 * The mock hook simulates a 600 ms upload delay and resolves with a data-URL
 * so no real server is needed. To exercise it manually:
 *   1. Copy an image file to your clipboard (or drag one onto the editor).
 *   2. Paste / drop into the editor surface.
 *   3. You will see the "Uploading…" chip appear, then the image render inline.
 *   4. The markdown output below shows `![filename](/demo/uploads/...)`.
 *
 * The error variant is toggled by the "Simulate failure" button — it wires a
 * hook that always rejects so you can observe the inline error chip + toast.
 *
 * Theme sweep: switch the Storybook theme (toolbar) to verify the upload chip
 * and error chip use only semantic tokens across light/dark.
 */
export const PasteEmbed: Story = {
  name: "Paste / drop image embed (onEmbedAsset)",
  render: function PasteEmbedStory() {
    const ref = useRef<MarkdownEditorHandle>(null);
    const [markdown, setMarkdown] = useState("# Image embed demo\n\nPaste or drop an image here.");
    const [simulateFailure, setSimulateFailure] = useState(false);
    const [lastPath, setLastPath] = useState<string | null>(null);

    const onEmbedAsset = async (file: File): Promise<string> => {
      if (simulateFailure) {
        await new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Simulated upload failure")), 600),
        );
        throw new Error("Simulated upload failure");
      }
      // Simulate upload delay: read file as data-URL and return it.
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const path = `/demo/uploads/${Date.now()}-${file.name}`;
          setLastPath(path);
          resolve(path);
        };
        reader.onerror = () => reject(new Error("FileReader error"));
        reader.readAsDataURL(file);
      });
    };

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-caption text-muted-foreground">
            <input
              type="checkbox"
              checked={simulateFailure}
              onChange={(e) => setSimulateFailure(e.target.checked)}
            />
            Simulate upload failure
          </label>
          {lastPath && (
            <span className="text-caption text-muted-foreground">
              Last resolved path: <code>{lastPath}</code>
            </span>
          )}
        </div>
        <MarkdownEditor
          ref={ref}
          value={markdown}
          onChange={setMarkdown}
          onEmbedAsset={onEmbedAsset}
          className="min-h-[200px]"
        />
        <details>
          <summary className="cursor-pointer text-caption text-muted-foreground">
            Serialized markdown
          </summary>
          <pre className="mt-1 overflow-auto rounded bg-muted p-3 text-caption">{markdown}</pre>
        </details>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for the editor to boot.
    await expect(
      await canvas.findByRole("textbox", { name: "Markdown editor" }, { timeout: 8000 }),
    ).toBeVisible();
    // The editor surface is ready; paste/drop interaction requires a real
    // ClipboardEvent with files, which Storybook interaction tests can't
    // synthesize reliably across browsers. Verify the surface is accessible.
    await expect(canvas.getByRole("textbox", { name: "Markdown editor" })).toBeVisible();
  },
};

/** GFM table seed for the EditableTable story. */
const TABLE_DOC = `# Project status

Click inside any table cell to reveal the **Table controls** toolbar below the
editor. Use it to add or remove rows and columns. Tab / Shift+Tab move between
cells. The table serializes back to lossless GFM markdown.

| Phase    | Owner   | Status  | Due     |
| -------- | ------- | ------- | ------- |
| Planning | Alice   | done    | 2024-Q1 |
| Build    | Bob     | active  | 2024-Q2 |
| Review   | Charlie | pending | 2024-Q3 |

Prose continues normally after the table.
`;

/**
 * Demonstrates the table node-view feature:
 *
 * - Click inside a table cell → the **Table controls** toolbar appears at the
 *   bottom of the editor surface.
 * - Toolbar buttons: Add row above/below, Delete row, Add col left/right,
 *   Delete column — all aria-labelled, keyboard-operable.
 * - Tab moves to the next cell; Shift+Tab to the previous.
 * - The serialized markdown (shown below the editor) stays lossless GFM.
 *
 * Three-theme sweep: switch the Storybook theme toolbar to verify the table
 * borders (`border-border-strong`), header tint (`bg-surface-muted`), and
 * toolbar chrome use only semantic tokens across all three themes.
 */
export const EditableTable: Story = {
  name: "Editable table (wysiwyg-tables)",
  render: function EditableTableStory() {
    const ref = useRef<MarkdownEditorHandle>(null);
    const [markdown, setMarkdown] = useState(TABLE_DOC);
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <MarkdownEditor
          ref={ref}
          value={markdown}
          onChange={setMarkdown}
          className="min-h-[280px]"
        />
        <details>
          <summary className="cursor-pointer text-caption text-muted-foreground">
            Serialized markdown (GFM round-trip)
          </summary>
          <pre className="mt-1 overflow-auto rounded bg-muted p-3 text-caption">{markdown}</pre>
        </details>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for the editor to boot and the table to render.
    await expect(
      await canvas.findByRole("textbox", { name: "Markdown editor" }, { timeout: 8000 }),
    ).toBeVisible();
    // The GFM table must render as a real <table> element in the WYSIWYG.
    await expect(await canvas.findByRole("table", {}, { timeout: 8000 })).toBeVisible();
    // The table cells are accessible (role="cell" / "columnheader").
    const cells = canvas.getAllByRole("cell");
    expect(cells.length).toBeGreaterThan(0);
  },
};

/**
 * Fill height (editor-fill-height): in a definite-height container, the editable
 * must fill the whole pane — not just its content. A short (1-line) document
 * still produces a full-height clickable surface, and the caret-anchored `/` menu
 * has room to open near the bottom edge. Before the fix the host was
 * content-sized (`min-height: 9rem` ≈ 144px), leaving a large dead area below the
 * editable into which the slash menu clipped.
 */
export const FillsContainer: Story = {
  name: "Fills container (editor-fill-height)",
  render: () => (
    // A definite-height parent (the workspace's `h-full` wysiwyg pane in the real
    // app). No `h-full` on the editor itself — it fills via `min-height: 100%`.
    <div style={{ height: 700 }}>
      <MarkdownEditor defaultValue={"# One line"} aria-label="Markdown editor" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editable = await canvas.findByRole(
      "textbox",
      { name: "Markdown editor" },
      { timeout: 8000 },
    );
    await expect(editable).toBeVisible();
    // The 1-line doc's editable fills the 700px container (well past the ~144px
    // content floor) — clickable everywhere, with room for the `/` menu.
    expect(editable.clientHeight).toBeGreaterThan(500);
  },
};

/**
 * Code-block exit (A3): the caret can escape a fenced code block — including the
 * trailing ```calc fence — with **Tab** or **Mod-Enter**. A code block that is
 * the document's last child no longer traps the caret; exiting inserts a new
 * paragraph below it. The behavior is unit-locked in `exit-keymap.test.ts`; this
 * story is the manual playground — click inside the block and press Tab.
 */
export const CodeBlockExit: Story = {
  name: "Code-block exit (Tab / Mod-Enter)",
  render: () => (
    <div className="mx-auto max-w-3xl p-6">
      <MarkdownEditor
        defaultValue={
          "Click inside the block below and press **Tab** to escape it.\n\n" +
          "```calc\nrevenue = 1200\ncost = 800\nprofit = revenue - cost\n```\n"
        }
        aria-label="Markdown editor"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("textbox", { name: "Markdown editor" }, { timeout: 8000 }),
    ).toBeVisible();
  },
};

const ITERATE_NODE_MENU_SEED = `# Node menu demo

:::iterate{as="item" layout="stacked" values="Alice, Bob"}
{{item.name}}
:::
`;

const PIVOT_NODE_MENU_SEED = `# Pivot node menu demo

:::pivot{layout="matrix" rows="Q1, Q2" cols="North, South"}
{{row}} · {{col}}
:::
`;

/**
 * The iteration node-view's menu (#223): a `⋯` button opens "Edit iteration…"
 * (the guided re-edit), "Change layout" (a submenu of radio items — stacked /
 * grid / bento for `iterate` — that rewrites the `layout` attribute directly,
 * no dialog), and "Convert to static" (replaces the directive with its
 * populated markdown; no ProseMirror dependency). `IterationBuilderProvider`
 * wires the `⋯`/right-click affordance on; without it neither menu renders.
 * The `ContextMenu` story below opens the SAME item set via right-click — both
 * read one shared list (`IterationMenuItems` in directive-views.tsx) so they
 * can never diverge.
 */
export const NodeMenu: Story = {
  name: "Iteration node menu (⋯ dropdown)",
  render: function NodeMenuStory() {
    const [markdown, setMarkdown] = useState(ITERATE_NODE_MENU_SEED);
    return (
      <IterationBuilderProvider>
        <div className="mx-auto max-w-3xl p-6">
          <MarkdownEditor value={markdown} onChange={setMarkdown} aria-label="Markdown editor" />
        </div>
        <pre className="mx-auto max-w-3xl whitespace-pre-wrap px-6 text-caption text-muted-foreground">
          {markdown}
        </pre>
      </IterationBuilderProvider>
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findByText("Iterate", {}, { timeout: 8000 })).toBeVisible();

    const menuButton = await canvas.findByRole(
      "button",
      { name: "Iteration actions" },
      { timeout: 8000 },
    );
    await userEvent.click(menuButton);
    const body = within(canvasElement.ownerDocument.body);
    const menu = await body.findByRole("menu", {}, { timeout: 8000 });
    await waitFor(() => expect(within(menu).getByText("Edit iteration…")).toBeVisible());
    await expect(within(menu).getByText("Change layout")).toBeVisible();
    await expect(within(menu).getByText("Convert to static")).toBeVisible();
    // `iterate` has no second axis — "Transpose" (pivot-only) never appears for it.
    expect(within(menu).queryByText("Transpose")).toBeNull();

    // "Change layout" → hover opens its submenu (Radix's pointer path); pick
    // "grid" — rewrites the `layout` attribute directly, no dialog.
    await userEvent.hover(within(menu).getByText("Change layout"));
    const gridOption = await body.findByRole("menuitemradio", { name: "grid" }, { timeout: 8000 });
    await waitFor(() => expect(gridOption).toBeVisible());
    await userEvent.click(gridOption);
    await waitFor(() =>
      expect(canvas.getByText(/layout="grid"/, { exact: false })).toBeInTheDocument(),
    );

    // Re-open the menu (selecting a radio item closes it AND the controlled
    // `value` round-trip remounts the node-view, so re-query the button fresh
    // rather than reuse the now-detached reference) and "Convert to static" —
    // the directive is replaced with its populated markdown, so the branded
    // "Iterate" frame disappears entirely.
    const menuButton2 = await canvas.findByRole(
      "button",
      { name: "Iteration actions" },
      { timeout: 8000 },
    );
    await userEvent.click(menuButton2);
    const menu2 = await body.findByRole("menu", {}, { timeout: 8000 });
    await waitFor(() => expect(within(menu2).getByText("Convert to static")).toBeVisible());
    await userEvent.click(within(menu2).getByText("Convert to static"));
    await waitFor(() => expect(canvas.queryByText("Iterate")).toBeNull());
    await waitFor(() => expect(canvas.queryByText(/:::iterate/, { exact: false })).toBeNull());
    await expectDocumentRestored(canvasElement);
  },
};

/**
 * The SAME iteration node menu opens on right-click — the AC's "never
 * right-click-only" cuts both ways: the `⋯` button (story above) and the
 * context menu (here) must expose IDENTICAL actions. Uses a `:::pivot` with
 * real row/column values so "Transpose" (pivot-only) has data to swap.
 */
export const IterationContextMenu: Story = {
  name: "Iteration node menu (right-click)",
  render: function IterationContextMenuStory() {
    const [markdown, setMarkdown] = useState(PIVOT_NODE_MENU_SEED);
    return (
      <IterationBuilderProvider>
        <div className="mx-auto max-w-3xl p-6">
          <MarkdownEditor value={markdown} onChange={setMarkdown} aria-label="Markdown editor" />
        </div>
        <pre className="mx-auto max-w-3xl whitespace-pre-wrap px-6 text-caption text-muted-foreground">
          {markdown}
        </pre>
      </IterationBuilderProvider>
    );
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const pivotLabel = await canvas.findByText("Pivot", {}, { timeout: 8000 });
    // Right-click anywhere in the directive frame — not just the ⋯ button.
    await userEvent.pointer({ target: pivotLabel, keys: "[MouseRight]" });
    const body = within(canvasElement.ownerDocument.body);
    const menu = await body.findByRole("menu", {}, { timeout: 8000 });
    await waitFor(() => expect(within(menu).getByText("Edit iteration…")).toBeVisible());
    await expect(within(menu).getByText("Change layout")).toBeVisible();
    await expect(within(menu).getByText("Transpose")).toBeVisible();
    await expect(within(menu).getByText("Convert to static")).toBeVisible();

    await userEvent.click(within(menu).getByText("Transpose"));
    // Rows/cols are swapped losslessly (Q1,Q2 ⇄ North,South).
    await waitFor(() =>
      expect(canvas.getByText(/rows="North, South"/, { exact: false })).toBeInTheDocument(),
    );
    expect(canvas.getByText(/cols="Q1, Q2"/, { exact: false })).toBeInTheDocument();
    await expectDocumentRestored(canvasElement);
  },
};

/**
 * Three-theme sweep for the node menu (#223 round-2): both `NodeMenu` (⋯) and
 * `IterationContextMenu` (right-click) above run only under the toolbar's
 * DEFAULT theme (`light`) — Storybook's `defaultTheme` isn't overridable
 * per-story from the global decorator alone, and toggling `preview.tsx` by hand
 * for a manual three-run sweep leaves no durable, re-runnable evidence. These
 * four stories wrap the SAME render/play pairs in an explicit `<ThemeProvider>`
 * instead, so `pnpm --filter @elabs/components-docs test-storybook`
 * (or `mcp__storybook__run-story-tests`) exercises `dark` and decoration 10
 * on every run, with zero manual steps. `<ThemeProvider>` (not a plain
 * `data-theme` wrapper div) because it writes the attribute onto the DOCUMENT
 * ROOT — the menu's Radix `Portal` mounts its content on `document.body`,
 * OUTSIDE any local wrapper element, so only a document-level attribute
 * actually themes it. `storageKey={null}` keeps the override from persisting
 * to localStorage across runs.
 */
export const NodeMenuDark: Story = {
  name: "Iteration node menu (⋯ dropdown) — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: NodeMenu.render,
  play: NodeMenu.play,
};

export const NodeMenuHighDecoration: Story = {
  name: "Iteration node menu (⋯ dropdown) — high decoration",
  globals: { decoration: "10" },
  render: NodeMenu.render,
  play: NodeMenu.play,
};

export const IterationContextMenuDark: Story = {
  name: "Iteration node menu (right-click) — dark",
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark" storageKey={null}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: IterationContextMenu.render,
  play: IterationContextMenu.play,
};

export const IterationContextMenuHighDecoration: Story = {
  name: "Iteration node menu (right-click) — high decoration",
  globals: { decoration: "10" },
  render: IterationContextMenu.render,
  play: IterationContextMenu.play,
};
