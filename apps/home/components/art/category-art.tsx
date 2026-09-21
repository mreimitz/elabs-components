/**
 * CategoryArt — the hero's drawing language, carried into the header band of each catalogue
 * category: one small isometric drawing per category (AI, Maps, Flow, Charts, …), so a section
 * has an identity of its own and not only the shared striped ground.
 *
 * Same rules as `HeroAnatomy`, held tighter because these sit beside a page title:
 *   - one plate on a dot floor, a few hairline details, ONE accent in `--primary`;
 *   - dashed construction lines for whatever is lifted off the plate, two registration crosses;
 *   - every colour is a token, so it re-inks with the theme; no text, no gradients, no motion.
 * Pure SVG, server-rendered, decorative (`aria-hidden`) — the title beside it names the page.
 *
 * Coordinates: the plate is 200 × 120 in (`a`, `b`); "across the screen" of the thing drawn is
 * `a`, "down the screen" is DEcreasing `b` (the far edge, b = 120, is its top).
 */
import type { ReactNode } from "react";
import { bar, edge, line, path3, plate, px, py, type P3 } from "./iso";

const W = 200;
const D = 120;
const INK = "var(--muted-foreground)";

function Cross({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return <path d={`M${x - r} ${y}h${r * 2}M${x} ${y - r}v${r * 2}`} />;
}

// The floor's dot lattice under the plate, thinning toward its edges.
const FLOOR: { x: number; y: number; o: number }[] = [];
for (let a = -40; a <= W + 40; a += 20) {
  for (let b = -40; b <= D + 40; b += 20) {
    const da = Math.abs(a - W / 2) / (W / 2 + 40);
    const db = Math.abs(b - D / 2) / (D / 2 + 40);
    const o = Math.max(0, 1 - Math.max(da, db) ** 2);
    const p: P3 = [a, b, -14];
    if (o > 0.08) FLOOR.push({ x: px(p), y: py(p), o });
  }
}

/** A plate with its thickness. `accent` makes it the drawing's one primary element. */
function Slab({
  a0,
  a1,
  b0,
  b1,
  z = 0,
  t = 4,
  accent = false,
  muted = false,
}: {
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  z?: number;
  t?: number;
  accent?: boolean;
  muted?: boolean;
}) {
  if (accent)
    return (
      <g stroke="var(--primary-text)" strokeOpacity={0.5}>
        <polygon points={edge(a0, a1, b0, b1, z, t)} fill="var(--primary)" fillOpacity={0.6} />
        <polygon points={plate(a0, a1, b0, b1, z)} fill="var(--card)" stroke="none" />
        <polygon points={plate(a0, a1, b0, b1, z)} fill="var(--primary)" fillOpacity={0.55} />
      </g>
    );
  return (
    <g>
      <polygon points={edge(a0, a1, b0, b1, z, t)} fill="var(--surface-muted)" />
      <polygon points={plate(a0, a1, b0, b1, z)} fill={muted ? "var(--muted)" : "var(--card)"} />
    </g>
  );
}

/** Dashed construction lines from the base plate up to a lifted slab's corners. */
function Risers({ points, z }: { points: readonly (readonly [number, number])[]; z: number }) {
  return (
    <g stroke={INK} opacity={0.5} strokeDasharray="4 4">
      {points.map(([a, b]) => (
        <line key={`${a}-${b}`} {...line([a, b, 0], [a, b, z])} />
      ))}
    </g>
  );
}

/** Flat "text" strokes on a plate: rows at constant `b`, running along `a`. */
function Rows({
  rows,
  z = 0,
  weight = 3,
  opacity = 0.3,
}: {
  rows: readonly (readonly [a0: number, a1: number, b: number])[];
  z?: number;
  weight?: number;
  opacity?: number;
}) {
  return (
    <g stroke={INK} strokeWidth={weight} strokeLinecap="round" opacity={opacity}>
      {rows.map(([a0, a1, b]) => (
        <line key={`${a0}-${a1}-${b}`} {...line([a0, b, z], [a1, b, z])} />
      ))}
    </g>
  );
}

const Base = ({ muted }: { muted?: boolean }) => (
  <Slab a0={0} a1={W} b0={0} b1={D} t={5} muted={muted} />
);

/* ── The drawings ─────────────────────────────────────────────────────────────────────── */

/** AI — a conversation on the plate; the tool call is the part lifted out of it. */
function Ai() {
  return (
    <>
      <Base />
      <polygon points={plate(16, 120, 84, 106, 0)} opacity={0.7} />
      <Rows rows={[[24, 96, 95]]} />
      <polygon points={plate(80, 184, 14, 40, 0)} opacity={0.7} />
      <Rows
        rows={[
          [88, 170, 32],
          [88, 140, 22],
        ]}
      />
      <Risers
        z={46}
        points={[
          [60, 50],
          [150, 50],
          [150, 76],
          [60, 76],
        ]}
      />
      <Slab a0={60} a1={150} b0={50} b1={76} z={46} accent />
      <g stroke="var(--primary-text)" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round">
        <line {...line([70, 63, 46], [78, 63, 46])} />
        <line {...line([86, 63, 46], [128, 63, 46])} />
      </g>
    </>
  );
}

/** Maps — a graticule, a route across it, and an arc between two pins. */
function Maps() {
  const arc: P3[] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    arc.push([40 + 120 * k, 88 - 56 * k, 8 + Math.sin(Math.PI * k) * 58]);
  }
  return (
    <>
      <Base />
      <g opacity={0.45}>
        {[40, 80, 120, 160].map((a) => (
          <line key={`a${a}`} {...line([a, 0, 0], [a, D, 0])} />
        ))}
        {[30, 60, 90].map((b) => (
          <line key={`b${b}`} {...line([0, b, 0], [W, b, 0])} />
        ))}
      </g>
      <polyline
        points={path3([
          [14, 40, 0],
          [60, 52, 0],
          [96, 20, 0],
          [150, 70, 0],
          [188, 96, 0],
        ])}
        stroke={INK}
        strokeWidth={1.5}
        strokeDasharray="2 5"
        strokeLinecap="round"
        opacity={0.7}
      />
      <g stroke={INK} opacity={0.6}>
        <line {...line([40, 88, 0], [40, 88, 8])} />
        <line {...line([160, 32, 0], [160, 32, 8])} />
      </g>
      <polyline
        points={path3(arc)}
        stroke="var(--primary-text)"
        strokeOpacity={0.6}
        strokeWidth={2}
      />
      <polyline points={path3(arc)} stroke="var(--primary)" strokeWidth={1.25} />
      <circle cx={px([40, 88, 8])} cy={py([40, 88, 8])} r={4} fill="var(--card)" stroke={INK} />
      <circle
        cx={px([160, 32, 8])}
        cy={py([160, 32, 8])}
        r={5}
        fill="var(--primary)"
        stroke="var(--primary-text)"
        strokeOpacity={0.5}
      />
    </>
  );
}

