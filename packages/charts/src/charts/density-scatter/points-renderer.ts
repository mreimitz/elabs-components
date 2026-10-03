/**
 * density-scatter/points-renderer.ts — the dots, on the GPU when there is one.
 *
 * Framework-free. Positions and class bytes are uploaded once per data
 * identity; per frame only the density byte (and, on a selection change, the
 * selected byte) travel to the GPU, and the vertex shader does the projection,
 * the ramp lookup and the selection dimming. That is what keeps 10⁶ points
 * inside a frame — no per-point JavaScript on the draw side at all.
 *
 * Without WebGL (jsdom, a locked-down browser, hardware acceleration off) the
 * same inputs draw through a Canvas-2D fallback that rasterises the dots into
 * one pixel buffer in JavaScript. Slower, identical picture.
 *
 * Ink (#283): each class ramp runs from the plot background (sparse) to the
 * class token (dense); density is LIGHTNESS on one hue, never a second hue.
 */

import type { DensityPlotBox, DensityView } from "./types";

export type Rgb = readonly [number, number, number];

export interface ColorRamp {
  /** Sparse end, 0–255 per channel. */
  lo: Rgb;
  /** Dense end. */
  hi: Rgb;
}

export interface DrawParams {
  view: DensityView;
  box: DensityPlotBox;
  /** Canvas CSS size. */
  width: number;
  height: number;
  dpr: number;
  /** Dot radius in CSS px (the smallest dot when sizes are set). */
  radius: number;
  /** Largest dot radius in CSS px, reached at size byte 255. Default `radius`. */
  radiusMax?: number;
  /** Dot opacity. */
  alpha: number;
  /** One ramp per class index. */
  ramps: readonly ColorRamp[];
  /** `hidden[k]` — the class is toggled off. */
  hidden: ArrayLike<boolean>;
  /** Whether `selected` bytes dim anything. */
  hasSelection: boolean;
  /**
   * Lower bound of the ramp position: `0` maps the level straight to the ramp
   * (a value colouring); `0.32` keeps a lone dot visibly coloured (density).
   */
  tMin: number;
}

export interface PointsRenderer {
  readonly kind: "webgl" | "canvas2d" | "none";
  setPoints(pos: Float32Array, cls: Uint8Array): void;
  setLevels(levels: Uint8Array): void;
  setSelected(selected: Uint8Array): void;
  /** Per-point size bytes (0 = `radius`, 255 = `radiusMax`); `null` = every dot at `radius`. */
  setSizes(sizes: Uint8Array | null): void;
  /** Per-point glyph bytes (an index into `DENSITY_SHAPES`); `null` = every dot a circle. */
  setShapes(shapes: Uint8Array | null): void;
  draw(params: DrawParams): void;
  dispose(): void;
}

const MAX_CLASSES = 16;

/**
 * Sprite extent beyond the dot radius when glyphs other than the circle are
 * drawn: a star's or triangle's tips reach ~1.2 r, and the edge needs its
 * antialiasing margin.
 */
const SHAPE_EXTENT = 1.35;

const VERTEX_SHADER = `
precision mediump float;
attribute vec2 aPos;
attribute float aCls;
attribute float aLvl;
attribute float aSel;
attribute float aSz;
attribute float aShp;
uniform float uShapes;
uniform vec4 uView;
uniform vec4 uBox;
uniform vec2 uSize;
uniform float uR;
uniform float uRMax;
uniform float uDpr;
uniform vec3 uLo[${MAX_CLASSES}];
uniform vec3 uHi[${MAX_CLASSES}];
uniform float uVis[${MAX_CLASSES}];
uniform float uAlpha;
uniform float uHasSel;
uniform float uTMin;
varying vec4 vColor;
varying float vR;
varying float vShp;
varying float vSprite;
void main() {
  int k = int(aCls + 0.5);
  if (uVis[k] < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  float sx = uBox.x + (aPos.x - uView.x) / (uView.z - uView.x) * uBox.z;
  float sy = uBox.y + (uView.w - aPos.y) / (uView.w - uView.y) * uBox.w;
  gl_Position = vec4(sx / uSize.x * 2.0 - 1.0, 1.0 - sy / uSize.y * 2.0, 0.0, 1.0);
  float r = mix(uR, uRMax, aSz);
  vR = r;
  vShp = uShapes > 0.5 ? aShp : 0.0;
  // The sprite, in CSS px: the dot plus its edge margin; wider when glyphs may reach past r.
  vSprite = r * 2.0 * (uShapes > 0.5 ? ${SHAPE_EXTENT} : 1.0) + 2.0;
  gl_PointSize = vSprite * uDpr;
  float t = uTMin + (1.0 - uTMin) * aLvl;
  vec3 c = mix(uLo[k], uHi[k], t);
  float a = uAlpha;
  if (uHasSel > 0.5 && aSel < 0.5) { c = mix(c, vec3(0.62), 0.55); a *= 0.16; }
  vColor = vec4(c, a);
}`;

