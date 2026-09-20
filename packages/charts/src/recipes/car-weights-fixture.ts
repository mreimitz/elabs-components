/**
 * car-weights-fixture — seeded, FICTIONAL kerb weights for the River
 * "car weights" recipe.
 *
 * The original draws on a registration database we cannot redistribute, so the
 * models and their spreads are invented; the jitter comes from
 * {@link seededRnd}, never `Math.random`, so the ranges are byte-identical on
 * every render.
 */

import { seededRnd } from "../marks/seeded-rnd";

/** One model's weight distribution, in kilograms. */
export interface CarWeightRow extends Record<string, unknown> {
  model: string;
  class: string;
  /** Middle 90 % of the registered cars. */
  lo90: number;
  hi90: number;
  /** Middle 50 % — the dark span drawn on top. */
  lo50: number;
  hi50: number;
  /** The average, drawn as a tick. */
  avg: number;
}

const MODELS: Array<{ model: string; class: string; centre: number; spread: number }> = [
  { model: "Wren 1.0", class: "City", centre: 990, spread: 150 },
  { model: "Wren Cross", class: "City", centre: 1080, spread: 170 },
  { model: "Marlin 2.0", class: "Compact", centre: 1400, spread: 240 },
  { model: "Marlin Estate", class: "Compact", centre: 1470, spread: 270 },
  { model: "Bison XL", class: "SUV", centre: 2030, spread: 380 },
  { model: "Bison Electric", class: "SUV", centre: 2260, spread: 420 },
];

/** Six models in three classes, ready for `BarChart groupBy="class"`. */
export const CAR_WEIGHTS: CarWeightRow[] = MODELS.map(
  ({ model, class: cls, centre, spread }, i) => {
    const skew = (seededRnd(i, 7) - 0.5) * spread * 0.2;
    const half90 = spread / 2;
    const half50 = spread / 4;
    return {
      model,
      class: cls,
      lo90: Math.round(centre - half90 + skew),
      hi90: Math.round(centre + half90 + skew),
      lo50: Math.round(centre - half50 + skew),
      hi50: Math.round(centre + half50 + skew),
      avg: Math.round(centre + skew),
    };
  },
);
