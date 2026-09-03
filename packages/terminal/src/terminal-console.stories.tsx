import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";

import { TerminalComposer } from "./terminal-composer";
import { TerminalConsole } from "./terminal-console";
import { TerminalRow } from "./terminal-row";
import { TerminalStatusBar } from "./terminal-status-bar";
import { TerminalSurface } from "./terminal-surface";

const meta = {
  title: "Terminal/TerminalConsole",
  component: TerminalConsole,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The console counterpart of `AI/ChatShell` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "The console **frame** (ADR 0033, `docs/ADR/0033-terminal-console-frame-and-regions.md`): " +
          "exactly one element in a console draws the edge, the radius, the ground and the lift. " +
          "Everything placed inside it — a transcript, a composer, a status bar — becomes a flush " +
          "**region** with no border/radius/shadow of its own, separated from its neighbour by a " +
          "single 1px seam the frame itself owns. `TerminalSurface` is frame-aware: it reads a " +
          "second, static context published here and omits its own frame classes the moment it " +
          "sits inside a `TerminalConsole`. A lone `TerminalSurface` on a page is unaffected — it " +
          "is itself a frame, exactly as before this component existed.",
      },
    },
  },
} satisfies Meta<typeof TerminalConsole>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A transcript, a composer and a status bar assembled as ONE console. Before
 * ADR 0033 this rendered as three floating cards with strips of page
 * background between them; now the frame is drawn once and every region
 * sits flush against its neighbour, separated only by a seam.
 */
export const Default: Story = {
  render: () => (
    <TerminalConsole className="max-w-xl">
      <TerminalSurface>
        <TerminalRow gutter=">">pnpm build</TerminalRow>
        <TerminalRow gutter="✔" gutterLabel="completed">
          Build complete in 1.8s
        </TerminalRow>
      </TerminalSurface>
      <TerminalComposer onSubmit={fn()} />
      <TerminalStatusBar branch="main" workspace="~/projects/console-app" />
    </TerminalConsole>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const consoleRoot = canvasElement.querySelector('[data-slot="terminal-console"]');
    const transcript = canvasElement.querySelector('[data-slot="terminal-surface"]');
    const composer = canvasElement.querySelector('[data-slot="terminal-composer"]');
    const statusBar = canvasElement.querySelector('[data-slot="terminal-status-bar"]');

    await expect(consoleRoot).not.toBeNull();
    await expect(transcript).not.toBeNull();
    await expect(composer).not.toBeNull();
    await expect(statusBar).not.toBeNull();

    // Exactly ONE element draws the frame's edge and radius: the console root.
    const consoleClasses = consoleRoot!.className.split(/\s+/);
    await expect(consoleClasses).toContain("rounded-lg");
    await expect(consoleClasses).toContain("border");
    await expect(consoleClasses).toContain("shadow-sm");

    // The regions draw none of it again — no radius, no standalone border,
    // no shadow. `TerminalStatusBar` keeps its own `border-t` (the seam,
    // idempotent with the frame's own `[&>*+*]:border-t`), which is why it
    // is checked for the ABSENCE of a full `border`/`rounded-lg`/`shadow-sm`
    // rather than the absence of every border-related class.
    for (const region of [transcript, composer, statusBar]) {
      const classes = region!.className.split(/\s+/);
      await expect(classes).not.toContain("rounded-lg");
      await expect(classes).not.toContain("border");
      await expect(classes).not.toContain("shadow-sm");
    }

    await expect(canvas.getByText("Build complete in 1.8s")).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText("Type your next instruction…")).toBeInTheDocument();
    await expect(canvas.getByText("main")).toBeInTheDocument();
  },
};

/** A framed transcript alone — the single-region case a console degrades to. */
export const TranscriptOnly: Story = {
  render: () => (
    <TerminalConsole className="max-w-xl">
      <TerminalSurface>
        <TerminalRow gutter=">">pnpm test</TerminalRow>
        <TerminalRow gutter="✔" gutterLabel="completed">
          42 passed
        </TerminalRow>
      </TerminalSurface>
    </TerminalConsole>
  ),
};