// Signed distances (CSS px, y down) — `densityShapeDistance` below is the same
// arithmetic in JavaScript for the Canvas-2D stamps; keep the two in step.
const FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;
varying float vR;
varying float vShp;
varying float vSprite;
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdTri(vec2 p, float r) {
  p.y = -p.y;
  const float k = 1.7320508;
  p.x = abs(p.x) - r; p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
float sdStar(vec2 p, float r) {
  p.y = -p.y;
  const vec2 k1 = vec2(0.809016994, -0.587785252);
  const vec2 k2 = vec2(-0.809016994, -0.587785252);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = 0.5 * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
float sdShape(vec2 p, float r, float s) {
  float w = max(0.5, r * 0.32);
  if (s < 0.5) return length(p) - r;
  if (s < 1.5) return sdBox(p, vec2(r * 0.86));
  if (s < 2.5) return (abs(p.x) + abs(p.y) - r * 1.15) * 0.7071;
  if (s < 3.5) return sdTri(p, r * 0.95);
  if (s < 4.5) return sdTri(vec2(p.x, -p.y), r * 0.95);
  if (s < 5.5) return min(sdBox(p, vec2(r, w)), sdBox(p, vec2(w, r)));
  if (s < 6.5) return sdBox(p, vec2(r, w));
  if (s < 7.5) { vec2 q = vec2(p.x - p.y, p.x + p.y) * 0.7071; return min(sdBox(q, vec2(r * 1.1, w)), sdBox(q, vec2(w, r * 1.1))); }
  if (s < 8.5) return sdStar(p, r * 1.15);
  return sdHex(p, r * 0.95);
}
void main() {
  vec2 p = (gl_PointCoord - 0.5) * vSprite;
  float d = sdShape(p, vR, vShp);
  float edge = 1.0 - smoothstep(-0.7, 0.3, d);
  float a = vColor.a * edge;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor.rgb * a, a);
}`;

const SQRT3 = Math.sqrt(3);
function sdBoxJs(x: number, y: number, bx: number, by: number): number {
  const dx = Math.abs(x) - bx;
  const dy = Math.abs(y) - by;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}
function sdTriJs(x: number, y: number, r: number): number {
  let px = x;
  let py = -y;
  px = Math.abs(px) - r;
  py = py + r / SQRT3;
  if (px + SQRT3 * py > 0) {
    const nx = (px - SQRT3 * py) / 2;
    const ny = (-SQRT3 * px - py) / 2;
    px = nx;
    py = ny;
  }
  px -= Math.min(Math.max(px, -2 * r), 0);
  return -Math.hypot(px, py) * Math.sign(py);
}
function sdStarJs(x: number, y: number, r: number): number {
  const k1x = 0.809016994;
  const k1y = -0.587785252;
  let px = Math.abs(x);
  let py = -y;
  let d = Math.max(k1x * px + k1y * py, 0);
  px -= 2 * d * k1x;
  py -= 2 * d * k1y;
  d = Math.max(-k1x * px + k1y * py, 0);
  px -= 2 * d * -k1x;
  py -= 2 * d * k1y;
  px = Math.abs(px);
  py -= r;
  const bax = 0.5 * -k1y;
  const bay = 0.5 * k1x - 1;
  const h = Math.min(Math.max((px * bax + py * bay) / (bax * bax + bay * bay), 0), r);
  return Math.hypot(px - bax * h, py - bay * h) * Math.sign(py * bax - px * bay);
}
function sdHexJs(x: number, y: number, r: number): number {
  const kx = -0.866025404;
  const ky = 0.5;
  const kz = 0.577350269;
  let px = Math.abs(x);
  let py = Math.abs(y);
  const d = Math.min(kx * px + ky * py, 0);
  px -= 2 * d * kx;
  py -= 2 * d * ky;
  px -= Math.min(Math.max(px, -kz * r), kz * r);
  py -= r;
  return Math.hypot(px, py) * Math.sign(py);
}

/**
 * Signed distance (CSS px, negative inside) from `(x, y)` — relative to the
 * dot's centre, y down — to the edge of glyph `shape` (an index into
 * `DENSITY_SHAPES`) of radius `r`. The fragment shader's `sdShape`, in JS.
 */
export function densityShapeDistance(shape: number, x: number, y: number, r: number): number {
  const w = Math.max(0.5, r * 0.32);
  switch (shape) {
    case 1:
      return sdBoxJs(x, y, r * 0.86, r * 0.86);
    case 2:
      return (Math.abs(x) + Math.abs(y) - r * 1.15) * Math.SQRT1_2;
    case 3:
      return sdTriJs(x, y, r * 0.95);
    case 4:
      return sdTriJs(x, -y, r * 0.95);
    case 5:
      return Math.min(sdBoxJs(x, y, r, w), sdBoxJs(x, y, w, r));
    case 6:
      return sdBoxJs(x, y, r, w);
    case 7: {
      const qx = (x - y) * Math.SQRT1_2;
      const qy = (x + y) * Math.SQRT1_2;
      return Math.min(sdBoxJs(qx, qy, r * 1.1, w), sdBoxJs(qx, qy, w, r * 1.1));
    }
    case 8:
      return sdStarJs(x, y, r * 1.15);
    case 9:
      return sdHexJs(x, y, r * 0.95);
    default:
      return Math.hypot(x, y) - r;
  }
}

class WebGLPoints implements PointsRenderer {
  readonly kind = "webgl" as const;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly attribs: Record<"pos" | "cls" | "lvl" | "sel" | "sz" | "shp", number>;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private readonly buffers: Record<"pos" | "cls" | "lvl" | "sel" | "sz" | "shp", WebGLBuffer>;
  private count = 0;
  private hasShapes = false;
  private readonly lo = new Float32Array(MAX_CLASSES * 3);
  private readonly hi = new Float32Array(MAX_CLASSES * 3);
  private readonly vis = new Float32Array(MAX_CLASSES);

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("DensityScatterChart: could not create a shader");
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
      }
      return shader;
    };
    const program = gl.createProgram();
    if (!program) throw new Error("DensityScatterChart: could not create a program");
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
    }
    gl.useProgram(program);
    this.program = program;
    this.attribs = {
      pos: gl.getAttribLocation(program, "aPos"),
      cls: gl.getAttribLocation(program, "aCls"),
      lvl: gl.getAttribLocation(program, "aLvl"),
      sel: gl.getAttribLocation(program, "aSel"),
      sz: gl.getAttribLocation(program, "aSz"),
      shp: gl.getAttribLocation(program, "aShp"),
    };
    const names = [
      "uView",
      "uBox",
      "uSize",
      "uR",
      "uRMax",
      "uDpr",
      "uAlpha",
      "uHasSel",
      "uTMin",
      "uShapes",
    ];
    this.uniforms = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
    this.uniforms.uLo = gl.getUniformLocation(program, "uLo");
    this.uniforms.uHi = gl.getUniformLocation(program, "uHi");
    this.uniforms.uVis = gl.getUniformLocation(program, "uVis");
    const buffer = () => {
      const b = gl.createBuffer();
      if (!b) throw new Error("DensityScatterChart: could not create a buffer");
      return b;
    };
    this.buffers = {
      pos: buffer(),
      cls: buffer(),
      lvl: buffer(),
      sel: buffer(),
      sz: buffer(),
      shp: buffer(),
    };
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
  }

  setPoints(pos: Float32Array, cls: Uint8Array): void {
    const { gl, buffers } = this;
    this.count = cls.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.pos);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.cls);
    gl.bufferData(gl.ARRAY_BUFFER, cls, gl.STATIC_DRAW);
    // Fresh dynamic buffers sized to the data; `setLevels`/`setSelected` sub-update.
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.lvl);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(this.count), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sel);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(this.count).fill(255), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.sz);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(this.count), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.shp);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(this.count), gl.DYNAMIC_DRAW);
    this.hasShapes = false;
  }

  setSizes(sizes: Uint8Array | null): void {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.sz);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, sizes ?? new Uint8Array(this.count));
  }

  setShapes(shapes: Uint8Array | null): void {
    const { gl } = this;
    this.hasShapes = Boolean(shapes && shapes.length);
    if (!this.hasShapes) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.shp);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, shapes!);
  }

  setLevels(levels: Uint8Array): void {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.lvl);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, levels);
  }

  setSelected(selected: Uint8Array): void {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.sel);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, selected);
  }

  draw(p: DrawParams): void {
    const { gl, uniforms: u, attribs: a, buffers: b } = this;
    const canvas = gl.canvas as HTMLCanvasElement;
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Scissor is bottom-left origin: the plot box's bottom edge from the canvas bottom.
    const bottom = p.height - (p.box.top + p.box.height);
    gl.scissor(
      Math.round(p.box.left * p.dpr),
      Math.round(bottom * p.dpr),
      Math.round(p.box.width * p.dpr),
      Math.round(p.box.height * p.dpr),
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.count === 0) return;
    gl.useProgram(this.program);
    gl.uniform4f(u.uView!, p.view.x0, p.view.y0, p.view.x1, p.view.y1);
    gl.uniform4f(u.uBox!, p.box.left, p.box.top, p.box.width, p.box.height);
    gl.uniform2f(u.uSize!, p.width, p.height);
    gl.uniform1f(u.uR!, p.radius);
    gl.uniform1f(u.uRMax!, p.radiusMax ?? p.radius);
    gl.uniform1f(u.uDpr!, p.dpr);
    gl.uniform1f(u.uAlpha!, p.alpha);
    gl.uniform1f(u.uHasSel!, p.hasSelection ? 1 : 0);
    gl.uniform1f(u.uTMin!, p.tMin);
    gl.uniform1f(u.uShapes!, this.hasShapes ? 1 : 0);
    for (let k = 0; k < MAX_CLASSES; k++) {
      const ramp = p.ramps[Math.min(k, p.ramps.length - 1)] ?? { lo: [0, 0, 0], hi: [0, 0, 0] };
      this.lo[k * 3] = ramp.lo[0] / 255;
      this.lo[k * 3 + 1] = ramp.lo[1] / 255;
      this.lo[k * 3 + 2] = ramp.lo[2] / 255;
      this.hi[k * 3] = ramp.hi[0] / 255;
      this.hi[k * 3 + 1] = ramp.hi[1] / 255;
      this.hi[k * 3 + 2] = ramp.hi[2] / 255;
      this.vis[k] = p.hidden[k] ? 0 : 1;
    }
    gl.uniform3fv(u.uLo!, this.lo);
    gl.uniform3fv(u.uHi!, this.hi);
    gl.uniform1fv(u.uVis!, this.vis);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.enableVertexAttribArray(a.pos);
    gl.vertexAttribPointer(a.pos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.cls);
    gl.enableVertexAttribArray(a.cls);
    gl.vertexAttribPointer(a.cls, 1, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.lvl);
    gl.enableVertexAttribArray(a.lvl);
    gl.vertexAttribPointer(a.lvl, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.sel);
    gl.enableVertexAttribArray(a.sel);
    gl.vertexAttribPointer(a.sel, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.sz);
    gl.enableVertexAttribArray(a.sz);
    gl.vertexAttribPointer(a.sz, 1, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.shp);
    gl.enableVertexAttribArray(a.shp);
    gl.vertexAttribPointer(a.shp, 1, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  dispose(): void {
    const { gl } = this;
    for (const b of Object.values(this.buffers)) gl.deleteBuffer(b);
    gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** One pre-computed dot: pixel offsets from the centre and their edge coverage. */
interface Stamp {
  dx: Int16Array;
  dy: Int16Array;
  cov: Float32Array;
  /** Half extent in device px (the bounding square is `2 * reach + 1`). */
  reach: number;
}

/**
 * The dot the fragment shader draws, as a pixel mask: coverage
 * `1 - smoothstep(r - 0.7, r + 0.3, dist)` with `dist` in CSS px.
 */
function makeStamp(r: number, dpr: number, shape = 0): Stamp {
  const reach = Math.max(0, Math.ceil((r * (shape ? SHAPE_EXTENT : 1) + 0.3) * dpr));
  const dx: number[] = [];
  const dy: number[] = [];
  const cov: number[] = [];
  for (let y = -reach; y <= reach; y++) {
    for (let x = -reach; x <= reach; x++) {
      // Coverage `1 - smoothstep(-0.7, 0.3, d)`, `d` the signed distance in CSS px.
      const d = densityShapeDistance(shape, x / dpr, y / dpr, r);
      const t = Math.min(1, Math.max(0, (d + 0.7) / 1));
      const c = 1 - t * t * (3 - 2 * t);
      if (c < 0.02) continue;
      dx.push(x);
      dy.push(y);
      cov.push(c);
    }
  }
  if (!cov.length) {
    dx.push(0);
    dy.push(0);
    cov.push(1);
  }
  return {
    dx: Int16Array.from(dx),
    dy: Int16Array.from(dy),
    cov: Float32Array.from(cov),
    reach,
  };
}

const EMPTY_U8 = new Uint8Array(0);

type Clip = readonly [x0: number, y0: number, x1: number, y1: number];

// The Canvas-2D fallback's hot loops live in small top-level functions with
// typed-array arguments only: V8 keeps them optimised, where the same loops
// inlined in `draw` ran ~10× slower inside a busy app.

/**
 * Pass 1 — one write per point: the device pixel its dot is centred on. Dots
 * snap to whole pixels, so every point on a pixel paints the SAME stamp; keep
 * the count and the last point (a selected point is never covered by a dimmed
 * one) so pass 2 stamps each occupied pixel once. A pile of `c` identical dots
 * blends exactly as one dot of alpha `1 - (1 - a)^c`.
 */
function splatPixels(
  pos: Float32Array,
  cls: Uint8Array,
  hiddenMask: Uint8Array,
  selected: Uint8Array,
  hasSel: boolean,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  ox: number,
  oy: number,
  sx: number,
  sy: number,
  W: number,
  clip: Clip,
  pixCount: Uint16Array,
  pixLast: Int32Array,
): void {
  const [cx0, cy0, cx1, cy1] = clip;
  for (let y = cy0; y < cy1; y++) pixCount.fill(0, y * W + cx0, y * W + cx1);
  const bx0 = cx0 - 0.5;
  const bx1 = cx1 - 0.5;
  const by0 = cy0 - 0.5;
  const by1 = cy1 - 0.5;
  const n = cls.length;
  for (let i = 0; i < n; i++) {
    const px = pos[i * 2]!;
    const py = pos[i * 2 + 1]!;
    if (!(px >= x0 && px <= x1 && py >= y0 && py <= y1)) continue;
    if (hiddenMask[cls[i]!]) continue;
    const fx = ox + (px - x0) * sx;
    const fy = oy + (y1 - py) * sy;
    if (!(fx >= bx0 && fx < bx1 && fy >= by0 && fy < by1)) continue;
    const pix = ((fy + 0.5) | 0) * W + ((fx + 0.5) | 0);
    const c = pixCount[pix]!;
    if (c < 65535) pixCount[pix] = c + 1;
    if (c === 0 || !hasSel || selected[i] || !selected[pixLast[pix]!]) pixLast[pix] = i;
  }
}

/** Pass 2 — one stamp per occupied pixel, "over" into a premultiplied buffer. */
function stampPixels(
  acc: Float32Array,
  W: number,
  clip: Clip,
  pixCount: Uint16Array,
  pixLast: Int32Array,
  cls: Uint8Array,
  levels: Uint8Array,
  selected: Uint8Array,
  hasSel: boolean,
  sizes: Uint8Array,
  shapes: Uint8Array,
  stampsByShape: ReadonlyArray<readonly Stamp[]>,
  lut: Float32Array,
  pileA: Float32Array,
): void {
  const [cx0, cy0, cx1, cy1] = clip;
  const nSizes = stampsByShape[0]!.length;
  const first = stampsByShape[0]![0]!;
  const hasShapes = shapes.length > 0;
  for (let iy = cy0; iy < cy1; iy++) {
    const row = iy * W;
    for (let ix = cx0; ix < cx1; ix++) {
      const count = pixCount[row + ix]!;
      if (count === 0) continue;
      const i = pixLast[row + ix]!;
      const sel = hasSel && !selected[i] ? 1 : 0;
      const lo = ((cls[i]! * 2 + sel) * 256 + levels[i]!) * 4;
      const cr = lut[lo]!;
      const cg = lut[lo + 1]!;
      const cb = lut[lo + 2]!;
      const ca = pileA[sel * 256 + (count > 255 ? 255 : count)]!;
      const stamps = hasShapes
        ? (stampsByShape[shapes[i]!] ?? stampsByShape[0]!)
        : stampsByShape[0]!;
      const st =
        nSizes > 1
          ? stamps[Math.min(nSizes - 1, ((sizes[i]! * nSizes) / 256) | 0)]!
          : hasShapes
            ? stamps[0]!
            : first;
      const dx = st.dx;
      const dy = st.dy;
      const cov = st.cov;
      const reach = st.reach;
      const m = cov.length;
      if (ix - reach >= cx0 && ix + reach < cx1 && iy - reach >= cy0 && iy + reach < cy1) {
        for (let j = 0; j < m; j++) {
          const o = ((iy + dy[j]!) * W + ix + dx[j]!) * 4;
          const a = ca * cov[j]!;
          const keep = 1 - a;
          acc[o] = cr * a + acc[o]! * keep;
          acc[o + 1] = cg * a + acc[o + 1]! * keep;
          acc[o + 2] = cb * a + acc[o + 2]! * keep;
          acc[o + 3] = a + acc[o + 3]! * keep;
        }
      } else {
        for (let j = 0; j < m; j++) {
          const x = ix + dx[j]!;
          const y = iy + dy[j]!;
          if (x < cx0 || x >= cx1 || y < cy0 || y >= cy1) continue;
          const o = (y * W + x) * 4;
          const a = ca * cov[j]!;
          const keep = 1 - a;
          acc[o] = cr * a + acc[o]! * keep;
          acc[o + 1] = cg * a + acc[o + 1]! * keep;
          acc[o + 2] = cb * a + acc[o + 2]! * keep;
          acc[o + 3] = a + acc[o + 3]! * keep;
        }
      }
    }
  }
}

/** Premultiplied buffer → straight-alpha pixels, inside the clip only. */
function unpremultiply(acc: Float32Array, d: Uint8ClampedArray, W: number, clip: Clip): void {
  const [cx0, cy0, cx1, cy1] = clip;
  for (let y = cy0; y < cy1; y++) {
    const end = (y * W + cx1) * 4;
    for (let o = (y * W + cx0) * 4; o < end; o += 4) {
      const a = acc[o + 3]!;
      if (a <= 0) {
        d[o + 3] = 0;
        continue;
      }
      const inv = 1 / a;
      d[o] = acc[o]! * inv;
      d[o + 1] = acc[o + 1]! * inv;
      d[o + 2] = acc[o + 2]! * inv;
      d[o + 3] = a * 255;
    }
  }
}

/**
 * Canvas-2D fallback: same inputs, same picture as the shaders, rasterised in
 * JavaScript. Each dot is a pre-computed coverage mask blended ("over",
 * premultiplied) straight into a pixel buffer that goes to the canvas with ONE
 * `putImageData` — no per-point canvas call, which is what made 10⁶ points
 * cost a second per frame when the browser has WebGL switched off.
 */
class Canvas2DPoints implements PointsRenderer {
  readonly kind = "canvas2d" as const;
  private pos: Float32Array = new Float32Array(0);
  private cls: Uint8Array = new Uint8Array(0);
  private levels: Uint8Array = new Uint8Array(0);
  private selected: Uint8Array = new Uint8Array(0);
  private sizes: Uint8Array | null = null;
  private shapes: Uint8Array | null = null;
  private acc: Float32Array = new Float32Array(0);
  private image: ImageData | null = null;
  private stamps = new Map<string, Stamp>();
  private pixLast: Int32Array = new Int32Array(0);
  private pixCount: Uint16Array = new Uint16Array(0);
  private pileKey = NaN;
  private clipKey = "";
  private pile: Float32Array = new Float32Array(512);
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  setPoints(pos: Float32Array, cls: Uint8Array): void {
    this.pos = pos;
    this.cls = cls;
    this.levels = new Uint8Array(cls.length);
    this.selected = new Uint8Array(cls.length).fill(255);
  }
  setLevels(levels: Uint8Array): void {
    this.levels = levels;
  }
  setSelected(selected: Uint8Array): void {
    this.selected = selected;
  }
  setSizes(sizes: Uint8Array | null): void {
    this.sizes = sizes;
  }
  setShapes(shapes: Uint8Array | null): void {
    this.shapes = shapes && shapes.length ? shapes : null;
  }

  /** Alpha of `c` stacked dots, `[dimmed * 256 + min(c, 255)]`. */
  private pileAlpha(alpha: number): Float32Array {
    if (alpha !== this.pileKey) {
      this.pileKey = alpha;
      for (let sel = 0; sel < 2; sel++) {
        const a = sel ? alpha * 0.16 : alpha;
        for (let c = 0; c < 256; c++) this.pile[sel * 256 + c] = 1 - Math.pow(1 - a, c);
      }
    }
    return this.pile;
  }

  private stamp(r: number, dpr: number, shape = 0): Stamp {
    const key = `${shape}|${r.toFixed(2)}|${dpr}`;
    let s = this.stamps.get(key);
    if (!s) {
      if (this.stamps.size > 256) this.stamps.clear();
      s = makeStamp(r, dpr, shape);
      this.stamps.set(key, s);
    }
    return s;
  }

  draw(p: DrawParams): void {
    const { ctx } = this;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    if (W <= 0 || H <= 0) return;
    // A partial 2-D context (jsdom stubs) has no pixel access: draw nothing.
    if (typeof ctx.createImageData !== "function" || typeof ctx.putImageData !== "function") return;
    if (this.acc.length !== W * H * 4) {
      this.acc = new Float32Array(W * H * 4);
      this.image = null;
    }
    const { dpr } = p;
    // Clip in device px.
    const cx0 = Math.max(0, Math.floor(p.box.left * dpr));
    const cy0 = Math.max(0, Math.floor(p.box.top * dpr));
    const cx1 = Math.min(W, Math.ceil((p.box.left + p.box.width) * dpr));
    const cy1 = Math.min(H, Math.ceil((p.box.top + p.box.height) * dpr));
    if (cx1 <= cx0 || cy1 <= cy0) return;
    for (let y = cy0; y < cy1; y++) this.acc.fill(0, (y * W + cx0) * 4, (y * W + cx1) * 4);

    // Colour lookup: per class, per level byte, per (dimmed) state → premultiplied-ready rgb + alpha.
    const nCls = p.ramps.length;
    const lut = new Float32Array(nCls * 2 * 256 * 4);
    for (let k = 0; k < nCls; k++) {
      const ramp = p.ramps[k]!;
      for (let sel = 0; sel < 2; sel++) {
        for (let l = 0; l < 256; l++) {
          const t = p.tMin + (1 - p.tMin) * (l / 255);
          let r = ramp.lo[0] + (ramp.hi[0] - ramp.lo[0]) * t;
          let g = ramp.lo[1] + (ramp.hi[1] - ramp.lo[1]) * t;
          let b = ramp.lo[2] + (ramp.hi[2] - ramp.lo[2]) * t;
          let a = p.alpha;
          if (sel) {
            r += (158 - r) * 0.55;
            g += (158 - g) * 0.55;
            b += (158 - b) * 0.55;
            a *= 0.16;
          }
          const o = ((k * 2 + sel) * 256 + l) * 4;
          lut[o] = r;
          lut[o + 1] = g;
          lut[o + 2] = b;
          lut[o + 3] = a;
        }
      }
    }

    // Sizes quantise to a few stamp radii.
    const rMax = p.radiusMax ?? p.radius;
    const SIZES = this.sizes && rMax > p.radius ? 6 : 1;
    // One stamp row per glyph in use (just the circle without shapes).
    const nShapes = this.shapes ? 10 : 1;
    const stampsByShape: Stamp[][] = [];
    for (let shape = 0; shape < nShapes; shape++) {
      const row: Stamp[] = [];
      for (let s = 0; s < SIZES; s++) {
        const r = SIZES > 1 ? p.radius + (rMax - p.radius) * ((s + 0.5) / SIZES) : p.radius;
        row.push(this.stamp(r, dpr, shape));
      }
      stampsByShape.push(row);
    }

    const { x0, x1, y0, y1 } = p.view;
    const cells = W * H;
    if (this.pixLast.length !== cells) {
      this.pixLast = new Int32Array(cells);
      this.pixCount = new Uint16Array(cells);
    }
    const hiddenMask = new Uint8Array(256);
    for (let k = 0; k < 256; k++) hiddenMask[k] = k >= nCls || p.hidden[k] ? 1 : 0;
    const clip = [cx0, cy0, cx1, cy1] as const;
    splatPixels(
      this.pos,
      this.cls,
      hiddenMask,
      this.selected,
      p.hasSelection,
      x0,
      x1,
      y0,
      y1,
      p.box.left * dpr,
      p.box.top * dpr,
      (p.box.width * dpr) / (x1 - x0),
      (p.box.height * dpr) / (y1 - y0),
      W,
      clip,
      this.pixCount,
      this.pixLast,
    );
    stampPixels(
      this.acc,
      W,
      clip,
      this.pixCount,
      this.pixLast,
      this.cls,
      this.levels,
      this.selected,
      p.hasSelection,
      SIZES > 1 ? this.sizes! : EMPTY_U8,
      this.shapes ?? EMPTY_U8,
      stampsByShape,
      lut,
      this.pileAlpha(p.alpha),
    );
    const clipKey = clip.join();
    if (clipKey !== this.clipKey) {
      // The plot box moved: start from a clear image so nothing stale is left
      // outside the new clip.
      this.clipKey = clipKey;
      this.image = null;
    }
    const img = (this.image ??= ctx.createImageData(W, H));
    unpremultiply(this.acc, img.data, W, clip);
    ctx.putImageData(img, 0, 0);
  }

  dispose(): void {
    this.stamps.clear();
    this.acc = new Float32Array(0);
    this.pixLast = new Int32Array(0);
    this.pixCount = new Uint16Array(0);
    this.image = null;
  }
}

class NoopPoints implements PointsRenderer {
  readonly kind = "none" as const;
  setPoints(): void {}
  setLevels(): void {}
  setSelected(): void {}
  setSizes(): void {}
  setShapes(): void {}
  draw(): void {}
  dispose(): void {}
}

/**
 * Picks the best renderer the canvas can give: WebGL, else Canvas 2D, else a
 * no-op (jsdom without a canvas stub — the chart still renders its DOM).
 */
export function createPointsRenderer(
  canvas: HTMLCanvasElement,
  prefer: "webgl" | "canvas2d" = "webgl",
): PointsRenderer {
  if (prefer === "webgl") {
    try {
      const gl =
        (canvas.getContext("webgl", {
          antialias: false,
          premultipliedAlpha: true,
          alpha: true,
          // Keeps the last frame readable: a chart export copies the canvas
          // with `toDataURL`, which reads back blank without it.
          preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null) ?? null;
      if (gl) return new WebGLPoints(gl);
    } catch {
      // fall through to 2D
    }
  }
  try {
    const ctx = canvas.getContext("2d");
    if (ctx) return new Canvas2DPoints(ctx);
  } catch {
    // fall through
  }
  return new NoopPoints();
}

// ── Colour helpers ──────────────────────────────────────────────────────────

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses a CSS colour to 0–255 channels; any syntax a canvas accepts. */
export function parseRgb(color: string, probe?: CanvasRenderingContext2D | null): Rgb | null {
  const trimmed = color.trim();
  const hex = HEX_RE.exec(trimmed);
  if (hex) {
    const h = hex[1]!;
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(trimmed);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (probe && typeof probe.getImageData === "function") {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = trimmed;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1)?.data;
    if (d) return [d[0]!, d[1]!, d[2]!];
  }
  return null;
}

/** `a` mixed toward `b` by `t`. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgbString(c: Rgb): string {
  return `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
}
