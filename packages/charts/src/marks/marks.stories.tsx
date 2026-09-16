"use client";

/**
 * Editorial marks — the vocabulary sheet (RM-017).
 *
 * A SPECIMEN SHEET: one labelled cell per mark on a single SVG, so the layer
 * reads as a vocabulary of ten distinct marks rather than as one chart with
 * debris on it (#186). Each specimen is isolated in its cell by a hairline
 * divider; nothing overlaps a neighbour. The sheet is the surface the
 * acceptance criteria are checked on:
 *
 * - `Vocabulary` renders in whatever theme the toolbar (or `STORYBOOK_THEME`) is
 *   set to, so the same story proves light and dark — `HaloText`'s halo follows
 *   `--chart-background`, so on a dark card it is a DARK halo, with no `dark:`
 *   override anywhere.
 * - `VocabularyDecorated` and `VocabularyPlain` put the sheet on an opt-in
 *   drafting ground (`data-decoration-fade`) at decoration 10 and 0. The marks
 *   are ink and do not change; what the dial does is paint the ground BEHIND
 *   them — visible at 10, transparent at 0 — and the halo cuts that ground away
 *   around every label, which is the halo doing its job on a busy surface.
 *
 * The canvas is `aria-hidden` (and every mark is hidden on its own root too) and
 * is paired with a caption that restates what the specimens encode, exactly as a
 * real chart body is (`.claude/rules/charts.md` § Marks): a mark never carries
 * the only copy of a fact.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { CHART_HAIRLINE_WIDTH } from "../chart-hairline";
import { DrawPath } from "./draw-path";
import { HairlineFloor } from "./hairline-floor";
import { HaloText } from "./halo-text";
import { Leader } from "./leader";
import { Marginalia } from "./marginalia";
import { PeakRing } from "./peak-ring";
import { QuietDot } from "./quiet-dot";
import { seededRnd } from "./seeded-rnd";
import { CHART_STAGGER_BAR_MS, CHART_STAGGER_DOT_MS, stagger } from "./stagger";
import { UnitStack } from "./unit-stack";

const COL = 160;
const ROW = 112;
const WIDTH = COL * 3;
const HEIGHT = ROW * 4;

/** Twelve months of a made-up series. */
const SERIES = [42, 51, 38, 64, 57, 73, 88, 69, 61, 47, 55, 40];
const PEAK = SERIES.indexOf(Math.max(...SERIES));
const PEAK_VALUE = SERIES[PEAK] ?? 0;
const MONTHS = Array.from({ length: 12 }, (_m, i) => i);
const MONTH_LABELS: Record<number, string> = { 0: "Jan", 3: "Apr", 6: "Jul", 9: "Oct" };

/** A 6 × 4 matrix; the zeros are what `QuietDot` draws. */
const MATRIX = [
  [3, 0, 5, 2, 0, 4],
  [1, 4, 0, 0, 2, 5],
  [0, 2, 3, 1, 0, 3],
  [4, 0, 1, 5, 2, 0],
];
const MATRIX_ZEROS = MATRIX.flat().filter((v) => v === 0).length;

const MARGINAL_NOTE = "the week the queue cleared";
const RING_R = 7;
const STAGGER_BARS = 8;
const STAGGER_LAST_MS = Math.round(stagger(STAGGER_BARS - 1, 0, CHART_STAGGER_BAR_MS) * 1000);

/** A series path over `width` px from (x0, baseY), `scale` px per unit. */
function seriesPoint(i: number, x0: number, baseY: number, scale: number) {
  return { x: x0 + 14 + i * 12, y: baseY - (SERIES[i] ?? 0) * scale };
}
function seriesPath(x0: number, baseY: number, scale: number) {
  return SERIES.map((_v, i) => {
    const p = seriesPoint(i, x0, baseY, scale);
    return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
  }).join(" ");
}

