/**
 * HeroAnatomy — the hero's illustration: an exploded isometric drawing of what the library is.
 * A finished workspace window on the floor, two components lifted out of it (one of them the
 * lime one a visitor's eye lands on), and a chart surface above them, tied together by dashed
 * construction lines and dimensioned like a drawing.
 *
 * Pure SVG, server-rendered, no state. Every colour is a token, so it re-inks with the theme.
 * Decorative (`aria-hidden`) — the headline beside it says what it shows.
 *
 * HOVER: the layers drift a little further apart, the bars grow and the lime plate deepens —
 * an "exploded view" opening by a few pixels, not a show. All of it is `transform`/`opacity`
 * on the motion tokens, and it is removed under `prefers-reduced-motion`.
 */

// Isometric projection. `a` runs right-and-up, `b` runs left-and-up, `z` is height.
const C = 0.866;
const S = 0.5;
type P3 = readonly [a: number, b: number, z: number];
const px = ([a, b]: P3) => (a - b) * C;
const py = ([a, b, z]: P3) => -(a + b) * S - z;
const pt = (p: P3) => `${px(p).toFixed(1)},${py(p).toFixed(1)}`;

/** A flat plate: the rectangle a0..a1 × b0..b1 at height z, as polygon points. */
function plate(a0: number, a1: number, b0: number, b1: number, z: number) {
  return [
    [a0, b0, z],
    [a1, b0, z],
    [a1, b1, z],
    [a0, b1, z],
  ]
    .map((p) => pt(p as unknown as P3))
    .join(" ");
}
/** The visible thickness of a plate: its two front edges dropped by `t`. */
function edge(a0: number, a1: number, b0: number, b1: number, z: number, t: number) {
  return [
    [a0, b1, z],
    [a0, b0, z],
    [a1, b0, z],
    [a1, b0, z - t],
    [a0, b0, z - t],
    [a0, b1, z - t],
  ]
    .map((p) => pt(p as unknown as P3))
    .join(" ");
}
/** A bar standing on a plate: a flat upright quad in the plane b = const. */
function bar(a: number, w: number, b: number, z: number, h: number) {
  return [
    [a, b, z],
    [a + w, b, z],
    [a + w, b, z + h],
    [a, b, z + h],
  ]
    .map((p) => pt(p as unknown as P3))
    .join(" ");
}
const line = (p: P3, q: P3) => ({ x1: px(p), y1: py(p), x2: px(q), y2: py(q) });
/** A small registration cross at a screen position. */
function Cross({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return <path d={`M${x - r} ${y}h${r * 2}M${x} ${y - r}v${r * 2}`} />;
}

const Z_MID = 150;
const Z_TOP = 300;
// How far a rising layer travels on hover, so its construction lines can be drawn that much
// longer and stay attached.
const LIFT = 16;

const MOVE =
  "transition-transform duration-slow ease-entrance motion-reduce:transition-none motion-reduce:transform-none";

const BARS = [
  { a: 118, h: 26, fill: "var(--muted-foreground)", o: 0.22 },
  { a: 150, h: 40, fill: "var(--primary)", o: 0.45 },
  { a: 182, h: 56, fill: "var(--primary)", o: 0.85 },
  { a: 214, h: 72, fill: "var(--chart-2)", o: 0.45 },
];

// The floor's dot field: an isometric lattice under the window, thinning toward its edges.
const FLOOR_DOTS: { x: number; y: number; o: number }[] = [];
for (let a = -40; a <= 340; a += 20) {
  for (let b = -40; b <= 200; b += 20) {
    const p: P3 = [a, b, -26];
    const da = Math.abs(a - 150) / 190;
    const db = Math.abs(b - 80) / 120;
    const o = Math.max(0, 1 - Math.max(da, db) ** 2);
    if (o > 0.05) FLOOR_DOTS.push({ x: px(p), y: py(p), o });
  }
}

export function HeroAnatomy({ className }: { className?: string }) {
  return (
    <div data-slot="hero-anatomy" aria-hidden="true" className={`group ${className ?? ""}`}>
      <svg
        viewBox="-215 -600 600 690"
        fill="none"
        stroke="var(--rule-strong)"
        strokeWidth={1}
        strokeLinejoin="round"
        className="h-auto w-full overflow-visible"
      >
        {/* Floor dots and registration crosses. */}
        <g stroke="none" fill="var(--rule-strong)">
          {FLOOR_DOTS.map((d) => (
            <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={1.1} opacity={d.o} />
          ))}
        </g>
        <g stroke="var(--muted-foreground)" opacity={0.55}>
          <Cross x={-195} y={-400} r={9} />
          <Cross x={250} y={-540} r={6} />
          <Cross x={-205} y={-40} r={6} />
          <Cross x={330} y={40} r={9} />
        </g>

        {/* Dimension lines: depth of the top sheet, height of the stack, width of the window. */}
        <g stroke="var(--muted-foreground)" opacity={0.5} strokeDasharray="4 4">
          <line {...line([20, 148, Z_TOP + 26], [300, 148, Z_TOP + 26])} />
          <line x1={-172} y1={-330} x2={-172} y2={-80} />
          <line {...line([150, -34, 0], [300, -34, 0])} />
        </g>
        <g stroke="var(--muted-foreground)" opacity={0.6}>
          <path d="M-179 -330h14M-179 -80h14" />
          <line
            x1={px([20, 148, Z_TOP + 26])}
            y1={py([20, 148, Z_TOP + 26]) - 7}
            x2={px([20, 148, Z_TOP + 26])}
            y2={py([20, 148, Z_TOP + 26]) + 7}
          />
          <line
            x1={px([300, 148, Z_TOP + 26])}
            y1={py([300, 148, Z_TOP + 26]) - 7}
            x2={px([300, 148, Z_TOP + 26])}
            y2={py([300, 148, Z_TOP + 26]) + 7}
          />
          <line
            x1={px([150, -34, 0])}
            y1={py([150, -34, 0]) - 7}
            x2={px([150, -34, 0])}
            y2={py([150, -34, 0]) + 7}
          />
          <line
            x1={px([300, -34, 0])}
            y1={py([300, -34, 0]) - 7}
            x2={px([300, -34, 0])}
            y2={py([300, -34, 0]) + 7}
          />
        </g>

        {/* 01 — the workspace window on the floor. */}
        <g>
          <polygon points={edge(0, 300, 0, 160, 0, 6)} fill="var(--surface-muted)" />
          <polygon points={plate(0, 300, 0, 160, 0)} fill="var(--card)" />
          <line {...line([34, 0, 0], [34, 160, 0])} opacity={0.6} />
          <g stroke="none" fill="var(--muted-foreground)" opacity={0.45}>
            <circle cx={px([10, 150, 0])} cy={py([10, 150, 0])} r={2} />
            <circle cx={px([10, 138, 0])} cy={py([10, 138, 0])} r={2} />
            <circle cx={px([10, 126, 0])} cy={py([10, 126, 0])} r={2} />
          </g>
          <g stroke="var(--muted-foreground)" strokeWidth={3} strokeLinecap="round" opacity={0.3}>
            <line {...line([14, 100, 0], [14, 72, 0])} />
            <line {...line([22, 100, 0], [22, 66, 0])} />
            <line {...line([30, 100, 0], [30, 78, 0])} />
          </g>
          <polygon points={plate(52, 160, 20, 140, 0)} opacity={0.7} />
          <polygon points={plate(180, 288, 20, 140, 0)} opacity={0.7} />
        </g>

        {/* Construction lines from the floor to the top sheet. Drawn LIFT longer than they
            need to be at rest: the sheet covers the spare length until it rises. */}
        <g stroke="var(--muted-foreground)" opacity={0.5} strokeDasharray="5 5">
          <line {...line([20, 110, 0], [20, 110, Z_TOP + LIFT])} />
          <line {...line([20, 0, 0], [20, 0, Z_TOP + LIFT])} />
          <line {...line([300, 0, 0], [300, 0, Z_TOP + LIFT])} />
          <line {...line([300, 110, 0], [300, 110, Z_TOP + LIFT])} />
          <line {...line([52, 20, 0], [52, 20, Z_MID + LIFT / 2])} />
          <line {...line([288, 20, 0], [288, 20, Z_MID + LIFT / 2])} />
        </g>

        {/* 02 — the two components lifted out of the window. */}
        <g className={`${MOVE} group-hover:-translate-y-2`}>
          <polygon points={edge(180, 288, 20, 140, Z_MID, 4)} fill="var(--surface-muted)" />
          <polygon points={plate(180, 288, 20, 140, Z_MID)} fill="var(--card)" />
          <polygon points={plate(192, 276, 32, 128, Z_MID)} opacity={0.6} />
        </g>
        <g className={`${MOVE} group-hover:-translate-y-3`}>
          <polygon
            points={edge(52, 160, 20, 140, Z_MID, 4)}
            fill="var(--primary)"
            fillOpacity={0.6}
            stroke="var(--primary-text)"
            strokeOpacity={0.5}
          />
          <polygon points={plate(52, 160, 20, 140, Z_MID)} fill="var(--card)" stroke="none" />
          <polygon
            points={plate(52, 160, 20, 140, Z_MID)}
            fill="var(--primary)"
            stroke="var(--primary-text)"
            strokeOpacity={0.5}
            className="fill-opacity-40 transition-[fill-opacity] duration-slow ease-standard group-hover:fill-opacity-70 motion-reduce:transition-none"
          />
          <polygon
            points={plate(66, 146, 34, 126, Z_MID)}
            stroke="var(--primary-text)"
            strokeOpacity={0.4}
          />
        </g>

        {/* 03 — the chart surface on top. */}
        <g className={`${MOVE} group-hover:-translate-y-4`}>
          <polygon points={edge(20, 300, 0, 110, Z_TOP, 4)} fill="var(--surface-muted)" />
          <polygon points={plate(20, 300, 0, 110, Z_TOP)} fill="var(--card)" />
          {BARS.map((b, i) => (
            <polygon
              key={b.a}
              points={bar(b.a, 18, 56, Z_TOP, b.h)}
              fill={b.fill}
              fillOpacity={b.o}
              stroke="none"
              style={{ transitionDelay: `calc(${i * 40}ms * var(--motion-factor))` }}
              className="origin-bottom transition-transform duration-slow ease-entrance [transform-box:fill-box] group-hover:scale-y-115 motion-reduce:transition-none motion-reduce:transform-none"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