/** Flow — three nodes over a dotted canvas, wired left to right; the middle one is selected. */
function Flow() {
  const Z = 34;
  return (
    <>
      <Base />
      <g stroke="none" fill={INK} opacity={0.3}>
        {[30, 60, 90, 120, 150, 180].flatMap((a) =>
          [24, 48, 72, 96].map((b) => (
            <circle key={`${a}-${b}`} cx={px([a, b, 0])} cy={py([a, b, 0])} r={1.1} />
          )),
        )}
      </g>
      <Risers
        z={Z}
        points={[
          [12, 62],
          [188, 22],
        ]}
      />
      <g stroke={INK} strokeWidth={1.5} opacity={0.7}>
        <polyline
          points={path3([
            [56, 78, Z],
            [68, 78, Z],
            [68, 60, Z],
            [80, 60, Z],
          ])}
        />
        <polyline
          points={path3([
            [124, 60, Z],
            [134, 60, Z],
            [134, 38, Z],
            [144, 38, Z],
          ])}
        />
      </g>
      <Slab a0={12} a1={56} b0={62} b1={94} z={Z} />
      <Slab a0={80} a1={124} b0={44} b1={76} z={Z} accent />
      <Slab a0={144} a1={188} b0={22} b1={54} z={Z} />
      <Rows
        z={Z}
        rows={[
          [20, 44, 84],
          [152, 176, 44],
        ]}
        weight={2.5}
      />
    </>
  );
}

