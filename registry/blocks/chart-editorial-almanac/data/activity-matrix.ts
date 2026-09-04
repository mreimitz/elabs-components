/** One cell per row — the same `{ x, y, value }` shape `HeatmapChart mode="dot"` takes. */
export interface AlmanacCell {
  x: string;
  y: string;
  value: number;
}

const TEAMS = ["Platform", "Product", "Support", "Data"];
const WEEKS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

/** Deterministic pseudo-random ticket volume, team × week — no `Math.random`. */
function seed(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const ACTIVITY_MATRIX: AlmanacCell[] = TEAMS.flatMap((team, t) =>
  WEEKS.map((week, w) => {
    const base = [22, 14, 30, 9][t] ?? 15;
    const wobble = seed(t * 8 + w, 7);
    return { x: week, y: team, value: Math.round(base * (0.5 + wobble * 1.1)) };
  }),
);
