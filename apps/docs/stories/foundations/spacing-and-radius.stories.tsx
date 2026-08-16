import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The SPACING and RADIUS scales — the rhythm of the system.
 *
 * - **Spacing** uses the standard Tailwind scale (`1` = `0.25rem` = 4px). Reach
 *   for `p-*`, `gap-*`, `space-y-*`, `m-*` on this scale; don't invent ad-hoc
 *   spacing. Spacing is one of the two seams the DENSITY dial rescales — flip
 *   the toolbar Density to Compact/Spacious and the bars below grow and shrink,
 *   because density overrides `--spacing`. It rescales TYPE at the same time
 *   (#340, at roughly half the rate); see Foundations/Typography →
 *   Density scale.
 * - **Radius** is token-backed: `rounded-sm/md/lg/xl` derive from `--radius`,
 *   which is itself `--radius-base × (1 − decoration)`. Raise the toolbar
 *   Decoration dial and corners square up; the reference themes use a softer
 *   `--radius-base` than the neutral default.
 */

const meta = {
  title: "Foundations/Spacing & Radius",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The spacing scale (standard Tailwind `0.25rem` step) and the " +
          "token-backed radius scale (`rounded-*` ← `--radius`). Spacing reacts to " +
          "the Density toolbar dial (which rescales type alongside it, #340); radius " +
          "reacts to the Decoration dial.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Standard Tailwind spacing steps (× 0.25rem). These are the rungs the system
// uses for p-*/m-*/gap-*/space-*. Width is driven by the same --spacing var the
// utilities use, so the bars track the Density dial.
const SPACING_STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16] as const;

function SpacingRow({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-4">
      <code className="w-16 shrink-0 text-code text-muted-foreground">p-{step}</code>
      <code className="w-20 shrink-0 text-meta text-muted-foreground tabular-nums">
        {step * 0.25}rem
      </code>
      {/* Length driven by the live --spacing var (× step), IDENTICAL to how the
          `p-{step}` utility compiles (calc(var(--spacing) * step)) — so the bar
          equals the actual spacing value and rescales with the Density dial. A
          length reference, not a color, so the no-raw-color rule does not apply. */}
      <div
        className="h-4 rounded-sm bg-primary"
        style={{ width: `calc(var(--spacing) * ${step})` }}
        aria-hidden="true"
      />
    </div>
  );
}

export const Spacing: Story = {
  name: "Spacing scale",
  render: () => (
    <div className="space-y-4">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        The standard Tailwind scale (one step = <code className="text-code">0.25rem</code> = 4px).
        Bars are sized from the live <code className="text-code">--spacing</code> variable, so
        flipping the <strong>Density</strong> toolbar dial (Compact / Spacious) rescales them.
      </p>
      <div className="space-y-3">
        {SPACING_STEPS.map((s) => (
          <SpacingRow key={s} step={s} />
        ))}
      </div>
    </div>
  ),
};

// The four token-backed radius rungs. Literal `rounded-*` classes so Tailwind
// statically emits them; each resolves to a --radius-derived length.
const RADII = [
  { utility: "rounded-sm", varExpr: "--radius − 4px", cls: "rounded-sm" },
  { utility: "rounded-md", varExpr: "--radius − 2px", cls: "rounded-md" },
  { utility: "rounded-lg", varExpr: "--radius", cls: "rounded-lg" },
  { utility: "rounded-xl", varExpr: "--radius + 4px", cls: "rounded-xl" },
  { utility: "rounded-full", varExpr: "9999px (pills / avatars)", cls: "rounded-full" },
] as const;

function RadiusTile({ utility, varExpr, cls }: { utility: string; varExpr: string; cls: string }) {
  return (
    <figure className="m-0 flex flex-col items-center gap-2">
      <div
        className={`flex h-20 w-20 items-center justify-center border-2 border-border-strong bg-surface-muted ${cls}`}
        aria-hidden="true"
      />
      <figcaption className="text-center">
        <code className="block text-code text-foreground">{utility}</code>
        <code className="block text-meta text-muted-foreground">{varExpr}</code>
      </figcaption>
    </figure>
  );
}

export const Radius: Story = {
  name: "Radius scale",
  render: () => (
    <div className="space-y-4">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        Corner radii derive from <code className="text-code">--radius</code> (itself{" "}
        <code className="text-code">--radius-base × (1 − decoration)</code>). Raise the{" "}
        <strong>Decoration</strong> toolbar dial toward 10 and every corner squares up; at 10 the
        geometry is fully square.
      </p>
      <div className="flex flex-wrap gap-6">
        {RADII.map((r) => (
          <RadiusTile key={r.utility} {...r} />
        ))}
      </div>
    </div>
  ),
};
