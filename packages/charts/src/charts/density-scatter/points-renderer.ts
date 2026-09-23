/**
 * density-scatter/points-renderer.ts — the dots, on the GPU when there is one.
 *
 * Framework-free. Positions and class bytes are uploaded once per data
 * identity; per frame only the density byte (and, on a selection change, the
 * selected byte) travel to the GPU, and the vertex shader does the projection,
 * the ramp lookup and the selection dimming. That is what keeps 10⁶ points
 * inside a frame — no per-point JavaScript on the draw side at all.
 *
 * Without WebGL (jsdom, a locked-down browser) the same inputs draw through a
 * Canvas-2D fallback: points bucketed by (class, level) and stamped from a
 * few dozen pre-rendered round sprites. Slower, identical picture.
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
  /** Dot radius in CSS px. */
  radius: number;
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
  draw(params: DrawParams): void;
  dispose(): void;
}

const MAX_CLASSES = 16;

const VERTEX_SHADER = `
precision mediump float;
attribute vec2 aPos;
attribute float aCls;
attribute float aLvl;
attribute float aSel;
uniform vec4 uView;
uniform vec4 uBox;
uniform vec2 uSize;
uniform float uR;
uniform float uDpr;
uniform vec3 uLo[${MAX_CLASSES}];
uniform vec3 uHi[${MAX_CLASSES}];
uniform float uVis[${MAX_CLASSES}];
uniform float uAlpha;
uniform float uHasSel;
uniform float uTMin;
varying vec4 vColor;
void main() {
  int k = int(aCls + 0.5);
  if (uVis[k] < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  float sx = uBox.x + (aPos.x - uView.x) / (uView.z - uView.x) * uBox.z;
  float sy = uBox.y + (uView.w - aPos.y) / (uView.w - uView.y) * uBox.w;
  gl_Position = vec4(sx / uSize.x * 2.0 - 1.0, 1.0 - sy / uSize.y * 2.0, 0.0, 1.0);
  gl_PointSize = (uR * 2.0 + 2.0) * uDpr;
  float t = uTMin + (1.0 - uTMin) * aLvl;
  vec3 c = mix(uLo[k], uHi[k], t);
  float a = uAlpha;
  if (uHasSel > 0.5 && aSel < 0.5) { c = mix(c, vec3(0.62), 0.55); a *= 0.16; }
  vColor = vec4(c, a);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
varying vec4 vColor;
uniform float uR;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float dist = length(d) * (uR * 2.0 + 2.0);
  float edge = 1.0 - smoothstep(uR - 0.7, uR + 0.3, dist);
  float a = vColor.a * edge;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor.rgb * a, a);
}`;

