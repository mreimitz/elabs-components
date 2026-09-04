"use client";

/**
 * MermaidViewer — the expanded diagram surface: wheel-zoom at the cursor,
 * drag-pan, fit/100% controls, and a left search panel that filters the
 * RENDERED nodes, highlights every hit and zooms to the selected one.
 */
import { Button, Input } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { Maximize, Minus, Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

interface DiagramHit {
  id: string;
  label: string;
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 6;
const HIT_CLASS = "wb-dg-hit";
const HIT_ACTIVE_CLASS = "wb-dg-hit-active";

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/**
 * Fit-to-viewport transform (centered), or `null` while either box is
 * unmeasured. Guarding here is what fixes the "opens at MIN_SCALE pinned
 * top-left" defect: the dialog mounts BEFORE layout, so a 0-sized container
 * used to produce a negative → clamped-to-minimum scale.
 */
export function fitTransform(
  container: { width: number; height: number },
  natural: { width: number; height: number },
  pad = 24,
): Transform | null {
  if (container.width <= pad || container.height <= pad) return null;
  if (!natural.width || !natural.height) return null;
  // Fit means "make it all visible", never "blow it up": small diagrams stay
  // at natural size (100%), centered — upscaling reads as a broken zoom.
  const scale = clampScale(
    Math.min(1, (container.width - pad) / natural.width, (container.height - pad) / natural.height),
  );
  return {
    scale,
    tx: (container.width - natural.width * scale) / 2,
    ty: (container.height - natural.height * scale) / 2,
  };
}

/**
 * Human-readable label for a rendered diagram node. Mermaid renders multi-line
 * labels as sibling text containers (`tspan` lines, or `p`/`span` inside the
 * htmlLabels foreignObject); raw `textContent` concatenates them WITHOUT
 * separators ("Microsoft Graph APIOutlook / C…"). Join the leaf segments with
 * a "·" instead.
 */
export function diagramNodeLabel(node: Element): string {
  const candidates = Array.from(node.querySelectorAll("tspan, p, span"));
  const leaves = candidates.filter((el) => !el.querySelector("tspan, p, span"));
  const parts = leaves
    .map((el) => (el.textContent ?? "").trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (parts.length === 0) return (node.textContent ?? "").trim().replace(/\s+/g, " ");
  return parts.join(" · ");
}

export function MermaidViewer({ svg, label }: { svg: string; label: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  const [hits, setHits] = useState<DiagramHit[]>([]);
  const [query, setQuery] = useState("");
  const [activeHit, setActiveHit] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  /** The user took over (zoom/pan) — stop auto-fitting on container resize. */
  const userDrivenRef = useRef(false);

  /** Natural (untransformed) svg size in px. */
  const naturalSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const fit = useCallback((): boolean => {
    const container = containerRef.current;
    const { w, h } = naturalSize.current;
    if (!container) return false;
    const next = fitTransform(
      { width: container.clientWidth, height: container.clientHeight },
      { width: w, height: h },
    );
    if (next) setTransform(next);
    return next !== null;
  }, []);

  // Mount: size the svg naturally, collect searchable nodes, fit to view.
  useEffect(() => {
    const stage = stageRef.current;
    const svgEl = stage?.querySelector("svg");
    if (!stage || !svgEl) return;
    const viewBox = svgEl.viewBox?.baseVal;
    const w = viewBox?.width || svgEl.getBoundingClientRect().width || 800;
    const h = viewBox?.height || svgEl.getBoundingClientRect().height || 600;
    // Replace mermaid's inline style WHOLESALE (it ships `max-width: Xpx`
    // which silently beat per-property overrides — the fit math then used the
    // viewBox size while the svg rendered capped: the "26% blob" defect).
    svgEl.setAttribute("style", `max-width:none;width:${w}px;height:${h}px;`);
    svgEl.setAttribute("width", String(w));
    svgEl.setAttribute("height", String(h));
    // Trust the PIXELS, not the assumption: measure the rendered box (the
    // stage transform is still identity at mount). Fall back to viewBox.
    const rect = svgEl.getBoundingClientRect();
    naturalSize.current = {
      w: rect.width > 0 ? rect.width : w,
      h: rect.height > 0 ? rect.height : h,
    };

    const found: DiagramHit[] = [];
    const seen = new Set<string>();
    for (const node of svgEl.querySelectorAll<SVGGElement>("g.node, g.edgeLabel")) {
      const text = diagramNodeLabel(node);
      if (!text || !node.id) continue;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      found.push({ id: node.id, label: text });
    }
    setHits(found);
    // The dialog animates open — retry across the first frames until the
    // container has real dimensions (belt to the ResizeObserver's braces).
    if (!fit()) {
      let tries = 0;
      let raf = 0;
      const attempt = () => {
        if (userDrivenRef.current) return;
        if (!fit() && ++tries < 30) raf = requestAnimationFrame(attempt);
      };
      raf = requestAnimationFrame(attempt);
      return () => cancelAnimationFrame(raf);
    }
  }, [svg, fit]);

  // The dialog mounts before layout settles, so the mount-time fit() can see a
  // 0-sized container (fitTransform skips it). Re-fit when the container gains
  // or changes size — until the user zooms/pans, after which their view wins.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!userDrivenRef.current) fit();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fit]);

  // Highlight matching nodes as the query changes.
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q.length >= 2 ? hits.filter((hit) => hit.label.toLowerCase().includes(q)) : []),
    [hits, q],
  );

  useEffect(() => {
    const svgEl = stageRef.current?.querySelector("svg");
    if (!svgEl) return;
    const matchIds = new Set(matches.map((m) => m.id));
    for (const node of svgEl.querySelectorAll<SVGGElement>("g.node, g.edgeLabel")) {
      node.classList.toggle(HIT_CLASS, matchIds.has(node.id));
      // The ACTIVE highlight is independent of the query filter: after the
      // user clicks a result (and the query changes or clears), the found
      // node must stay visibly marked.
      node.classList.toggle(HIT_ACTIVE_CLASS, node.id === activeHit);
    }
  }, [matches, activeHit]);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    userDrivenRef.current = true;
    const rect = container.getBoundingClientRect();
    setTransform((t) => {
      const scale = clampScale(t.scale * factor);
      const px = (clientX - rect.left - t.tx) / t.scale;
      const py = (clientY - rect.top - t.ty) / t.scale;
      return { scale, tx: clientX - rect.left - px * scale, ty: clientY - rect.top - py * scale };
    });
  }, []);

  const zoomCenter = (factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  };

  const zoomToHit = useCallback((id: string) => {
    const container = containerRef.current;
    const svgEl = stageRef.current?.querySelector("svg");
    const node = svgEl?.querySelector<SVGGElement>(`[id="${CSS.escape(id)}"]`);
    if (!container || !svgEl || !node) return;
    userDrivenRef.current = true;
    setActiveHit(id);
    setTransform((t) => {
      const nodeRect = node.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      // Node center in svg-space (invert the current transform).
      const cx = (nodeRect.left + nodeRect.width / 2 - containerRect.left - t.tx) / t.scale;
      const cy = (nodeRect.top + nodeRect.height / 2 - containerRect.top - t.ty) / t.scale;
      const scale = clampScale(Math.max(t.scale, 1.25));
      return {
        scale,
        tx: containerRect.width / 2 - cx * scale,
        ty: containerRect.height / 2 - cy * scale,
      };
    });
  }, []);

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    userDrivenRef.current = true;
    dragRef.current = { x: e.clientX, y: e.clientY, tx: transform.tx, ty: transform.ty };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setTransform((t) => ({
      ...t,
      tx: drag.tx + (e.clientX - drag.x),
      ty: drag.ty + (e.clientY - drag.y),
    }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      {/* Search rail */}
      <div className="flex w-60 shrink-0 flex-col border-e border-border pe-3">
        <Input
          autoFocus
          type="search"
          placeholder="Find in diagram…"
          aria-label="Find in diagram"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          className="h-8 text-body"
        />
        <p aria-live="polite" className="px-1 pt-1.5 text-meta text-muted-foreground tabular-nums">
          {q.length >= 2
            ? `${matches.length} ${matches.length === 1 ? "node" : "nodes"}`
            : `${hits.length} nodes · type to filter`}
        </p>
        <ul className="m-0 mt-1 min-h-0 flex-1 list-none overflow-auto p-0">
          {(q.length >= 2 ? matches : hits).map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => zoomToHit(hit.id)}
                aria-pressed={activeHit === hit.id}
                className={cn(
                  "w-full truncate rounded-md px-2 py-1.5 text-start text-caption transition-colors duration-fast ease-standard motion-reduce:transition-none",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-ring-inset",
                  activeHit === hit.id
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Stage */}
      <div className="relative min-h-0 min-w-0 flex-1">
        <div className="absolute end-2 top-2 z-10 flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            onClick={() => zoomCenter(1 / 1.25)}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            onClick={() => zoomCenter(1.25)}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 font-mono text-meta tabular-nums"
            aria-label="Reset zoom to 100%"
            onClick={() => {
              userDrivenRef.current = true;
              setTransform((t) => ({ ...t, scale: 1 }));
            }}
          >
            {Math.round(transform.scale * 100)}%
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Fit diagram"
            onClick={() => {
              // An explicit fit hands control back: keep fitting on resize.
              userDrivenRef.current = false;
              fit();
            }}
          >
            <Maximize className="size-3.5" />
          </Button>
        </div>

        <div
          ref={containerRef}
          role="img"
          aria-label={label}
          className={cn(
            "h-full w-full touch-none select-none overflow-hidden rounded-md bg-surface-muted/50",
            dragRef.current ? "cursor-grabbing" : "cursor-grab",
          )}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={(e) => zoomAt(e.clientX, e.clientY, 1.5)}
        >
          <div
            ref={stageRef}
            style={{
              transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
              transformOrigin: "0 0",
            }}
            // Same sanitized engine output as the inline rendering.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </div>
  );
}
