"use client";

/**
 * Editorial marks — the vocabulary sheet (RM-017).
 *
 * One 400×320 canvas carrying all ten marks at once, so the layer can be read as
 * a VOCABULARY rather than as ten unrelated components. The sheet is the surface
 * the acceptance criteria are checked on:
 *
 * - `Vocabulary` renders in whatever theme the toolbar (or `STORYBOOK_THEME`) is
 *   set to, so the same story proves light and dark — `HaloText`'s halo follows
 *   `--chart-background`, so on a dark card it is a DARK halo, with no `dark:`
 *   override anywhere. There is no hard-coded light preview to be fooled by.
 * - `VocabularyDecorated` pins `data-decoration="10"` and `VocabularyPlain` pins
 *   `data-decoration="0"`, which is how the sheet is read at both ends of the
 *   decoration dial in one place.
 *
 * The canvas is `aria-hidden` and paired with a text description, exactly as a
 * real chart body is (`.claude/rules/chart-components.md`): a mark never carries
 * the only copy of a fact.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { DrawPath } from "./draw-path";
import { HairlineFloor } from "./hairline-floor";
import { HaloText } from "./halo-text";
import { Leader } from "./leader";
import { Marginalia } from "./marginalia";
import { PeakRing } from "./peak-ring";
import { QuietDot } from "./quiet-dot";
import { seededRnd } from "./seeded-rnd";
import { CHART_STAGGER_DOT_MS, stagger } from "./stagger";
import { UnitStack } from "./unit-stack";

const WIDTH = 400;
const HEIGHT = 320;

/** Twelve months of a made-up series, in the sheet's own coordinates. */
const MONTHS = Array.from({ length: 12 }, (_m, i) => i);
const SERIES = [42, 51, 38, 64, 57, 73, 88, 69, 61, 47, 55, 40];
const PEAK = SERIES.indexOf(Math.max(...SERIES));

const monthX = (m: number) => 40 + m * 26;
const valueY = (v: number) => 150 - v * 0.9;

const seriesPath = SERIES.map((v, i) => `${i === 0 ? "M" : "L"} ${monthX(i)} ${valueY(v)}`).join(
  " ",
);

/**
 * The vocabulary sheet. Ten marks, labelled, on one canvas.
 */
function VocabularySheet() {
  return (
    <svg
      aria-hidden="true"
      className="rounded-lg bg-card"
      data-testid="marks-sheet"
      height={HEIGHT}
      role="presentation"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
    >
      {/* 1. DrawPath — the series draws itself in, no measurement step. */}
      <DrawPath
        d={seriesPath}
        delay={stagger(0, 0, CHART_STAGGER_DOT_MS)}
        stroke="var(--chart-1)"
        strokeWidth={1.5}
      />

      {/* 2. QuietDot — a measured zero is a pinprick, never a hole. */}
      {SERIES.map((_v, i) => (
        <QuietDot cx={monthX(i)} cy={162} key={`quiet-${i}`} />
      ))}

      {/* 3. PeakRing — emphasis by shape, so it survives greyscale. */}
      <PeakRing cx={monthX(PEAK)} cy={valueY(SERIES[PEAK] ?? 0)} r={7} />

      {/* 4. HaloText — a value label directly ON the mark. */}
      <HaloText
        fontSize={11}
        textAnchor="middle"
        x={monthX(PEAK)}
        y={valueY(SERIES[PEAK] ?? 0) - 12}
      >
        {SERIES[PEAK]}
      </HaloText>

      {/* 5. Leader — the quiet 1 3 rhythm, tying a label to its mark. */}
      <Leader dash="1 3" from={[monthX(1), valueY(SERIES[1] ?? 0)]} to={[30, 40]} />
      <HaloText fontSize={10} textAnchor="start" x={16} y={34}>
        opening
      </HaloText>

      {/* 6. Marginalia — the analyst's own remark, italic, in the margin. */}
      <Marginalia anchor={[monthX(9), valueY(SERIES[9] ?? 0)]} x={296} y={214}>
        the week the queue cleared
      </Marginalia>

      {/* 7. HairlineFloor — the passage of time in 0.55px of ink. */}
      <HairlineFloor every={3} periods={MONTHS} scale={monthX} y={176} />

      {/* 8. PeakRing, square — the same call, for a matrix cell. */}
      <PeakRing cx={54} cy={252} r={9} shape="square" />
      <HaloText fontSize={9} textAnchor="middle" x={54} y={276}>
        cell
      </HaloText>

      {/* 9. UnitStack — countable rungs, jittered through seededRnd. */}
      <UnitStack
        direction="up"
        jitter
        kind="rung"
        length={14}
        markEvery={5}
        n={18}
        seed={7}
        stroke="var(--chart-2)"
        x={130}
        y={268}
      />
      <HaloText fontSize={9} textAnchor="middle" x={130} y={286}>
        rungs
      </HaloText>

      {/* 10. UnitStack, ticks and dots — the other two countable forms. */}
      <UnitStack direction="up" kind="tick" length={9} n={14} seed={11} x={196} y={268} />
      <HaloText fontSize={9} textAnchor="middle" x={200} y={286}>
        ticks
      </HaloText>
      <UnitStack
        direction="right"
        kind="dot"
        length={3.5}
        n={16}
        seed={13}
        step={6}
        x={252}
        y={250}
      />
      <HaloText fontSize={9} textAnchor="start" x={252} y={286}>
        dots
      </HaloText>

      {/* seededRnd, shown rather than told: a deterministic scatter. */}
      {Array.from({ length: 14 }, (_dot, i) => (
        <QuietDot
          cx={252 + seededRnd(i, 3) * 120}
          cy={228 - seededRnd(i, 5) * 14}
          key={`seed-${i}`}
          size={2}
        />
      ))}
    </svg>
  );
}