/** Charts — bars standing on the plate, a trend line over them. */
function Charts() {
  const bars = [
    { a: 30, h: 22, accent: false },
    { a: 62, h: 36, accent: false },
    { a: 94, h: 30, accent: false },
    { a: 126, h: 52, accent: true },
    { a: 158, h: 44, accent: false },
  ];
  return (
    <>
      <Base />
      <g opacity={0.45}>
        <line {...line([18, 60, 0], [188, 60, 0])} />
      </g>
      {bars.map((b) => (
        <polygon
          key={b.a}
          points={bar(b.a, 16, 60, 0, b.h)}
          stroke="none"
          fill={b.accent ? "var(--primary)" : INK}
          fillOpacity={b.accent ? 0.85 : 0.22}
        />
      ))}
      <polyline
        points={path3(bars.map((b) => [b.a + 8, 60, b.h + 16] as const))}
        stroke={INK}
        strokeWidth={1.5}
        opacity={0.75}
      />
      <g fill="var(--card)" stroke={INK}>
        {bars.map((b) => (
          <circle
            key={b.a}
            cx={px([b.a + 8, 60, b.h + 16])}
            cy={py([b.a + 8, 60, b.h + 16])}
            r={2.5}
          />
        ))}
      </g>
    </>
  );
}

/** Data — a table: a header rule, rows, one row selected; a filter chip lifted above it. */
function Data() {
  return (
    <>
      <Base />
      <line {...line([0, 96, 0], [W, 96, 0])} opacity={0.7} />
      <g opacity={0.35}>
        {[72, 48, 24].map((b) => (
          <line key={b} {...line([0, b, 0], [W, b, 0])} />
        ))}
        <line {...line([70, 0, 0], [70, D, 0])} />
        <line {...line([140, 0, 0], [140, D, 0])} />
      </g>
      <polygon
        points={plate(0, W, 48, 72, 0)}
        fill="var(--primary)"
        fillOpacity={0.45}
        stroke="var(--primary-text)"
        strokeOpacity={0.4}
      />
      <Rows
        rows={[
          [10, 50, 108],
          [80, 120, 108],
          [150, 184, 108],
        ]}
        weight={3}
        opacity={0.4}
      />
      <Rows
        rows={[
          [10, 58, 84],
          [80, 110, 84],
          [150, 176, 84],
          [10, 44, 36],
          [80, 126, 36],
          [150, 170, 36],
          [10, 52, 12],
          [80, 104, 12],
          [150, 180, 12],
        ]}
        weight={2.5}
        opacity={0.22}
      />
      <Risers
        z={40}
        points={[
          [120, 100],
          [184, 100],
        ]}
      />
      <Slab a0={120} a1={184} b0={100} b1={118} z={40} t={3} />
      <Rows z={40} rows={[[130, 170, 109]]} weight={2.5} />
    </>
  );
}

/** UI — a window; a button and a field lifted out of it. */
function Ui() {
  return (
    <>
      <Base />
      <line {...line([0, 102, 0], [W, 102, 0])} opacity={0.6} />
      <g stroke="none" fill={INK} opacity={0.45}>
        {[10, 20, 30].map((a) => (
          <circle key={a} cx={px([a, 111, 0])} cy={py([a, 111, 0])} r={1.8} />
        ))}
      </g>
      <Rows
        rows={[
          [20, 110, 84],
          [20, 80, 72],
        ]}
      />
      <polygon points={plate(20, 130, 40, 58, 0)} opacity={0.6} />
      <polygon points={plate(140, 184, 40, 58, 0)} opacity={0.6} />
      <Risers
        z={44}
        points={[
          [140, 40],
          [184, 40],
        ]}
      />
      <Risers
        z={28}
        points={[
          [20, 40],
          [130, 40],
        ]}
      />
      <Slab a0={20} a1={130} b0={40} b1={58} z={28} t={3} />
      <Rows z={28} rows={[[28, 76, 49]]} weight={2.5} />
      <Slab a0={140} a1={184} b0={40} b1={58} z={44} t={3} accent />
    </>
  );
}

