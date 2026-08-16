/**
 * AI Composer — the standard chat-input block.
 *
 * This block is now a thin showcase of the real `<Composer />` component (the
 * canonical brand-ui AI chat input). The double-card chrome — a status strip
 * wrapping a recessed `PromptInput` well (sharp top, theme-rounded bottom),
 * model pill, voice, circular send, suggestion chips — lives in `composer.tsx`,
 * not here, so every surface gets the same input by importing it. `Composer`'s
 * `tone` prop (#254) picks the outer/inner arrangement: `"surface"` (default)
 * is the outer `bg-card` frame this block ships everywhere else; `"card"` is
 * the tinted-outer/distinct-inner arrangement the reference exemplar calls
 * for — see `DoubleCardToned` below. Semantic tokens only; theme-aware radii;
 * reads in all themes.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ChatGreeting } from "./chat-greeting";
import { Composer } from "./composer";

const SUGGESTIONS = ["Summary", "Code", "Design", "Research"];

/** Empty/first-run chat state: greeting + composer + suggestion chips. */
function AiComposerScene() {
  return (
    <div className="grid min-h-[28rem] place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-2xl">
        <ChatGreeting title="Good morning, Avery" subtitle="How can I" accent="assist you today?" />

        <Composer onSubmit={() => undefined} suggestions={SUGGESTIONS} />
      </div>
    </div>
  );
}

const meta = {
  title: "Patterns/Blocks/AI Composer",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The standard AI chat-input block — a thin showcase of the real <Composer /> component: a rounded two-tone double card (a status strip around a recessed PromptInput well with a sharp top and theme-rounded bottom), a model pill, a circular send, and suggestion chips under a centered greeting. Composer's `tone` prop (#254) picks the arrangement — `surface` (default, this block's Default/ComposerOnly) is the outer bg-card frame; `card` (see DoubleCardToned) is the tinted-outer/distinct-inner frame the reference exemplar calls for. Built on the real @qlik-coe-emea/qlabs-components-ai PromptInput; semantic tokens only; reads in all themes. Reach for <Composer /> instead of hand-rolling this.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full empty-state scene (greeting + composer + chips). */
export const Default: Story = { render: () => <AiComposerScene /> };

/** Just the double-card composer, to drop into a ChatShell footer. */
export const ComposerOnly: Story = {
  render: () => (
    <div className="bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <Composer onSubmit={() => undefined} />
      </div>
    </div>
  ),
};

/**
 * The tinted-outer/distinct-inner "double card" (#254) — the look the
 * shadcnuikit ai-chat-v2 exemplar this block was named after actually calls
 * for: `<Composer tone="card" />` swaps the outer frame to `bg-surface-muted`
 * around a `tone="card"` well, instead of the default outer `bg-card` frame
 * `ComposerOnly`/`Default` above ship. Check both themes: the well is
 * raised (lighter than the frame) on light themes, recessed (darker) on
 * qlik-dark.
 */
export const DoubleCardToned: Story = {
  render: () => (
    <div className="bg-background p-6">
      <div className="mx-auto max-w-2xl">
        <Composer tone="card" onSubmit={() => undefined} suggestions={SUGGESTIONS} />
      </div>
    </div>
  ),
};
