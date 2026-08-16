import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The ELEVATION ramp — how content lifts off the page.
 *
 * Every shadow in the system is a rung of ONE ramp declared in `themes.css`
 * (§ ELEVATION RAMP). A rung is a **stack** of 2–5 layers at 1–7% alpha whose
 * offset and blur roughly halve on the way down, which approximates a real
 * penumbra — the edge falls off smoothly instead of ending in the hard grey band
 * a single-layer shadow draws.
 *
 * Two variants, picked by what the surface IS:
 *
 * - `shadow-*` — the stack alone. For resting surfaces that carry their own
 *   `border` (Card, form fields), and for high-contrast chips that need no edge
 *   at all (Tooltip).
 * - `shadow-ring-*` — the same stack with a **1px hairline baked in as the final
 *   layer**, so the edge morphs into the shadow. For anything that floats:
 *   dialogs, popovers, menus, toasts, canvas furniture. Never pair one with a
 *   `border` — the edge is already in there, and a second one doubles up.
 *
 * The ink is a THEME property, not a constant: `--shadow-color`,
 * `--shadow-strength` and `--shadow-ring-color` per theme block. Flip the toolbar
 * to **qlik-dark** (deeper stack, white hairline) or **blueprint**
 * (`--shadow-strength: 0` → shadowless, hairline becomes the drawn rule) and
 * watch the same rungs re-ink themselves.
 *
 * Technique borrowed from `flornkm/shadow-plugin` (MIT); see ADR 0020.
 */