/** Editor — a gutter, indented code lines, the current line marked. */
function Editor() {
  const rows: [number, number, number][] = [
    [34, 96, 104],
    [46, 140, 90],
    [46, 118, 76],
    [58, 170, 62],
    [58, 132, 48],
    [46, 84, 34],
    [34, 60, 20],
  ];
  return (
    <>
      <Base />
      <line {...line([24, 0, 0], [24, D, 0])} opacity={0.6} />
      <polygon
        points={plate(24, W, 55, 69, 0)}
        fill="var(--primary)"
        fillOpacity={0.4}
        stroke="none"
      />
      <Rows rows={rows} weight={2.5} />
      <g stroke="none" fill={INK} opacity={0.4}>
        {rows.map(([, , b]) => (
          <circle key={b} cx={px([12, b, 0])} cy={py([12, b, 0])} r={1.4} />
        ))}
      </g>
      <line
        {...line([176, 57, 0], [176, 67, 0])}
        stroke="var(--primary-text)"
        strokeOpacity={0.7}
        strokeWidth={2}
      />
    </>
  );
}

/** Viewer — a stack of pages; the top one is the file being read. */
function Viewer() {
  return (
    <>
      <Slab a0={30} a1={170} b0={0} b1={D} z={0} t={3} muted />
      <Slab a0={30} a1={170} b0={0} b1={D} z={14} t={3} muted />
      <Risers
        z={40}
        points={[
          [30, 0],
          [170, 0],
          [170, D],
        ]}
      />
      <Slab a0={30} a1={170} b0={0} b1={D} z={40} t={3} />
      <polygon
        points={plate(44, 100, 70, 106, 40)}
        fill="var(--primary)"
        fillOpacity={0.5}
        stroke="var(--primary-text)"
        strokeOpacity={0.4}
      />
      <Rows
        z={40}
        rows={[
          [110, 156, 100],
          [110, 148, 88],
          [110, 156, 76],
          [44, 156, 56],
          [44, 140, 44],
          [44, 156, 32],
          [44, 120, 20],
        ]}
        weight={2.5}
        opacity={0.25}
      />
    </>
  );
}

/** Terminal — a prompt, output lines, the cursor block. */
function Terminal() {
  return (
    <>
      <Base muted />
      <line {...line([0, 102, 0], [W, 102, 0])} opacity={0.6} />
      <g stroke="none" fill={INK} opacity={0.45}>
        {[10, 20, 30].map((a) => (
          <circle key={a} cx={px([a, 111, 0])} cy={py([a, 111, 0])} r={1.8} />
        ))}
      </g>
      <Rows
        rows={[
          [12, 20, 84],
          [12, 20, 32],
        ]}
        weight={3.5}
        opacity={0.7}
      />
      <Rows
        rows={[
          [32, 120, 84],
          [32, 160, 68],
          [32, 96, 56],
          [32, 70, 32],
        ]}
        weight={2.5}
      />
      <polygon
        points={plate(78, 90, 25, 39, 0)}
        fill="var(--primary)"
        stroke="var(--primary-text)"
        strokeOpacity={0.5}
      />
    </>
  );
}

/** Process — activities in sequence with a rework loop; a case token travels the path. */
function Process() {
  const Z = 0;
  const nodes: [number, number][] = [
    [30, 84],
    [84, 60],
    [138, 60],
    [176, 30],
  ];
  return (
    <>
      <Base />
      <g stroke={INK} opacity={0.7}>
        <polyline
          points={path3([
            [30, 84, Z],
            [30, 60, Z],
            [84, 60, Z],
          ])}
          strokeWidth={3}
        />
        <polyline
          points={path3([
            [84, 60, Z],
            [138, 60, Z],
          ])}
          strokeWidth={5}
        />
        <polyline
          points={path3([
            [138, 60, Z],
            [176, 60, Z],
            [176, 30, Z],
          ])}
          strokeWidth={2}
        />
        <polyline
          points={path3([
            [138, 60, Z],
            [138, 100, Z],
            [84, 100, Z],
            [84, 60, Z],
          ])}
          strokeWidth={1.25}
          strokeDasharray="4 4"
        />
      </g>
      <g fill="var(--card)" stroke={INK}>
        {nodes.map(([a, b]) => (
          <polygon key={`${a}-${b}`} points={plate(a - 9, a + 9, b - 9, b + 9, Z)} />
        ))}
      </g>
      <line
        {...line([111, 60, 0], [111, 60, 22])}
        stroke={INK}
        opacity={0.5}
        strokeDasharray="3 3"
      />
      <circle
        cx={px([111, 60, 22])}
        cy={py([111, 60, 22])}
        r={5.5}
        fill="var(--primary)"
        stroke="var(--primary-text)"
        strokeOpacity={0.5}
      />
    </>
  );
}

