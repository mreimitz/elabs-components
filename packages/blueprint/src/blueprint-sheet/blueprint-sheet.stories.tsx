/* eslint-disable brand/no-raw-font-size -- Blueprint drafting typography (mono, fixed drafting sizes) is a decorative aesthetic, not content hierarchy; the raw sizes are intentional. */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BlueprintSheet } from "./blueprint-sheet";
import { BlueprintFrame } from "../blueprint-frame";
import { TitleBlock } from "../title-block";
import { PlaceholderBox } from "../placeholder-box";
import { DimensionLine } from "../dimension-line";
import { FigAnnotation } from "../fig-annotation";
import { Callout } from "../callout";
import { RegistrationMark } from "../crosshair";

/**
 * The page-level frame (corner ticks + one title block). Wrap a screen ONCE.
 * The grid ground comes from the theme; furniture is placed sparingly, by role —
 * see `.claude/rules/blueprint-decoration.md`.
 */
const meta = {
  title: "Blueprint/Sheet",
  component: BlueprintSheet,
  tags: ["autodocs"],
  globals: { theme: "blueprint" },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BlueprintSheet>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <BlueprintSheet
      label="Sheet"
      registrationMark
      className="min-h-[460px] bg-background p-10"
      titleBlock={
        <TitleBlock
          title="Atlas · Sheet"
          scale="1:1"
          sheet="A-01"
          revision="A"
          className="border-0"
        />
      }
    >
      <div className="space-y-5">
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-foreground">
          Sheet frame
        </h1>
        <p className="max-w-md font-mono text-body text-muted-foreground">
          One sheet, one frame: corner ticks + a single title block. The grid comes from the theme;
          inner panels stay plain — hairline border, no extra furniture.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-rule bg-card p-4">
            <p className="font-mono text-body text-foreground">Plain panel</p>
            <p className="font-mono text-meta text-muted-foreground">grid + hairline only</p>
          </div>
          <div className="border border-rule bg-card p-4">
            <p className="font-mono text-body text-foreground">Plain panel</p>
            <p className="font-mono text-meta text-muted-foreground">grid + hairline only</p>
          </div>
        </div>
      </div>
    </BlueprintSheet>
  ),
};

export const FeatureSheet: Story = {
  render: () => (
    <BlueprintSheet
      label="Feature sheet"
      registrationMark
      className="min-h-screen bg-background p-8"
      titleBlock={
        <TitleBlock
          title="Motion · Feature Sheet"
          scale="1:1"
          sheet="M-01"
          revision="A"
          drawnBy="qLabs"
          date="2026-06-06"
          className="border-0"
        />
      }
    >
      <div className="mx-auto max-w-5xl space-y-8">
        {/* ② emphasis: one hatched hero band (the only hatch on the sheet) */}
        <div className="border border-rule bg-hatch px-6 py-10">
          <p className="font-mono text-meta uppercase tracking-[0.3em] text-muted-foreground">
            // Production-grade
          </p>
          <h1 className="mt-2 font-mono text-4xl font-bold uppercase tracking-tight text-foreground">
            Featured Title
          </h1>
          <p className="mt-3 max-w-xl font-mono text-body text-muted-foreground">
            White ink on a cyanotype ground; the grid is the only thing everywhere.
          </p>
          {/* ③ annotation: one dimension line, on the thing being measured */}
          <div className="mt-6">
            <DimensionLine label="1280 px" length={320} />
          </div>
        </div>

        {/* ③ annotation: image slots → ✕ placeholders + FIG (earned by role) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <figure className="space-y-2">
            <PlaceholderBox label="illustration 1" className="h-40" />
            <FigAnnotation figNumber={1} caption="Independent transforms." />
          </figure>
          <figure className="space-y-2">
            <PlaceholderBox label="illustration 2" className="h-40" />
            <FigAnnotation figNumber={2} caption="Scroll-linked motion." />
          </figure>
          <figure className="space-y-2">
            <PlaceholderBox label="illustration 3" className="h-40" />
            <FigAnnotation figNumber={3} caption="Spring physics." />
          </figure>
        </div>

        {/* ③ annotation: explained parts → callouts (one set) */}
        <div className="flex flex-wrap items-start gap-10 border-t border-rule pt-6">
          <Callout number={1} label="Layout animation" leader="elbow" leaderLength={44} />
          <Callout number={2} label="Exit animation" leader="line" leaderLength={40} />
          <Callout number={3} label="Motion values" leader="elbow" leaderLength={44} />
        </div>
      </div>
    </BlueprintSheet>
  ),
};

/**
 * Teaching story: the SAME content, decorated tastefully (left) vs over-decorated
 * (right). The budget is "one focal gesture per region; grid carries the rest."
 */
export const TastefulVsOverloaded: Story = {
  render: () => (
    <div className="grid min-h-[520px] grid-cols-2 gap-6 bg-background p-8">
      {/* DO — sparse, role-driven */}
      <section className="space-y-3">
        <p className="font-mono text-meta uppercase tracking-widest text-foreground">Tasteful ✓</p>
        <div className="border border-rule bg-card p-4">
          <p className="font-mono text-meta uppercase tracking-wider text-muted-foreground">
            Total revenue
          </p>
          <p className="font-mono text-3xl font-bold text-foreground">$48.2M</p>
          <p className="font-mono text-meta text-muted-foreground">+12.4% QoQ</p>
        </div>
        <figure className="space-y-2">
          <PlaceholderBox label="chart" className="h-32" />
          <FigAnnotation figNumber={1} caption="Quarterly revenue." />
        </figure>
        <p className="font-mono text-[11px] text-muted-foreground">
          grid + hairlines do the work; one ✕ slot + one FIG.
        </p>
      </section>

      {/* DON'T — furniture on everything */}
      <section className="space-y-3">
        <p className="font-mono text-meta uppercase tracking-widest text-foreground">
          Overloaded ✗
        </p>
        <BlueprintFrame label="kpi" inset="sm" className="bg-card">
          <RegistrationMark className="absolute right-1 top-1" size={16} />
          <p className="font-mono text-meta uppercase tracking-wider text-muted-foreground">
            Total revenue
          </p>
          <p className="font-mono text-3xl font-bold text-foreground">$48.2M</p>
          <DimensionLine label="+12.4%" length={120} ends="tick" />
          <Callout number={1} label="QoQ" leader="elbow" leaderLength={28} />
        </BlueprintFrame>
        <BlueprintFrame label="chart" inset="sm" className="bg-card bg-hatch">
          <PlaceholderBox label="chart" className="h-32" />
          <DimensionLine label="320 px" length={160} />
          <FigAnnotation figNumber={1} caption="Quarterly revenue." />
          <Callout number={2} label="axis" leader="elbow" leaderLength={28} />
        </BlueprintFrame>
        <p className="font-mono text-[11px] text-muted-foreground">
          ticks + dims + callouts + hatch everywhere → noise, not a blueprint.
        </p>
      </section>
    </div>
  ),
};