class WebGLPoints implements PointsRenderer {
  readonly kind = "webgl" as const;
  private readonly gl: WebGLRenderingContext;
  private readonly program: WebGLProgram;
  private readonly attribs: Record<"pos" | "cls" | "lvl" | "sel", number>;
  private readonly uniforms: Record<string, WebGLUniformLocation | null>;
  private readonly buffers: Record<"pos" | "cls" | "lvl" | "sel", WebGLBuffer>;
  private count = 0;
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
    };
    const names = ["uView", "uBox", "uSize", "uR", "uDpr", "uAlpha", "uHasSel", "uTMin"];
    this.uniforms = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
    this.uniforms.uLo = gl.getUniformLocation(program, "uLo");
    this.uniforms.uHi = gl.getUniformLocation(program, "uHi");
    this.uniforms.uVis = gl.getUniformLocation(program, "uVis");
    const buffer = () => {
      const b = gl.createBuffer();
      if (!b) throw new Error("DensityScatterChart: could not create a buffer");
      return b;
    };
    this.buffers = { pos: buffer(), cls: buffer(), lvl: buffer(), sel: buffer() };
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
    gl.uniform1f(u.uDpr!, p.dpr);
    gl.uniform1f(u.uAlpha!, p.alpha);
    gl.uniform1f(u.uHasSel!, p.hasSelection ? 1 : 0);
    gl.uniform1f(u.uTMin!, p.tMin);
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
    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  dispose(): void {
    const { gl } = this;
    for (const b of Object.values(this.buffers)) gl.deleteBuffer(b);
    gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** Canvas-2D fallback: same inputs, sprite-stamped dots, bucketed by colour. */
class Canvas2DPoints implements PointsRenderer {
  readonly kind = "canvas2d" as const;
  private pos: Float32Array = new Float32Array(0);
  private cls: Uint8Array = new Uint8Array(0);
  private levels: Uint8Array = new Uint8Array(0);
  private selected: Uint8Array = new Uint8Array(0);
  private readonly sprites = new Map<string, HTMLCanvasElement>();
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

  private sprite(color: string, r: number, size: number, alpha: number, dpr: number) {
    const key = `${color}|${r.toFixed(2)}|${alpha}|${dpr}`;
    let c = this.sprites.get(key);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = Math.ceil(size * dpr);
    const g = c.getContext("2d");
    if (g) {
      g.scale(dpr, dpr);
      g.globalAlpha = alpha;
      g.fillStyle = color;
      g.beginPath();
      g.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      g.fill();
    }
    if (this.sprites.size > 800) this.sprites.clear();
    this.sprites.set(key, c);
    return c;
  }

  draw(p: DrawParams): void {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
    ctx.clearRect(0, 0, p.width, p.height);
    ctx.beginPath();
    ctx.rect(p.box.left, p.box.top, p.box.width, p.box.height);
    ctx.clip();
    const LEVELS = 16;
    const buckets = new Map<number, number[]>();
    const n = this.cls.length;
    const { x0, x1, y0, y1 } = p.view;
    for (let i = 0; i < n; i++) {
      const px = this.pos[i * 2]!;
      const py = this.pos[i * 2 + 1]!;
      if (!(px >= x0 && px <= x1 && py >= y0 && py <= y1)) continue;
      const k = this.cls[i]!;
      if (p.hidden[k]) continue;
      const lvl = this.levels[i]! >> 4;
      const sel = p.hasSelection && !this.selected[i] ? 1 : 0;
      const key = (k * LEVELS + lvl) * 2 + sel;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(i);
    }
    const size = Math.ceil(p.radius * 2) + 2;
    const half = size / 2;
    const sx = p.box.width / (x1 - x0);
    const sy = p.box.height / (y1 - y0);
    for (const [key, list] of buckets) {
      const sel = key & 1;
      const k = Math.floor(key / 2 / LEVELS);
      const lvl = Math.floor(key / 2) % LEVELS;
      const ramp = p.ramps[Math.min(k, p.ramps.length - 1)]!;
      const t = p.tMin + (1 - p.tMin) * ((lvl + 0.5) / LEVELS);
      let rr = ramp.lo[0] + (ramp.hi[0] - ramp.lo[0]) * t;
      let gg = ramp.lo[1] + (ramp.hi[1] - ramp.lo[1]) * t;
      let bb = ramp.lo[2] + (ramp.hi[2] - ramp.lo[2]) * t;
      let alpha = p.alpha;
      if (sel) {
        rr = rr + (158 - rr) * 0.55;
        gg = gg + (158 - gg) * 0.55;
        bb = bb + (158 - bb) * 0.55;
        alpha *= 0.16;
      }
      const sprite = this.sprite(
        `rgb(${rr | 0},${gg | 0},${bb | 0})`,
        p.radius,
        size,
        alpha,
        p.dpr,
      );
      for (const i of list) {
        const cx = p.box.left + (this.pos[i * 2]! - x0) * sx;
        const cy = p.box.top + (y1 - this.pos[i * 2 + 1]!) * sy;
        ctx.drawImage(sprite, cx - half, cy - half, size, size);
      }
    }
    ctx.restore();
  }

  dispose(): void {
    this.sprites.clear();
  }
}

class NoopPoints implements PointsRenderer {
  readonly kind = "none" as const;
  setPoints(): void {}
  setLevels(): void {}
  setSelected(): void {}
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
