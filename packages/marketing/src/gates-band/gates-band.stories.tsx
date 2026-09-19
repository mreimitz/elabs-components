import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { GatesBand, type GatesBandGate } from "./gates-band";

const GATES: GatesBandGate[] = [
  {
    id: "a11y-baseline",
    doc: 'Axe stays blocking: preview.tsx keeps `a11y: { test: "error" }` and applies the ratchet.',
    category: "stories",
  },
  {
    id: "component-registration",
    doc: "Every component folder is re-exported from `src/index.ts` and ships a `*.stories.tsx`.",
    category: "components",
  },
  {
    id: "data-slot",
    doc: "Every exported component's root carries `data-slot`, and each sub-part its own.",
    category: "components",
  },
  {
    id: "theme-parity",
    doc: "Every theme block defines every semantic token.",
    category: "themes",
  },
  {
    id: "conflict-markers",
    doc: "Resolve every Git merge conflict before committing.",
    category: "repo",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  stories: "Stories",
  components: "Components",
  themes: "Themes",
  repo: "Repo",
};

const meta = {
  title: "Marketing/GatesBand",
  component: GatesBand,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { gates: GATES, count: GATES.length, categoryLabels: CATEGORY_LABELS },
} satisfies Meta<typeof GatesBand>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The header count comes from `counts.json.gates`, independent of how many rows are shown. */
export const CountFromGenerated: Story = {
  args: { count: 88 },
};

export const WithFooter: Story = {
  args: {
    footer: "See the full list in docs/GATES.md on GitHub.",
  },
};

/** An unlisted category falls back to its own slug — never invented. */
export const UnknownCategory: Story = {
  args: {
    gates: [{ id: "external-check", doc: "Runs an external command.", category: "external" }],
    count: 1,
    categoryLabels: {},
  },
};

/**
 * Every group is a native `<details>`/`<summary>` disclosure, closed by default (#587) — the
 * category and its count are always visible; Enter/Space (or a click) reveals its rules, with no
 * JavaScript involved. Backtick runs in a doc render as real `<code>`, never literal backticks.
 */
export const DisclosureOpens: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const summary = canvas.getByText("Stories");
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    await userEvent.click(summary);
    expect(details.open).toBe(true);
    expect(canvas.getByText("a11y-baseline")).toBeVisible();
    const codeRuns = canvasElement.querySelectorAll('[data-slot="gates-band-item"] code');
    expect(codeRuns.length).toBeGreaterThan(1);
    expect(details.textContent).not.toContain("`");
  },
};
