"use client";

/**
 * `exportSheet` (RM-084, analysis §2.1 Qlik's responsive-sheet PDF export, §4 R30, §6) —
 * composes a WHOLE sheet into one SVG or PNG at a fixed export size, independent of the
 * viewport (Qlik's own default is 1680×1120). It renders the sheet off-screen through the
 * SAME `DashboardSheet`/`DashboardProvider` every consumer already uses, `renderAll` so lazy
 * tile bodies are included, reads each visible top-level tile's chart `<svg>` at its
 * `cellRect`, and composes them with `composeSvg` (`../../chart-frame`, RM-042/RM-084).
 *
 * Deterministic: `buildExportSvg`/`composeSvg` bake in only resolved (computed) styles, never
 * a clock or a random id, so two exports of the same spec are byte-identical — the filename
 * alone carries the date (`options.now`, default `new Date()`).
 *
 * Scope (documented, not a bug): a container tile (`tabs`/`stack`) is OMITTED — which child is
 * "the" picture, at what size, is not a settled question this RM answers. A non-chart LEAF
 * tile (`text`, `heading`, `metric` without a sparkline, …) is a plain SVG placeholder — a
 * filled rect plus its `data-tile-kind` label, never a `foreignObject`/cloned-DOM embed:
 * Chromium taints ANY canvas a `drawImage` rasterises from an SVG containing a `foreignObject`
 * (even same-origin, even a blob URL), which broke the PNG path outright — a best-effort
 * picture, not the full colour/font inlining `chart-frame/export-svg.ts` gives an actual chart
 * `<svg>`.
 *
 * KNOWN LIMITATION: the off-screen render mounts a FRESH `DashboardProvider` from the live
 * store's `spec` (so edits/layout ARE exported), but not its `driver` — a live selection or a
 * variable override made through the UI (never written back into `spec`) does not reach the
 * export. A follow-up would thread the live store's driver/variables through explicitly.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { buildExportSvg, composeSvg, findChartSvg, type ComposeSvgPart } from "../../chart-frame";
import { compileCondition } from "../core/expression";
import { cellRect } from "../core/layout";
import type { TileSpec } from "../core/spec";
import type { DashboardStore } from "../core/store";
import { DashboardProvider } from "../dashboard-sheet/dashboard-provider";
import { DashboardSheet } from "../dashboard-sheet/dashboard-sheet";
import type { TileRegistry } from "../dashboard-sheet/tile-registry";

export type ExportSheetFormat = "svg" | "png";

/** Default export canvas — Qlik's own responsive-sheet PDF export size (analysis Sources). */
export const EXPORT_SHEET_WIDTH = 1680;
export const EXPORT_SHEET_HEIGHT = 1120;
/** Default PNG pixel-ratio multiplier — matches `chart-frame/export-svg.ts`'s own "@2x". */
export const EXPORT_SHEET_SCALE = 2;

export interface ExportSheetOptions {
  format: ExportSheetFormat;
  /** Export canvas size in px. Default 1680×1120. */
  width?: number;
  height?: number;
  /** `png` only: pixel-ratio multiplier. Default 2. */
  scale?: number;
  /** A title row from `spec.title`. Default `true`. */
  title?: boolean;
  /** A source row from every visible tile's own `source` (deduplicated). Default `false`. */
  source?: boolean;
  /** Clock for the filename's date. Default `() => new Date()` — override in tests. */
  now?: () => Date;
}

export interface ExportSheetResult {
  blob: Blob;
  filename: string;
}

function slugifySheetFilename(value: string): string {
  const slug = value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return slug || "sheet";
}

function isoDateStamp(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

/**
 * Waits for the off-screen sheet's tile DOM to actually mount (`expectedCount` top-level
 * `[data-tile-id]` nodes) before reading it. `DashboardSheet` gates its first paint on its own
 * `ResizeObserver`/`IntersectionObserver` measurement round-trip, which a real browser resolves
 * across several frames, not the fixed 1-2 `requestAnimationFrame` a synchronous jsdom mock
 * settles in — a fixed frame count under-waits in Storybook's real-browser test runner.
 */
async function waitForTileDom(host: HTMLElement, expectedCount: number): Promise<void> {
  const maxFrames = 90; // generous ceiling (~1.5s at 60fps) for CI-slow real-browser runs.
  for (let i = 0; i < maxFrames; i++) {
    if (host.querySelectorAll("[data-tile-id]").length >= expectedCount) break;
    await nextFrame();
  }
  // A couple more frames for chart engines' own measurement-driven first paint.
  await nextFrame();
  await nextFrame();
}

function isTileVisible(
  tile: TileSpec,
  ctx: { variables: Record<string, unknown>; selection: unknown; mode: unknown },
): boolean {
  if (!tile.visibleWhen) return true;
  try {
    const condition = compileCondition(tile.visibleWhen);
    return condition ? condition(ctx as never) : true;
  } catch {
    return true;
  }
}

function resolvedBackgroundColor(el: Element): string | undefined {
  if (typeof window === "undefined") return undefined;
  const color = window.getComputedStyle(el).backgroundColor;
  return color && color !== "rgba(0, 0, 0, 0)" ? color : undefined;
}

/**
 * A plain-SVG placeholder for a non-chart tile: a filled rect plus its `data-tile-kind` label —
 * never a `foreignObject`/cloned-DOM embed (see the module doc's canvas-tainting note).
 */
function placeholderPart(
  el: Element,
  rect: { width: number; height: number },
  backgroundColor: string | undefined,
): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg") as unknown as SVGSVGElement;
  svg.setAttribute("width", String(rect.width));
  svg.setAttribute("height", String(rect.height));
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("width", String(rect.width));
  bg.setAttribute("height", String(rect.height));
  bg.setAttribute("fill", backgroundColor ?? "none");
  svg.append(bg);
  const kind = el.getAttribute("data-tile-kind");
  if (kind) {
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", "12");
    label.setAttribute("y", "24");
    label.setAttribute("fill", "currentColor");
    label.textContent = kind;
    svg.append(label);
  }
  return svg;
}