/** Marketing — a landing page: headline, call to action, three feature tiles. */
function Marketing() {
  return (
    <>
      <Base />
      <Rows
        rows={[
          [20, 130, 102],
          [20, 96, 90],
        ]}
        weight={4}
        opacity={0.4}
      />
      <Rows rows={[[20, 150, 76]]} weight={2.5} opacity={0.22} />
      <g opacity={0.6}>
        {[20, 78, 136].map((a) => (
          <polygon key={a} points={plate(a, a + 44, 10, 40, 0)} />
        ))}
      </g>
      <Risers
        z={26}
        points={[
          [20, 52],
          [70, 52],
        ]}
      />
      <Slab a0={20} a1={70} b0={52} b1={66} z={26} t={3} accent />
    </>
  );
}

/** Icons — a sheet of glyph tiles on the pixel grid; one picked up. */
function Icons() {
  const cells: [number, number][] = [];
  for (const a of [18, 64, 110, 156]) for (const b of [14, 50, 86]) cells.push([a, b]);
  return (
    <>
      <Base />
      <g opacity={0.6}>
        {cells
          .filter(([a, b]) => !(a === 110 && b === 50))
          .map(([a, b]) => (
            <polygon key={`${a}-${b}`} points={plate(a, a + 26, b, b + 22, 0)} />
          ))}
      </g>
      <g stroke={INK} strokeWidth={1.5} strokeLinecap="round" opacity={0.55}>
        <line {...line([24, 25, 0], [38, 25, 0])} />
        <line {...line([31, 19, 0], [31, 31, 0])} />
        <polyline
          points={path3([
            [70, 92, 0],
            [77, 102, 0],
            [84, 92, 0],
          ])}
        />
        <line {...line([162, 61, 0], [176, 61, 0])} />
      </g>
      <Risers
        z={34}
        points={[
          [110, 50],
          [136, 50],
          [136, 72],
        ]}
      />
      <Slab a0={110} a1={136} b0={50} b1={72} z={34} t={3} accent />
    </>
  );
}

/** Tokens — one sheet of swatches over the layers it re-inks; one swatch is the brand's. */
function Tokens() {
  return (
    <>
      <Slab a0={10} a1={190} b0={10} b1={110} z={0} t={3} muted />
      <Slab a0={10} a1={190} b0={10} b1={110} z={14} t={3} muted />
      <Risers
        z={40}
        points={[
          [10, 10],
          [190, 10],
          [190, 110],
        ]}
      />
      <Slab a0={10} a1={190} b0={10} b1={110} z={40} t={3} />
      <g opacity={0.6}>
        {[24, 66, 150].map((a) => (
          <polygon key={a} points={plate(a, a + 30, 58, 94, 40)} />
        ))}
      </g>
      <g stroke="none" fill={INK}>
        <polygon points={plate(24, 54, 58, 94, 40)} fillOpacity={0.12} />
        <polygon points={plate(66, 96, 58, 94, 40)} fillOpacity={0.28} />
        <polygon points={plate(150, 180, 58, 94, 40)} fillOpacity={0.5} />
      </g>
      <polygon
        points={plate(108, 138, 58, 94, 40)}
        fill="var(--primary)"
        stroke="var(--primary-text)"
        strokeOpacity={0.5}
      />
      <Rows
        z={40}
        rows={[
          [24, 120, 40],
          [24, 84, 26],
        ]}
        weight={2.5}
        opacity={0.25}
      />
    </>
  );
}

/** Templates — a whole app: navigation, a header, two panels; one panel lifted. */
function Templates() {
  return (
    <>
      <Base />
      <line {...line([34, 0, 0], [34, D, 0])} opacity={0.6} />
      <line {...line([34, 100, 0], [W, 100, 0])} opacity={0.6} />
      <Rows
        rows={[
          [8, 26, 96],
          [8, 22, 84],
          [8, 26, 72],
          [8, 20, 60],
        ]}
        weight={2.5}
      />
      <polygon points={plate(46, 114, 12, 88, 0)} opacity={0.6} />
      <polygon points={plate(124, 190, 12, 88, 0)} opacity={0.6} />
      <Risers
        z={40}
        points={[
          [124, 12],
          [190, 12],
          [190, 88],
        ]}
      />
      <Slab a0={124} a1={190} b0={12} b1={88} z={40} t={3} accent />
      <Rows
        rows={[
          [54, 100, 76],
          [54, 86, 64],
        ]}
        weight={2.5}
        opacity={0.22}
      />
    </>
  );
}

