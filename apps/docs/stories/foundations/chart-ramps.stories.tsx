import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The ORDERED chart ramps (RM-018) — the half of the chart palette where
 * **lightness is the data**.
 *
 * `--chart-1 … --chart-12` (see `Foundations/Colors`) is CATEGORICAL: it answers
 * *which series*. The four ramps below are ORDINAL: they answer *how much*, for
 * every chart whose colour encodes a magnitude — heatmap, calendar, treemap,
 * matrix, choropleth, signed bars.
 *
 * Read every swatch in BOTH themes (toolbar → `light` / `dark`). Ramp direction
 * is a property of the theme's plot ground, not of the token names: on the light
 * theme's white `--chart-background` "more intense" renders DARKER, on the dark
 * theme it renders lighter. Step 7 is the most intense in both.
 */
const meta = {
  title: "Foundations/ChartRamps",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The ordered chart ramps — sequential, diverging, mono and accent — defined once " +
          "per theme in `@elabs-ai/components-tokens` `themes.css` and exposed to Tailwind via " +
          "`@theme inline` (`bg-chart-seq-4`, `bg-chart-div-pos-2`, `bg-chart-mono-7`, " +
          "`bg-chart-accent`). Reach for them through `resolvePalette()` in " +
          "`@elabs-ai/components-charts` rather than naming steps by hand.",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** One ramp: its tokens in ramp order, plus what it is for. */
type Ramp = {
  /** Heading. */
  name: string;
  /** One sentence: when to reach for it. */
  blurb: string;
  /** CSS variables, in ramp order (quietest → most intense). */
  vars: string[];
  /** Short label under each swatch. */
  labels: string[];
};

const seq = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `--chart-${prefix}-${i + 1}`);

const RAMPS: Ramp[] = [
  {
    name: "Sequential",
    blurb:
      "One hue, seven lightness steps, step 7 the most intense. The default for any chart whose colour IS the number: heatmap, calendar, treemap, choropleth. Step 1 is the quiet step — the only member below the 3:1 mark bar, held above 1.5:1 so a single low cell still reads as a pinprick.",
    vars: seq("seq", 7),
    labels: ["1 quiet", "2", "3", "4", "5", "6", "7 most intense"],
  },
  {
    name: "Diverging",
    blurb:
      "Signed data around a meaningful zero: signed bars, a correlation matrix. The negative arm rides the blue family and the positive arm the brand lime, meeting at a neutral middle. The mid clears 3:1 like every other step, because a zero-valued cell is still a drawn cell.",
    vars: [
      "--chart-div-neg-2",
      "--chart-div-neg-1",
      "--chart-div-mid",
      "--chart-div-pos-1",
      "--chart-div-pos-2",
    ],
    labels: ["neg-2", "neg-1", "mid", "pos-1", "pos-2"],
  },
  {
    name: "Mono",
    blurb:
      "The neutral ladder (chroma ≤ 0.02). A categorical chart past six series falls back to it automatically — seven-plus hues stop distinguishing anything a legend can hold. Also the ground of the accent palette below.",
    vars: seq("mono", 7),
    labels: ["1 quiet", "2", "3", "4", "5", "6", "7 most intense"],
  },
  {
    name: "Accent (the wire look)",
    blurb:
      "The neutral ladder with ONE hero colour on top, for the series that is actually the point. `--chart-accent` is an alias of `--chart-1`, so a re-brand reaches it for free.",
    vars: ["--chart-accent", "--chart-mono-2", "--chart-mono-4", "--chart-mono-6"],
    labels: ["accent", "mono-2", "mono-4", "mono-6"],
  },
];

function Swatch({ varName, label }: { varName: string; label: string }) {
  return (
    <figure className="m-0 min-w-24 flex-1 overflow-hidden rounded-md border border-border-strong bg-card">
      <div className="h-14" style={{ background: `var(${varName})` }} />
      <figcaption className="space-y-0.5 border-t border-border p-2">
        <code className="block text-code text-foreground">{varName}</code>
        <span className="block text-meta text-muted-foreground">{label}</span>
      </figcaption>
    </figure>
  );
}

function RampRow({ ramp }: { ramp: Ramp }) {
  const headingId = `ramp-${ramp.name.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div className="space-y-1">
        <h3 id={headingId} className="text-subtitle text-foreground">
          {ramp.name}
        </h3>
        <p className="m-0 max-w-prose text-caption text-muted-foreground">{ramp.blurb}</p>
      </div>
      {/* The plot ground the contrast bar is measured against, so the swatches
          are judged where they actually render — not on the page ground. */}
      <div className="flex flex-wrap gap-2 rounded-md bg-chart-background p-3">
        {ramp.vars.map((varName, i) => (
          <Swatch key={varName} varName={varName} label={ramp.labels[i] ?? ""} />
        ))}
      </div>
    </section>
  );
}

/**
 * All four ramps, on the chart plot ground. Flip the toolbar theme to see the
 * direction reverse: the ladder runs light → dark on `light` and dark → light on
 * `dark`, and step 7 stays the most intense in both.
 */
export const Default: Story = {
  render: () => (
    <div className="space-y-8">
      {RAMPS.map((ramp) => (
        <RampRow key={ramp.name} ramp={ramp} />
      ))}
    </div>
  ),
};

/**
 * The ramps doing their job: a 7 × 5 grid of cells coloured by value. Nothing
 * here names a step — a real chart calls `resolvePalette("sequential", n)` and
 * gets these back in order.
 */
export const AsAHeatmap: Story = {
  render: () => {
    const rows = Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 7 }, (_, c) => ((r * 3 + c * 2) % 7) + 1),
    );
    return (
      <div className="space-y-3">
        <p className="m-0 max-w-prose text-caption text-muted-foreground">
          Each cell fills from <code className="text-code">--chart-seq-N</code> where N is its
          bucket. The quiet step is visible as a cell without competing with the loud ones.
        </p>
        <div className="inline-block rounded-md bg-chart-background p-3">
          <div className="grid grid-cols-7 gap-1">
            {rows.flatMap((row, r) =>
              row.map((step, c) => (
                <div
                  key={`${r}-${c}`}
                  className="size-8 rounded-xs"
                  style={{ background: `var(--chart-seq-${step})` }}
                  title={`bucket ${step} of 7`}
                />
              )),
            )}
          </div>
        </div>
      </div>
    );
  },
};