/** Cell dividers: full-width row rules, and the column rules each row actually has. */
const DIVIDERS: Array<[x1: number, y1: number, x2: number, y2: number]> = [
  [0, ROW, WIDTH, ROW],
  [0, ROW * 2, WIDTH, ROW * 2],
  [0, ROW * 3, WIDTH, ROW * 3],
  [COL, 0, COL, ROW],
  [COL * 2, 0, COL * 2, ROW * 3],
  [COL, ROW * 3, COL, HEIGHT],
  [COL * 2, ROW * 3, COL * 2, HEIGHT],
];

/** The name of a specimen, top-left of its cell, and an optional note at its foot. */
function SpecimenLabel({
  col,
  row,
  name,
  note,
}: {
  col: number;
  row: number;
  name: string;
  note?: string;
}) {
  const x = col * COL + 10;
  const y = row * ROW;
  return (
    <>
      <HaloText data-specimen={name} fontSize={10} fontWeight={600} x={x} y={y + 16}>
        {name}
      </HaloText>
      {note ? (
        <HaloText fill="var(--chart-foreground-muted)" fontSize={9} x={x} y={y + ROW - 8}>
          {note}
        </HaloText>
      ) : null}
    </>
  );
}

/**
 * The vocabulary sheet. Ten marks, one labelled cell each.
 */