/** Blocks — a bento of compositions; one picked out to copy. */
function Blocks() {
  return (
    <>
      <Base />
      <g opacity={0.6}>
        <polygon points={plate(12, 116, 64, 108, 0)} />
        <polygon points={plate(12, 60, 12, 54, 0)} />
        <polygon points={plate(70, 116, 12, 54, 0)} />
        <polygon points={plate(126, 188, 12, 108, 0)} />
      </g>
      <Rows
        rows={[
          [134, 176, 96],
          [134, 164, 84],
          [20, 50, 42],
          [78, 104, 42],
        ]}
        weight={2.5}
        opacity={0.22}
      />
      <Risers
        z={30}
        points={[
          [12, 64],
          [116, 64],
          [116, 108],
        ]}
      />
      <Slab a0={12} a1={116} b0={64} b1={108} z={30} t={3} accent />
      <g stroke="var(--primary-text)" strokeOpacity={0.5} strokeWidth={2.5} strokeLinecap="round">
        <line {...line([22, 96, 30], [80, 96, 30])} />
        <line {...line([22, 84, 30], [60, 84, 30])} />
      </g>
    </>
  );
}

/** Components — the primitives, lifted off one sheet at different heights. */
function Components() {
  return (
    <>
      <Base />
      <g opacity={0.6}>
        <polygon points={plate(16, 96, 78, 100, 0)} />
        <polygon points={plate(110, 184, 78, 100, 0)} />
        <polygon points={plate(16, 66, 22, 44, 0)} />
        <polygon points={plate(80, 184, 22, 44, 0)} />
      </g>
      <Risers
        z={44}
        points={[
          [16, 22],
          [66, 22],
        ]}
      />
      <Risers
        z={24}
        points={[
          [110, 78],
          [184, 78],
        ]}
      />
      <Slab a0={110} a1={184} b0={78} b1={100} z={24} t={3} />
      <Rows z={24} rows={[[120, 160, 89]]} weight={2.5} />
      <Slab a0={16} a1={66} b0={22} b1={44} z={44} t={3} accent />
    </>
  );
}

const DRAWINGS = {
  ai: Ai,
  maps: Maps,
  flow: Flow,
  charts: Charts,
  data: Data,
  ui: Ui,
  editor: Editor,
  viewer: Viewer,
  terminal: Terminal,
  process: Process,
  marketing: Marketing,
  icons: Icons,
  tokens: Tokens,
  templates: Templates,
  patterns: Templates,
  blocks: Blocks,
  components: Components,
} as const satisfies Record<string, () => ReactNode>;

export type CategoryArtName = keyof typeof DRAWINGS;

export const hasCategoryArt = (name: string): name is CategoryArtName => name in DRAWINGS;

export function CategoryArt({ name, className }: { name: CategoryArtName; className?: string }) {
  const Drawing = DRAWINGS[name];
  return (
    <div data-slot="category-art" data-category={name} aria-hidden="true" className={className}>
      <svg
        viewBox="-124 -196 326 222"
        fill="none"
        stroke="var(--rule-strong)"
        strokeWidth={1}
        strokeLinejoin="round"
        className="h-auto w-full overflow-visible"
      >
        <g stroke="none" fill="var(--rule-strong)">
          {FLOOR.map((d) => (
            <circle key={`${d.x}-${d.y}`} cx={d.x} cy={d.y} r={1} opacity={d.o} />
          ))}
        </g>
        <g stroke={INK} opacity={0.5}>
          <Cross x={-112} y={-150} />
          <Cross x={188} y={-6} r={5} />
        </g>
        {/* One dimension line along the plate's front edge, ticked at both ends. */}
        <g stroke={INK} opacity={0.5}>
          <line {...line([0, -18, 0], [W, -18, 0])} strokeDasharray="4 4" />
          <line
            x1={px([0, -18, 0])}
            y1={py([0, -18, 0]) - 5}
            x2={px([0, -18, 0])}
            y2={py([0, -18, 0]) + 5}
          />
          <line
            x1={px([W, -18, 0])}
            y1={py([W, -18, 0]) - 5}
            x2={px([W, -18, 0])}
            y2={py([W, -18, 0]) + 5}
          />
        </g>
        <Drawing />
      </svg>
    </div>
  );
}