/** The sheet plus the description that carries its meaning to assistive tech. */
function Sheet({ decoration }: { decoration?: string }) {
  return (
    <figure className="m-0 inline-flex flex-col gap-2" data-decoration={decoration}>
      <VocabularySheet />
      <figcaption className="max-w-[400px] text-meta text-muted-foreground">
        Ten editorial marks on one canvas: a self-drawing series with a ringed peak and a halo value
        label, a dashed leader, an italic marginal note, a hairline floor of twelve months, a row of
        quiet dots, and three countable unit stacks (rungs, ticks, dots).
      </figcaption>
    </figure>
  );
}

const meta = {
  title: "Charts/Editorial Marks",
  component: HaloText,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The shared low-level drawing vocabulary behind every editorial chart (RM-017): `HaloText`, `Leader`, `PeakRing`, `Marginalia`, `HairlineFloor`, `QuietDot`, `UnitStack`, `seededRnd`, `stagger` and `DrawPath`. Each mark is a bare SVG element or `<g>` with no provider, so it composes inside any chart's children. Semantic tokens only — the halo follows `--chart-background`, which is why it is dark on a dark card.",
      },
    },
  },
} satisfies Meta<typeof HaloText>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * All ten marks on one 400×320 canvas, in the ambient theme. Switch the theme
 * toolbar to read the same sheet in dark — nothing here is theme-forked.
 */
export const Vocabulary: Story = {
  render: () => <Sheet />,
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector('[data-testid="marks-sheet"]');
    expect(svg).not.toBeNull();

    // Every mark in the vocabulary is on the sheet.
    for (const slot of [
      "draw-path",
      "quiet-dot",
      "peak-ring",
      "halo-text",
      "leader",
      "marginalia",
      "hairline-floor",
      "unit-stack",
    ]) {
      expect(svg?.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }

    // The halo is a TOKEN, not a literal — this is what makes the sheet
    // theme-safe rather than merely light-theme-correct.
    const halo = svg?.querySelector('[data-slot="halo-text"]');
    expect(halo?.getAttribute("stroke")).toBe("var(--chart-background)");
    expect(halo?.getAttribute("paint-order")).toBe("stroke");

    // …and the token resolves to the SHEET'S OWN GROUND, whichever theme is
    // running. That is the theme-safety claim stated as an assertion rather than
    // as a colour literal: on the dark card the halo is measured dark, because
    // `--chart-background` is `--card`, and this equality holds in both themes.
    // (Run the same story under `STORYBOOK_THEME=dark` to measure the other one —
    // a headless run has no toolbar, so one run measures exactly one theme.)
    const haloInk = getComputedStyle(halo as Element).stroke;
    const ground = getComputedStyle(svg as Element).backgroundColor;
    expect(haloInk).not.toBe("");
    expect(haloInk).not.toBe("none");
    expect(haloInk).toBe(ground);

    // The theme actually governing this subtree — resolved FROM the subject, not
    // guessed at an ancestor, so a decorator that moved `data-theme` cannot make
    // the claim above quietly vacuous.
    const governing = (svg as Element).closest("[data-theme]")?.getAttribute("data-theme");
    expect(governing).toBeTruthy();

    // The floor draws one tick per period — never a decimated selection.
    expect(svg?.querySelectorAll('[data-slot="hairline-floor"] line')).toHaveLength(12);

    // The chart body stays out of the accessibility tree; the caption carries it.
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  },
};

/**
 * The same sheet inside a `data-decoration="10"` region — the top of the
 * decoration dial, where surfaces go shadowless and the drafting ground fades in
 * behind. The marks are unchanged: they are ink, and the dial paints grounds.
 */
export const VocabularyDecorated: Story = {
  globals: { decoration: "10" },
  render: () => <Sheet decoration="10" />,
};

/**
 * The same sheet pinned to `data-decoration="0"` — the plain end of the dial, and
 * the proof that the marks owe nothing to decoration.
 */
export const VocabularyPlain: Story = {
  globals: { decoration: "0" },
  render: () => <Sheet decoration="0" />,
};