function VocabularySheet({ grounded = true }: { grounded?: boolean }) {
  // Marginalia cell geometry (row 1, spanning columns 0–1).
  const margBase = ROW + 100;
  const peak = seriesPoint(PEAK, 0, margBase, 0.65);
  const noteX = 176;

  return (
    <svg
      aria-hidden="true"
      className={grounded ? "rounded-lg bg-card" : "rounded-lg"}
      data-testid="marks-sheet"
      height={HEIGHT}
      role="presentation"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
    >
      {DIVIDERS.map(([x1, y1, x2, y2]) => (
        <line
          key={`${x1}-${y1}-${x2}-${y2}`}
          stroke="var(--chart-grid)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
          x1={x1}
          x2={x2}
          y1={y1}
          y2={y2}
        />
      ))}

      {/* 1. DrawPath — the series draws itself in, no measurement step. */}
      <SpecimenLabel col={0} name="DrawPath" note="draws in, pathLength 1" row={0} />
      <DrawPath
        d={seriesPath(0, 92, 0.6)}
        delay={stagger(0, 0, CHART_STAGGER_DOT_MS)}
        stroke="var(--chart-1)"
        strokeWidth={1.5}
      />

      {/* 2. HaloText — a value label directly ON busy ink. */}
      <SpecimenLabel col={1} name="HaloText" note="halo clears grid and stroke" row={0} />
      {[48, 62, 76].map((gy) => (
        <line
          key={`grid-${gy}`}
          stroke="var(--chart-grid)"
          strokeWidth={CHART_HAIRLINE_WIDTH}
          x1={COL + 14}
          x2={COL * 2 - 14}
          y1={gy}
          y2={gy}
        />
      ))}
      <line
        stroke="var(--chart-1)"
        strokeWidth={1.5}
        x1={COL + 14}
        x2={COL * 2 - 14}
        y1={84}
        y2={40}
      />
      <HaloText
        dominantBaseline="middle"
        fontSize={16}
        fontWeight={600}
        textAnchor="middle"
        x={COL + 80}
        y={62}
      >
        {PEAK_VALUE}
      </HaloText>

      {/* 3. PeakRing — emphasis by shape, so it survives greyscale. */}
      <SpecimenLabel col={2} name="PeakRing" row={0} />
      <circle cx={COL * 2 + 48} cy={60} fill="var(--chart-foreground)" r={2.5} />
      <PeakRing cx={COL * 2 + 48} cy={60} r={8} />
      <rect fill="var(--chart-1)" height={12} width={12} x={COL * 2 + 106} y={54} />
      <PeakRing cx={COL * 2 + 112} cy={60} r={9} shape="square" />
      <HaloText
        fill="var(--chart-foreground-muted)"
        fontSize={9}
        textAnchor="middle"
        x={COL * 2 + 48}
        y={ROW - 8}
      >
        circle
      </HaloText>
      <HaloText
        fill="var(--chart-foreground-muted)"
        fontSize={9}
        textAnchor="middle"
        x={COL * 2 + 112}
        y={ROW - 8}
      >
        square
      </HaloText>

      {/* 4. Marginalia — the analyst's remark, tied to the ringed peak. */}
      <SpecimenLabel col={0} name="Marginalia" row={1} />
      <path
        d={seriesPath(0, margBase, 0.65)}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={1.5}
      />
      <PeakRing cx={peak.x} cy={peak.y} r={RING_R} />
      <Marginalia
        anchor={[peak.x + RING_R, peak.y]}
        data-testid="marks-marginalia"
        maxWidth={COL * 2 - noteX - 12}
        x={noteX}
        y={peak.y}
      >
        {MARGINAL_NOTE}
      </Marginalia>

      {/* 5. Leader — the two shapes and the two dash rhythms. */}
      <SpecimenLabel col={2} name="Leader" row={1} />
      {(
        [
          { kind: "elbow", dash: "2 3", y: ROW + 44 },
          { kind: "curve", dash: "1 3", y: ROW + 76 },
        ] as const
      ).map((l) => (
        <g key={l.kind}>
          <circle cx={COL * 2 + 20} cy={l.y} fill="var(--chart-foreground)" r={2} />
          <Leader
            dash={l.dash}
            from={[COL * 2 + 20, l.y]}
            kind={l.kind}
            to={[COL * 2 + 80, l.y + 14]}
          />
          <HaloText dominantBaseline="middle" fontSize={9} x={COL * 2 + 84} y={l.y + 14}>
            {`${l.kind} · ${l.dash}`}
          </HaloText>
        </g>
      ))}

      {/* 6. HairlineFloor — the passage of time in hairline ink. */}
      <SpecimenLabel
        col={0}
        name="HairlineFloor"
        note="one tick per month, every third long"
        row={2}
      />
      <HairlineFloor
        every={3}
        periods={MONTHS}
        scale={(m: number) => 24 + m * 24}
        y={ROW * 2 + 50}
      />
      {MONTHS.filter((m) => MONTH_LABELS[m]).map((m) => (
        <HaloText
          fill="var(--chart-foreground-muted)"
          fontSize={9}
          key={`month-${m}`}
          textAnchor="middle"
          x={24 + m * 24}
          y={ROW * 2 + 72}
        >
          {MONTH_LABELS[m]}
        </HaloText>
      ))}

      {/* 7. QuietDot — a measured zero is a pinprick, never a hole. */}
      <SpecimenLabel col={2} name="QuietDot" note="pinprick = measured zero" row={2} />
      {MATRIX.flatMap((cells, r) =>
        cells.map((v, c) => {
          const x = COL * 2 + 30 + c * 17;
          const y = ROW * 2 + 26 + r * 17;
          return v === 0 ? (
            <QuietDot cx={x + 7} cy={y + 7} key={`m-${r}-${c}`} />
          ) : (
            <rect
              fill="var(--chart-1)"
              fillOpacity={0.25 + v * 0.15}
              height={14}
              key={`m-${r}-${c}`}
              width={14}
              x={x}
              y={y}
            />
          );
        }),
      )}

      {/* 8. UnitStack — the three countable forms, in the same ink. */}
      <SpecimenLabel col={0} name="UnitStack" row={3} />
      <UnitStack
        direction="up"
        jitter
        kind="rung"
        length={14}
        markEvery={5}
        n={12}
        seed={7}
        x={36}
        y={ROW * 3 + 84}
      />
      <UnitStack direction="up" kind="tick" length={9} n={12} seed={11} x={80} y={ROW * 3 + 84} />
      <UnitStack
        direction="up"
        kind="dot"
        length={3.5}
        n={8}
        seed={13}
        step={5}
        x={126}
        y={ROW * 3 + 84}
      />
      {(
        [
          ["rungs", 36],
          ["ticks", 84],
          ["dots", 126],
        ] as const
      ).map(([label, x]) => (
        <HaloText
          fill="var(--chart-foreground-muted)"
          fontSize={9}
          key={label}
          textAnchor="middle"
          x={x}
          y={ROW * 4 - 8}
        >
          {label}
        </HaloText>
      ))}

      {/* 9. seededRnd — a deterministic scatter, identical on every render. */}
      <SpecimenLabel col={1} name="seededRnd" note="same scatter every render" row={3} />
      {Array.from({ length: 24 }, (_dot, i) => (
        <circle
          cx={COL + 20 + seededRnd(i, 3) * 120}
          cy={ROW * 3 + 30 + seededRnd(i, 5) * 52}
          fill="var(--chart-foreground)"
          key={`seed-${i}`}
          r={1.6}
        />
      ))}

      {/* 10. stagger — per-mark entrance delay, 100ms a bar. */}
      <SpecimenLabel col={2} name="stagger" note={`bars enter 0 → ${STAGGER_LAST_MS} ms`} row={3} />
      {Array.from({ length: STAGGER_BARS }, (_bar, i) => {
        const x = COL * 2 + 26 + i * 16;
        const top = ROW * 3 + 88 - (20 + seededRnd(i, 9) * 44);
        return (
          <DrawPath
            d={`M ${x} ${ROW * 3 + 88} V ${top}`}
            delay={stagger(i, 0, CHART_STAGGER_BAR_MS)}
            key={`bar-${x}`}
            stroke="var(--chart-foreground)"
            strokeWidth={6}
          />
        );
      })}
    </svg>
  );
}

