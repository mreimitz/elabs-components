import type { Meta, StoryObj } from "@storybook/react-vite";

import { BentoGrid, BentoGridItem } from "./bento-grid";

const meta = {
  title: "Layout/BentoGrid",
  component: BentoGrid,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof BentoGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

function Tile({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex h-full min-w-0 flex-col p-5">
      <h3 className="text-subtitle font-medium text-foreground">{title}</h3>
      {body ? <p className="mt-1 min-w-0 text-body text-muted-foreground">{body}</p> : null}
    </div>
  );
}

/**
 * A 6-tile overview: one hero (2×2, gradient wash) + five supporting tiles.
 *
 * The grid rests FLAT — no tile carries an elevation at rest, so the sheet reads
 * as one plane. Hover a tile and it alone lifts to `shadow-lg`.
 */
export const Default: Story = {
  render: () => (
    <div className="p-6">
      <BentoGrid>
        <BentoGridItem size="hero">
          <Tile
            title="Revenue"
            body="Up 24% this quarter — the headline the team opens the dashboard for. Hover any tile: it lifts, the rest stay flat."
          />
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile title="Active users" body="12,480" />
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile title="Churn" body="1.2%" />
        </BentoGridItem>
        <BentoGridItem size="md">
          <Tile title="Pipeline" body="38 deals in flight across 4 stages" />
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile title="NPS" body="62" />
        </BentoGridItem>
        <BentoGridItem size="sm">
          <Tile title="Open tickets" body="7" />
        </BentoGridItem>
      </BentoGrid>
    </div>
  ),
};

/**
 * Clickable tiles via the stretched-link pattern: an inner `<a className="absolute
 * inset-0">` makes the whole tile a single link, and `interactive` gives it a
 * pointer cursor + a `focus-within` ring (keyboard-visible).
 */
export const Interactive: Story = {
  render: () => (
    <div className="p-6">
      <BentoGrid>
        <BentoGridItem size="hero" interactive>
          <a href="#revenue" aria-label="Revenue" className="absolute inset-0 z-30" />
          <Tile title="Revenue →" body="The whole tile is one link (stretched inner anchor)." />
        </BentoGridItem>
        <BentoGridItem interactive>
          <a href="#users" aria-label="Users" className="absolute inset-0 z-30" />
          <Tile title="Users →" body="12,480" />
        </BentoGridItem>
        <BentoGridItem interactive>
          <a href="#churn" aria-label="Churn" className="absolute inset-0 z-30" />
          <Tile title="Churn →" body="1.2%" />
        </BentoGridItem>
        <BentoGridItem size="md" interactive>
          <a href="#pipeline" aria-label="Pipeline" className="absolute inset-0 z-30" />
          <Tile title="Pipeline →" body="38 deals" />
        </BentoGridItem>
      </BentoGrid>
    </div>
  ),
};

/**
 * The cursor-following spotlight is OPT-IN. Set `spotlight` on the `BentoGrid`
 * to enable it for every tile; a tile's own `spotlight` prop still wins, so one
 * tile can opt back out. Suppressed entirely under OS reduced-motion — the hover
 * elevation carries the interaction on its own there.
 */
export const Spotlight: Story = {
  render: () => (
    <div className="p-6">
      <BentoGrid spotlight>
        <BentoGridItem size="hero">
          <Tile
            title="Revenue"
            body="A primary-tinted glow follows the cursor across the tile, on top of the hover lift."
          />
        </BentoGridItem>
        <BentoGridItem>
          <Tile title="Active users" body="12,480" />
        </BentoGridItem>
        <BentoGridItem>
          <Tile title="Churn" body="1.2%" />
        </BentoGridItem>
        <BentoGridItem size="md" spotlight={false}>
          <Tile title="Opted out" body="spotlight={false} — lifts on hover, no glow." />
        </BentoGridItem>
      </BentoGrid>
    </div>
  ),
};

/** Explicit `span` overrides the size presets for bespoke layouts. */
export const ExplicitSpans: Story = {
  render: () => (
    <div className="p-6">
      <BentoGrid>
        <BentoGridItem span={{ col: 3, row: 1 }}>
          <Tile title="Wide banner" body="span={{ col: 3 }}" />
        </BentoGridItem>
        <BentoGridItem span={{ col: 1, row: 2 }}>
          <Tile title="Tall rail" body="span={{ row: 2 }}" />
        </BentoGridItem>
        <BentoGridItem>
          <Tile title="A" />
        </BentoGridItem>
        <BentoGridItem>
          <Tile title="B" />
        </BentoGridItem>
        <BentoGridItem>
          <Tile title="C" />
        </BentoGridItem>
      </BentoGrid>
    </div>
  ),
};

/** Edge states: a very long unbroken string (must not overflow) and a per-tile spotlight opt-in. */
export const EdgeStates: Story = {
  render: () => (
    <div className="p-6">
      <BentoGrid>
        <BentoGridItem size="md">
          <Tile
            title="Long content"
            body="supercalifragilisticexpialidocious-antidisestablishmentarianism-pneumonoultramicroscopicsilicovolcanoconiosis"
          />
        </BentoGridItem>
        <BentoGridItem spotlight>
          <Tile title="Spotlight" body="spotlight — on one tile only" />
        </BentoGridItem>
        <BentoGridItem>
          <Tile title="Plain" />
        </BentoGridItem>
      </BentoGrid>
    </div>
  ),
};