const meta = {
  title: "Foundations/Elevation",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The stacked elevation ramp (`shadow-2xs` → `shadow-2xl`) and its " +
          "hairline-ring variant (`shadow-ring-*`) for floating surfaces, plus " +
          "`shadow-hairline` for a bare 1px edge. Ink is per-theme " +
          "(`--shadow-color` / `--shadow-strength` / `--shadow-ring-color`).",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// Literal class strings so Tailwind statically emits each utility.
const LEVELS = [
  {
    utility: "shadow-2xs",
    plain: "shadow-2xs",
    ring: "shadow-ring-2xs",
    use: "A whisper. Chips, inline marks.",
  },
  {
    utility: "shadow-xs",
    plain: "shadow-xs",
    ring: "shadow-ring-xs",
    use: "Hairline lift. Knobs, toggles, small controls.",
  },
  {
    utility: "shadow-sm",
    plain: "shadow-sm",
    ring: "shadow-ring-sm",
    use: "Resting cards, inputs, canvas furniture.",
  },
  {
    utility: "shadow-md",
    plain: "shadow-md",
    ring: "shadow-ring-md",
    use: "Menus, popovers — the first rung that reads as floating.",
  },
  {
    utility: "shadow-lg",
    plain: "shadow-lg",
    ring: "shadow-ring-lg",
    use: "Dialogs, sheets, toasts.",
  },
  {
    utility: "shadow-xl",
    plain: "shadow-xl",
    ring: "shadow-ring-xl",
    use: "Large modal surfaces.",
  },
  {
    utility: "shadow-2xl",
    plain: "shadow-2xl",
    ring: "shadow-ring-2xl",
    use: "Top-most. Command palette, lightbox.",
  },
] as const;

function Tile({ label, cls, bordered }: { label: string; cls: string; bordered?: boolean }) {
  return (
    <div
      className={`flex h-20 items-center justify-center rounded-lg bg-card ${bordered ? "border border-border " : ""}${cls}`}
    >
      <code className="text-code text-muted-foreground">{label}</code>
    </div>
  );
}

export const ElevationScale: Story = {
  name: "Elevation scale",
  render: () => (
    <div className="space-y-6">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        Each row is one rung. Left: <code className="text-code">shadow-*</code> — the stack alone,
        on a bordered resting surface. Right: <code className="text-code">shadow-ring-*</code> — the
        same stack with the 1px hairline as its final layer, and <strong>no border</strong>. Flip
        the theme in the toolbar: on <strong>blueprint</strong> the stack goes to zero and only the
        drawn hairline survives, which is why floating surfaces use the ring variant.
      </p>
      <div className="grid grid-cols-[10rem_1fr_1fr] items-center gap-x-6 gap-y-4">
        <span className="text-meta text-muted-foreground">Rung</span>
        <span className="text-meta text-muted-foreground">shadow-* + border</span>
        <span className="text-meta text-muted-foreground">shadow-ring-* (no border)</span>
        {LEVELS.map((l) => (
          <div key={l.utility} className="contents">
            <div className="flex flex-col gap-1">
              <code className="text-code text-foreground">{l.utility}</code>
              <span className="text-meta text-muted-foreground">{l.use}</span>
            </div>
            <Tile label={l.plain} cls={l.plain} bordered />
            <Tile label={l.ring} cls={l.ring} />
          </div>
        ))}
      </div>
    </div>
  ),
};

export const TheDoubleEdge: Story = {
  name: "Why the ring (the double edge)",
  render: () => (
    <div className="space-y-5">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        A <code className="text-code">border</code> next to a{" "}
        <code className="text-code">shadow</code> draws <strong>two</strong> stacked edges: a crisp
        1px stroke, then a soft one starting just outside it. The ring rungs put the hairline{" "}
        <em>inside</em> the shadow, so it is one continuous edge. Zoom in on the corners.
      </p>
      <div className="grid gap-6 sm:grid-cols-2">
        <figure className="m-0 flex flex-col gap-3">
          {/* elevation-check-ignore -- this IS the anti-pattern; the story exists to show it. */}
          <div className="flex h-28 items-center justify-center rounded-lg border border-border bg-card shadow-md">
            <code className="text-code text-muted-foreground">border + shadow-md</code>
          </div>
          <figcaption className="text-caption text-destructive-text">
            Two edges — the pattern the ramp replaces.
          </figcaption>
        </figure>
        <figure className="m-0 flex flex-col gap-3">
          <div className="flex h-28 items-center justify-center rounded-lg bg-card shadow-ring-md">
            <code className="text-code text-muted-foreground">shadow-ring-md</code>
          </div>
          <figcaption className="text-caption text-muted-foreground">
            One edge, dissolving into the shadow.
          </figcaption>
        </figure>
      </div>
    </div>
  ),
};

export const Hairline: Story = {
  name: "shadow-hairline (edge without lift)",
  render: () => (
    <div className="space-y-5">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        The ring layer alone — a 1px edge that takes no layout box, for a control whose metrics a{" "}
        <code className="text-code">border</code> would change. Retint it per element with the
        arbitrary property <code className="text-code">[--shadow-ring-color:var(--token)]</code>,
        the same seam every ring rung reads.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-10 items-center rounded-md bg-background px-4 shadow-hairline">
          <code className="text-code text-muted-foreground">shadow-hairline</code>
        </div>
        <div className="flex h-10 items-center rounded-md bg-background px-4 shadow-hairline [--shadow-ring-color:var(--primary)]">
          <code className="text-code text-muted-foreground">
            + [--shadow-ring-color:var(--primary)]
          </code>
        </div>
      </div>
    </div>
  ),
};

export const StrengthDial: Story = {
  name: "The strength dial",
  render: () => (
    <div className="space-y-5">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        <code className="text-code">--shadow-strength</code> multiplies every layer&rsquo;s alpha,
        so a theme or a region can deepen or remove elevation without touching a component. The
        hairline is deliberately <strong>outside</strong> the dial — at strength 0 the surface stops
        being lit but keeps its drawn edge. This is what{" "}
        <code className="text-code">data-decoration=&quot;10&quot;</code> and the blueprint theme
        use.
      </p>
      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: "0 — shadowless", style: { "--shadow-strength": "0" } },
          { label: "1 — theme default", style: undefined },
          { label: "3 — deepened", style: { "--shadow-strength": "3" } },
        ].map((d) => (
          <figure key={d.label} className="m-0 flex flex-col gap-3">
            <div
              className="flex h-24 items-center justify-center rounded-lg bg-card shadow-ring-lg"
              style={d.style as React.CSSProperties}
            >
              <code className="text-code text-muted-foreground">shadow-ring-lg</code>
            </div>
            <figcaption className="text-caption text-muted-foreground">{d.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  ),
};