/** The sheet plus the caption that carries what it encodes to assistive tech. */
function Sheet({ decoration }: { decoration?: string }) {
  const onGround = decoration !== undefined;
  return (
    <figure className="m-0 inline-flex flex-col gap-2" data-decoration={decoration}>
      {onGround ? (
        // An opt-in drafting ground behind the sheet: painted by the decoration
        // dial on a masked layer, so it shows at 10 and is transparent at 0.
        <div
          className="relative rounded-lg bg-card"
          data-decoration-fade="edges"
          data-testid="marks-ground"
        >
          <VocabularySheet grounded={false} />
        </div>
      ) : (
        <VocabularySheet />
      )}
      <figcaption className="max-w-[480px] text-meta text-muted-foreground">
        A reference sheet of the ten editorial marks, one labelled cell each: a twelve-month series
        drawing itself in; the value {PEAK_VALUE} haloed over gridlines and a stroke; dashed rings
        around a peak point and a matrix cell; the note “{MARGINAL_NOTE}” tied by a dotted leader to
        the ringed peak of the series; elbow and curve leaders; a floor of twelve monthly ticks,
        every third one longer and labelled; a 6 × 4 matrix whose {MATRIX_ZEROS} zero cells are
        pinpricks; rung, tick and dot unit stacks of 12, 12 and 8 units; a seeded scatter of 24
        points; and {STAGGER_BARS} bars entering {CHART_STAGGER_BAR_MS} ms apart.
      </figcaption>
    </figure>
  );
}