/**
 * Renders `store`'s current spec off-screen at `width × height` and resolves the composed
 * export `<svg>`. Exported separately from `exportSheet` so a caller building both an SVG
 * preview and a PNG export shares one off-screen render.
 */
export async function buildSheetExportSvg(
  store: DashboardStore,
  registry: TileRegistry,
  options: Pick<ExportSheetOptions, "width" | "height" | "title" | "source"> = {},
): Promise<SVGSVGElement> {
  if (typeof document === "undefined") throw new Error("exportSheet needs a DOM.");
  const width = options.width ?? EXPORT_SHEET_WIDTH;
  const height = options.height ?? EXPORT_SHEET_HEIGHT;
  const spec = store.getState().spec;

  const host = document.createElement("div");
  host.setAttribute("data-slot", "dashboard-export-host");
  host.setAttribute("aria-hidden", "true");
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "-100000px";
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  host.style.pointerEvents = "none";
  document.body.append(host);

  const state0 = store.getState();
  const ctx0 = { variables: state0.variables, selection: state0.selection, mode: state0.mode };
  const expectedTileCount = spec.tiles.filter(
    (tile) => !tile.container && isTileVisible(tile, ctx0),
  ).length;

  const root = createRoot(host);
  try {
    root.render(
      createElement(DashboardProvider, {
        spec,
        tiles: registry,
        mode: "view",
        children: createElement(DashboardSheet, { renderAll: true, chrome: false }),
      }),
    );
    // Let React commit and the sheet's own measurement round-trip (ResizeObserver +
    // IntersectionObserver) settle before reading `<svg>` content.
    await waitForTileDom(host, expectedTileCount);

    const state = store.getState();
    const ctx = { variables: state.variables, selection: state.selection, mode: state.mode };
    const backgroundColor = resolvedBackgroundColor(host);

    const parts: ComposeSvgPart[] = [];
    for (const tile of spec.tiles) {
      if (tile.container) continue; // contained tiles: covered by their container, below.
      if (!isTileVisible(tile, ctx)) continue;
      const el = host.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(tile.id)}"]`);
      if (!el) continue;
      const rect = cellRect(tile.layout, spec.grid, { width, height });
      const chartSvg = findChartSvg(el);
      const built = chartSvg
        ? buildExportSvg(chartSvg, { backgroundColor })
        : placeholderPart(el, rect, resolvedBackgroundColor(el));
      parts.push({
        svg: built,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        title: tile.title,
      });
    }
    // Containers (`tabs`/`stack`) are omitted from this version's export — see module doc.

    const sourceText = options.source
      ? [...new Set(spec.tiles.map((t) => t.source).filter((s): s is string => Boolean(s)))].join(
          " · ",
        )
      : undefined;

    return composeSvg(parts, {
      width,
      height,
      backgroundColor,
      title: options.title === false ? undefined : spec.title,
      source: sourceText || undefined,
    });
  } finally {
    root.unmount();
    host.remove();
  }
}

function serializeComposedSvg(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to rasterise the composed sheet SVG."));
    image.src = src;
  });
}

/**
 * Builds, and — for `png` — rasterises, the whole-sheet export and returns its `Blob` plus a
 * filesystem-safe filename (the sheet's title/id, plus an ISO date — never a timestamp inside
 * the file itself, so two exports of the same spec stay byte-identical).
 */
export async function exportSheet(
  store: DashboardStore,
  registry: TileRegistry,
  options: ExportSheetOptions,
): Promise<ExportSheetResult> {
  const width = options.width ?? EXPORT_SHEET_WIDTH;
  const height = options.height ?? EXPORT_SHEET_HEIGHT;
  const scale = options.scale ?? EXPORT_SHEET_SCALE;
  const now = (options.now ?? (() => new Date()))();
  const spec = store.getState().spec;
  const stem = `${slugifySheetFilename(spec.title ?? spec.id)}-${isoDateStamp(now)}`;

  const svg = await buildSheetExportSvg(store, registry, options);
  const serialized = serializeComposedSvg(svg);

  if (options.format === "svg") {
    return {
      blob: new Blob([serialized], { type: "image/svg+xml;charset=utf-8" }),
      filename: `${stem}.svg`,
    };
  }

  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    const totalHeight = Number.parseFloat(svg.getAttribute("height") ?? String(height));
    canvas.width = width * scale;
    canvas.height = totalHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable for PNG export.");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, width, totalHeight);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Rasterising the composed sheet produced an empty PNG.");
    return { blob, filename: `${stem}.png` };
  } finally {
    URL.revokeObjectURL(url);
  }
}
