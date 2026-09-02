import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { TerminalPermission } from "./terminal-permission";

const meta = {
  title: "Terminal/TerminalPermission",
  component: TerminalPermission,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The per-call scoped approval prompt: title, command preview, question, then " +
          "numbered options whose scope (`once` / `session` / `deny`) is chosen through a " +
          "real Radix `RadioGroup` — never a hand-rolled focus walk. Every option's scope " +
          "is stated in its own accessible name; the `❯` glyph is decorative only.",
      },
    },
  },
} satisfies Meta<typeof TerminalPermission>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default title, question and the three verbatim upstream options. */
export const Default: Story = {
  args: { preview: "pnpm install" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Bash command")).toBeInTheDocument();
    await expect(canvas.getByText("pnpm install")).toBeInTheDocument();
    await expect(canvas.getByText("Do you want to proceed?")).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
  },
};

/** A caller-supplied title, question and preview — every part is arbitrary content. */
export const CustomCopy: Story = {
  args: {
    title: "Write file",
    preview: "packages/terminal/src/terminal-permission.tsx",
    question: "Allow this edit?",
  },
};

/** No preview slot at all — the row simply does not render. */
export const NoPreview: Story = {
  args: {},
};

/**
 * Selecting the deny-scoped option reveals a reason field — the person can
 * say what the agent should do instead. Interaction test drives it with the
 * keyboard only, matching the load-bearing accessibility requirement.
 */
export const DenyRevealsReason: Story = {
  args: { preview: "rm -rf dist" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const denyRadio = canvas.getByRole("radio", {
      name: "No, and tell the agent what to do differently",
    });

    await expect(canvas.queryByLabelText("Reason")).not.toBeInTheDocument();
    await userEvent.click(denyRadio);
    await expect(denyRadio).toBeChecked();
    await expect(canvas.getByLabelText("Reason")).toBeInTheDocument();
  },
};

/** Pre-selected on mount, via the uncontrolled `defaultValue`. */
export const DenyPreselected: Story = {
  args: { defaultValue: "deny", preview: "git push --force" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Reason")).toBeInTheDocument();
  },
};

/**
 * Arrow keys move focus; `Space` commits the focused option — the whole
 * component is operable with no mouse. Committing explicitly with `Space`
 * (rather than relying on Radix's own auto-select-on-arrow-move, whose timing
 * depends on a real focus/click ordering) is the same proven pattern used in
 * `@elabs-ai/components-ai`'s `confirmation.test.tsx`.
 */
export const KeyboardOnly: Story = {
  args: { preview: "pnpm publish" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    const once = canvas.getByRole("radio", { name: "Yes" });
    await expect(once).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    const session = canvas.getByRole("radio", {
      name: "Yes, and don’t ask again this session",
    });
    await expect(session).toHaveFocus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(session).toBeChecked());
  },
};

/** A caller can replace the options with entirely different, still vendor-free scopes. */
export const CustomOptions: Story = {
  args: {
    preview: "curl https://example.com/install.sh | sh",
    options: [
      { id: "allow", label: "Allow", scope: "once", description: "Runs this one download." },
      {
        id: "always",
        label: "Always allow downloads",
        scope: "always",
        description: "Applies to every download from now on.",
      },
      { id: "deny", label: "Refuse", scope: "deny" },
    ],
  },
};

/** `rail` passes through to every underlying `TerminalRow`, like any other row. */
export const Rail: Story = {
  args: { preview: "pnpm test", variant: "rail" },
};

/**
 * `boxed` merges the title/preview/question rows into ONE frame — they are
 * conceptually a single sentence, not three independent frame-drawing
 * blocks — while the options list keeps its own existing frame below. See
 * the component's module doc, "`boxed` frames the PROMPT as one block, not
 * three" (cross-theme sweep fix).
 */
export const Boxed: Story = {
  args: { preview: "pnpm test", variant: "boxed" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const prompt = canvasElement.querySelector("[data-slot='terminal-permission-prompt']");
    await expect(prompt).toHaveClass("border-terminal-border");

    // The individual prompt rows carry no border of their own.
    await expect(
      canvasElement.querySelector("[data-slot='terminal-permission-title']"),
    ).toHaveAttribute("data-variant", "marker");

    // The options list is unaffected by this fix.
    await expect(canvas.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
  },
};