const meta = {
  title: "Charts/EditorialMarks",
  component: HaloText,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The shared low-level drawing vocabulary behind every editorial chart (RM-017): `HaloText`, `Leader`, `PeakRing`, `Marginalia`, `HairlineFloor`, `QuietDot`, `UnitStack`, `seededRnd`, `stagger` and `DrawPath`. Each mark is a bare SVG element or `<g>` with no provider, so it composes inside any chart’s children. Semantic tokens only — the halo follows `--chart-background`, which is why it is dark on a dark card.",
      },
    },
  },
} satisfies Meta<typeof HaloText>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shared checks: every mark present and labelled, and the note fits the canvas. */
function expectSheet(canvasElement: HTMLElement) {
  const svg = canvasElement.querySelector('[data-testid="marks-sheet"]');
  expect(svg).not.toBeNull();

  // Every mark in the vocabulary is on the sheet…
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
  // …and every one of the ten has its own labelled cell.
  const names = [...(svg?.querySelectorAll("[data-specimen]") ?? [])].map((el) =>
    el.getAttribute("data-specimen"),
  );
  expect(names).toEqual([
    "DrawPath",
    "HaloText",
    "PeakRing",
    "Marginalia",
    "Leader",
    "HairlineFloor",
    "QuietDot",
    "UnitStack",
    "seededRnd",
    "stagger",
  ]);

  // The marginal note wraps and renders IN FULL — no line runs past the canvas.
  const note = svg?.querySelector('[data-testid="marks-marginalia"]');
  const lines = [...(note?.querySelectorAll('[data-slot="marginalia-line"]') ?? [])];
  expect(lines.length).toBeGreaterThan(1);
  expect(lines.map((l) => l.textContent).join(" ")).toBe(MARGINAL_NOTE);
  for (const line of lines) {
    const tspan = line as SVGTSpanElement;
    const right = Number(tspan.getAttribute("x")) + tspan.getComputedTextLength();
    expect(right).toBeLessThanOrEqual(COL * 2);
  }

  // The leader starts at the ringed peak's edge, not at some other point.
  const ring = svg?.querySelectorAll('[data-slot="peak-ring"] circle');
  const peakRing = ring?.[ring.length - 1];
  const ringEdge = Number(peakRing?.getAttribute("cx")) + RING_R;
  const leaderD = note?.querySelector('[data-slot="leader"]')?.getAttribute("d") ?? "";
  expect(leaderD.startsWith(`M ${ringEdge} ${peakRing?.getAttribute("cy")}`)).toBe(true);

  // The floor draws one tick per period — never a decimated selection.
  expect(svg?.querySelectorAll('[data-slot="hairline-floor"] line')).toHaveLength(12);

  // The chart body stays out of the accessibility tree; the caption carries it.
  expect(svg?.getAttribute("aria-hidden")).toBe("true");
  return svg as SVGSVGElement;
}

/**
 * All ten marks on one specimen sheet, in the ambient theme. Switch the theme
 * toolbar to read the same sheet in dark — nothing here is theme-forked.
 */
export const Vocabulary: Story = {
  render: () => <Sheet />,
  play: async ({ canvasElement }) => {
    const svg = expectSheet(canvasElement);

    // The halo is a TOKEN, not a literal — this is what makes the sheet
    // theme-safe rather than merely light-theme-correct.
    const halo = svg.querySelector('[data-slot="halo-text"]');
    expect(halo?.getAttribute("stroke")).toBe("var(--chart-background)");
    expect(halo?.getAttribute("paint-order")).toBe("stroke");

    // …and the token resolves to the SHEET'S OWN GROUND, whichever theme is
    // running: `--chart-background` is declared as `var(--card)`, so on the dark
    // card the halo is measured dark. (Run under `STORYBOOK_THEME=dark` to measure
    // the other theme — a headless run has no toolbar.)
    const haloInk = getComputedStyle(halo as Element).stroke;
    const ground = getComputedStyle(svg).backgroundColor;
    expect(haloInk).not.toBe("");
    expect(haloInk).not.toBe("none");
    expect(haloInk).toBe(ground);

    // The theme actually governing this subtree — resolved FROM the subject, so a
    // decorator that moved `data-theme` cannot make the claim above vacuous.
    const governing = svg.closest("[data-theme]")?.getAttribute("data-theme");
    expect(governing).toBeTruthy();
  },
};

/**
 * The sheet on a drafting ground at decoration 10. The marks are unchanged —
 * they are ink — but the ground behind them is now drawn, and every halo cuts
 * it away around its label. Compare `VocabularyPlain`, where the same ground is
 * transparent. For decoration reaching a chart's FILLS, see
 * `Charts/ChartFrame › With Source` at decoration 10.
 */
export const VocabularyDecorated: Story = {
  globals: { decoration: "10" },
  render: () => <Sheet decoration="10" />,
  play: async ({ canvasElement }) => {
    expectSheet(canvasElement);
    const ground = canvasElement.querySelector('[data-testid="marks-ground"]');
    expect(getComputedStyle(ground as Element, "::before").backgroundImage).not.toBe("none");
  },
};

/**
 * The same ground at decoration 0 — the plain end of the dial, where the
 * drafting layer is transparent: the proof that the marks owe nothing to
 * decoration.
 */
export const VocabularyPlain: Story = {
  globals: { decoration: "0" },
  render: () => <Sheet decoration="0" />,
  play: async ({ canvasElement }) => {
    expectSheet(canvasElement);
  },
};
