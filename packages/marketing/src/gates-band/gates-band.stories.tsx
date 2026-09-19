import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
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
 * JavaScript involved. `flex` on the summary removes the native marker, so a CSS-drawn chevron is
 * the visible cue: it points to the inline end while closed and turns down once open, and the
 * label lifts to `foreground` on hover and while open. Backtick runs in a doc render as real
 * `<code>`, never literal backticks.
 */
export const DisclosureOpens: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const label = canvas.getByText("Stories");
    const details = label.closest("details")!;
    const summary = details.querySelector("summary")!;
    const chevron = summary.querySelector<HTMLElement>('[data-slot="gates-band-chevron"]')!;
    expect(details.open).toBe(false);

    // The cue exists, is hidden from assistive tech, and points to the inline end while closed.
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(chevron).toBeVisible();
    expect(getComputedStyle(chevron).rotate).toBe("-45deg");

    await userEvent.click(summary);
    expect(details.open).toBe(true);
    // Open turns it down; `waitFor` rides out the `duration-fast` turn.
    await waitFor(() => expect(getComputedStyle(chevron).rotate).toBe("45deg"));
    expect(canvas.getByText("a11y-baseline")).toBeVisible();
    const codeRuns = canvasElement.querySelectorAll('[data-slot="gates-band-item"] code');
    expect(codeRuns.length).toBeGreaterThan(1);
    expect(details.textContent).not.toContain("`");

    await userEvent.click(summary);
    expect(details.open).toBe(false);
    await waitFor(() => expect(getComputedStyle(chevron).rotate).toBe("-45deg"));

    // Hover and keyboard need TRUSTED input: a synthetic keydown never runs <summary>'s native
    // activation, and a synthetic pointer event never sets `:hover`. `@vitest/browser/context`
    // (a virtual module that resolves only inside Vitest's browser runner — the
    // `vitest --project storybook` run CI blocks on) drives the real Playwright mouse and
    // keyboard; plain Storybook browsing and `build-storybook` skip this block and keep every
    // assertion above.
    // Typed by hand to the three calls used here (the module's own type is only reachable via
    // an `import()` type annotation, which `consistent-type-imports` forbids).
    interface TrustedInput {
      userEvent: {
        hover: (element: Element) => Promise<void>;
        unhover: (element: Element) => Promise<void>;
        keyboard: (text: string) => Promise<void>;
      };
    }
    let browserContext: TrustedInput | undefined;
    try {
      browserContext = await import("@vitest/browser/context");
    } catch {
      browserContext = undefined;
    }
    if (!browserContext) return;

    const restingColor = getComputedStyle(label).color;
    await browserContext.userEvent.hover(summary);
    await waitFor(() => expect(getComputedStyle(label).color).not.toBe(restingColor));
    await browserContext.userEvent.unhover(summary);

    summary.focus();
    expect(summary).toHaveFocus();
    await browserContext.userEvent.keyboard("{Enter}");
    await waitFor(() => expect(details.open).toBe(true));
    await waitFor(() => expect(getComputedStyle(chevron).rotate).toBe("45deg"));
    await browserContext.userEvent.keyboard(" ");
    await waitFor(() => expect(details.open).toBe(false));
  },
};
