/**
 * Persona — the animated agent presence.
 *
 * The artwork is a Rive `.riv` file fetched from a **remote origin** at runtime,
 * and the WebGL2 runtime is loaded lazily (ADR 0019). Both facts matter for
 * deployment: under a restrictive `connect-src` the fetch is blocked and the
 * component falls back to a token-driven orb rather than an empty box. See
 * `docs/CSP-AND-NETWORK.md`, and pass `src` to self-host the artwork.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { Persona, type PersonaState } from "./persona";

/**
 * The visible caption below mirrors the visually-hidden `role="status"` text
 * `Persona` announces to assistive tech for each state (see `PersonaProps.statusLabel`).
 */
const STATUS_LABELS: Record<PersonaState, string> = {
  idle: "Assistant idle",
  listening: "Assistant listening",
  thinking: "Assistant thinking…",
  speaking: "Assistant speaking",
  asleep: "Assistant asleep",
};

const meta = {
  title: "AI/Persona",
  component: Persona,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The animated agent presence. Artwork is a remote Rive `.riv` file and the WebGL2 runtime loads lazily, so the first frame is the fallback orb. Pass `src` to self-host, `fallback` to replace the placeholder. Blocked/offline loads render the fallback instead of an empty box.",
      },
    },
  },
  args: { state: "idle" },
  tags: ["autodocs"],
} satisfies Meta<typeof Persona>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The offline / CSP-blocked state — and the default story on purpose.
 *
 * `src` points at a URL that cannot resolve, so this renders the fallback orb
 * without reaching the network. Keeping the DEFAULT story offline means CI and
 * the visual sweep never depend on a third-party origin being up.
 */
export const Default: Story = {
  args: { src: "about:blank#persona-offline" },
};

/** An explicit custom fallback, for brands that want their own resting mark. */
export const CustomFallback: Story = {
  args: {
    src: "about:blank#persona-offline",
    fallback: (
      <div className="grid size-16 place-items-center rounded-full border-2 border-primary/40 border-dashed">
        <span className="text-meta text-muted-foreground">AI</span>
      </div>
    ),
  },
};

/**
 * Every conversational state, offline.
 *
 * With live artwork these animate; here they all show the fallback, which is
 * exactly what a locked-down deployment sees. The caption under each orb is
 * the SAME text `Persona` announces to assistive tech via its default
 * `statusLabel` — shown visibly here purely for documentation.
 */
export const States: Story = {
  render: (args) => (
    <div className="flex items-center gap-6">
      {(["idle", "listening", "thinking", "speaking", "asleep"] as const).map((state) => (
        <figure className="flex flex-col items-center gap-2" key={state}>
          <Persona {...args} src="about:blank#persona-offline" state={state} />
          <figcaption className="text-meta text-muted-foreground">
            {state}
            <br />
            <span className="italic">{STATUS_LABELS[state]}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};

/**
 * Opt out of the announcement with `statusLabel={null}` — for a surface that
 * already renders its own `role="status"` line elsewhere (e.g. next to a
 * chat composer) and doesn't want AT told twice.
 */
export const NoStatusAnnouncement: Story = {
  args: { src: "about:blank#persona-offline", state: "thinking", statusLabel: null },
};

/**
 * Live artwork from the default remote origin.
 *
 * ⚠️ This story REACHES THE NETWORK (`*.public.blob.vercel-storage.com`). It is
 * the only one that does; it exists so the real animation can be reviewed, and
 * it degrades to the fallback orb when the origin is unreachable.
 */
export const LiveRemoteArtwork: Story = {
  args: { state: "thinking", variant: "obsidian" },
};
