import type { FlowDirection, FlowKind } from "../edges/data-flow-edge-data";
import { inViewport, pointAt, samplePath, type SampledPath } from "./path-sampler";
import {
  MAX_PARTICLE_EDGES,
  particlePhase,
  particleProfile,
  particleSlots,
  type ParticleProfile,
} from "./profiles";
interface Track {
  id: string;
  element: SVGPathElement;
  path: SampledPath;
  profile: ParticleProfile;
  direction: FlowDirection;
  kind: FlowKind;
  color: string;
}
interface Stats {
  frames: number;
  draws: number;
  visibleEdges: number;
  cachedEdges: number;
  samples: number;
  timings: Float32Array;
  cursor: number;
}
const diagnostics = new WeakMap<HTMLCanvasElement, Stats>();
/** Bounded diagnostics for the app's real-browser performance gate; no document content. */
export function readParticleStats(canvas: HTMLCanvasElement) {
  const s = diagnostics.get(canvas);
  return s
    ? {
        frames: s.frames,
        draws: s.draws,
        visibleEdges: s.visibleEdges,
        cachedEdges: s.cachedEdges,
        samples: s.samples,
        timings: [...s.timings.slice(0, Math.min(s.frames, s.timings.length))],
      }
    : null;
}
export interface ParticleEngineOptions {
  canvas: HTMLCanvasElement;
  pane: HTMLElement;
  viewport: () => readonly [number, number, number];
}
/** One capped clock and cached geometry. There are no React updates or per-particle allocations. */
export function startParticles({ canvas, pane, viewport }: ParticleEngineOptions): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const stats: Stats = {
    frames: 0,
    draws: 0,
    visibleEdges: 0,
    cachedEdges: 0,
    samples: 0,
    timings: new Float32Array(600),
    cursor: 0,
  };
  diagnostics.set(canvas, stats);
  let tracks: Track[] = [],
    dirty = true,
    colorsDirty = true;
  let width = 0,
    height = 0,
    dpr = 1,
    raf = 0,
    disposed = false,
    elapsed = 0,
    last = 0;
  let hovered: string | null = null,
    focused: string | null = null;
  const point = new Float32Array(3);
  const refresh = () => {
    const previous = new Map(tracks.map((track) => [track.element, track]));
    tracks = [];
    const paths = pane.querySelectorAll<SVGPathElement>('path[data-slot="data-flow-edge"]');
    for (const element of paths) {
      if (tracks.length >= MAX_PARTICLE_EDGES) break;
      const edge = element.closest<SVGGElement>(".react-flow__edge");
      if (!edge || !element.isConnected) continue;
      const old = previous.get(element);
      const geometry = old?.path.d === element.getAttribute("d") ? old.path : samplePath(element);
      if (!geometry) continue;
      if (geometry !== old?.path) stats.samples++;
      const kind = (element.dataset.kind ?? "data") as FlowKind;
      tracks.push({
        id: edge.dataset.id ?? "",
        element,
        path: geometry,
        profile: particleProfile(kind, element.dataset.schedule),
        kind,
        direction: (element.dataset.direction ?? "forward") as FlowDirection,
        color: !colorsDirty && old?.kind === kind ? old.color : getComputedStyle(element).stroke,
      });
    }
    stats.cachedEdges = tracks.length;
    dirty = false;
    colorsDirty = false;
  };
  const resize = () => {
    const box = pane.getBoundingClientRect();
    width = box.width;
    height = box.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(pane);
  resize();
  const geometryObserver = new MutationObserver(() => {
    dirty = true;
  });
  geometryObserver.observe(pane, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["d", "data-kind", "data-schedule", "data-direction"],
  });
  const themeObserver = new MutationObserver(() => {
    dirty = true;
    colorsDirty = true;
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "style", "class"],
  });
  const edgeId = (event: Event) =>
    event.target instanceof Element
      ? (event.target.closest<HTMLElement>(".react-flow__edge")?.dataset.id ?? null)
      : null;
  const over = (event: Event) => {
    hovered = edgeId(event);
  };
  const out = () => {
    hovered = null;
  };
  const focus = (event: Event) => {
    focused = edgeId(event);
  };
  const blur = () => {
    focused = null;
  };
  pane.addEventListener("pointerover", over);
  pane.addEventListener("pointerleave", out);
  pane.addEventListener("focusin", focus);
  pane.addEventListener("focusout", blur);
  const draw = (now: number) => {
    if (disposed || document.hidden) return;
    raf = requestAnimationFrame(draw);
    if (last && now - last < 1000 / 60 - 0.5) return;
    const started = performance.now();
    elapsed += last ? Math.min(64, now - last) : 0;
    last = now;
    if (dirty) refresh();
    const [x, y, zoom] = viewport();
    // The HTML canvas sits inside the transformed viewport, before the node renderer. Cancel
    // that CSS transform, then project cached flow coordinates onto a bounded screen buffer.
    canvas.style.transform = `translate(${-x / zoom}px, ${-y / zoom}px) scale(${1 / zoom})`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * x, dpr * y);
    let drawn = 0,
      visible = 0;
    for (const track of tracks) {
      if (!inViewport(track.path, x, y, zoom, width, height)) continue;
      visible++;
      const profile = track.profile;
      if (profile.cadence === "demand" && hovered !== track.id && focused !== track.id) continue;
      const duration = ((track.path.length * zoom) / profile.speed) * 1000;
      const both = track.direction === "both";
      const count = particleSlots(duration, profile, both);
      ctx.fillStyle = track.color;
      ctx.strokeStyle = track.color;
      ctx.globalAlpha = profile.opacity;
      for (let i = 0; i < count; i++) {
        const phase = particlePhase(elapsed, both ? Math.floor(i / 2) : i, duration, profile, both);
        if (phase === null) continue;
        const reverse = track.direction === "back" || (track.direction === "both" && i % 2 === 1);
        pointAt(track.path, reverse ? 1 - phase : phase, point);
        ctx.save();
        ctx.translate(point[0]!, point[1]!);
        if (profile.sprite !== "user") ctx.rotate(point[2]! + (reverse ? Math.PI : 0));
        sprite(ctx, profile.sprite, profile.size);
        ctx.restore();
        drawn++;
      }
    }
    stats.frames++;
    stats.draws = drawn;
    stats.visibleEdges = visible;
    stats.timings[stats.cursor++ % stats.timings.length] = performance.now() - started;
  };
  const visibility = () => {
    cancelAnimationFrame(raf);
    last = 0;
    if (document.hidden) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else raf = requestAnimationFrame(draw);
  };
  document.addEventListener("visibilitychange", visibility);
  if (!document.hidden) raf = requestAnimationFrame(draw);
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    geometryObserver.disconnect();
    themeObserver.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    pane.removeEventListener("pointerover", over);
    pane.removeEventListener("pointerleave", out);
    pane.removeEventListener("focusin", focus);
    pane.removeEventListener("focusout", blur);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
function sprite(ctx: CanvasRenderingContext2D, kind: ParticleProfile["sprite"], size: number) {
  ctx.beginPath();
  if (kind === "dot") {
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "arrow") {
    ctx.moveTo(size * 1.6, 0);
    ctx.lineTo(-size, -size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "user") {
    // A small person silhouette stays upright relative to the diagram, with direction carried
    // by movement and the edge's unchanged arrowhead.
    ctx.arc(0, -size * 0.65, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, size * 0.9, size, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.lineWidth = kind === "tick" ? 2 : 1.5;
    ctx.moveTo(-size, 0);
    ctx.lineTo(size, 0);
    ctx.stroke();
  }
}
