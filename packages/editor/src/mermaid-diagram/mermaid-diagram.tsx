"use client";

/**
 * MermaidDiagram — the branded Mermaid renderer (#L1).
 *
 * Renders a ```mermaid source string as an SVG diagram, themed from the active
 * semantic tokens (no raw colors here): the mermaid engine is initialized with
 * `theme: "base"` + `themeVariables` resolved at render time from the CSS
 * variables in scope, so the diagram follows every `data-theme` — including
 * runtime switches (a MutationObserver re-renders on theme change).
 *
 * The `mermaid` package is loaded lazily on first render, so consumers that
 * never show a diagram never download the engine. Invalid sources render an
 * inline error block (message + source), never a thrown render.
 */
import { Button, Dialog, DialogContent, DialogTitle } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { Download, Maximize2 } from "lucide-react";
import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from "react";

import { oklchToHex } from "@elabs/components-tokens";

import { CopyButton } from "../copy-button";
import { MermaidViewer } from "./mermaid-viewer";
import { offendingToken, remediateReservedIds } from "./remediate";

export interface MermaidDiagramProps extends HTMLAttributes<HTMLDivElement> {
  /** Mermaid source (the fence body). */
  chart: string;
  /** Accessible name for the rendered diagram. Default "Diagram". */
  label?: string;
  /** Show the hover copy-source button. Default true. */
  copyable?: boolean;
  /** Show the hover expand-to-modal button. Default true. */
  expandable?: boolean;
  /**
   * In-document search term (≥2 chars): nodes/edge labels whose text contains
   * it get the hit stroke — the diagram participates in document search.
   */
  highlightTerm?: string;
  /**
   * Source text of the ACTIVE search hit (the clicked finding's line). The
   * matching hit is promoted to the primary "active" stroke.
   */
  activeText?: string;
}

/** Semantic token → mermaid `themeVariables` mapping (resolved per render). */
const TOKEN_VARS: Record<string, string> = {
  background: "--background",
  mainBkg: "--card",
  primaryColor: "--muted",
  primaryTextColor: "--foreground",
  primaryBorderColor: "--border-strong",
  secondaryColor: "--secondary",
  tertiaryColor: "--muted",
  lineColor: "--muted-foreground",
  textColor: "--foreground",
  nodeBorder: "--border-strong",
  clusterBkg: "--surface-muted",
  clusterBorder: "--border",
  titleColor: "--foreground",
  edgeLabelBackground: "--background",
  errorBkgColor: "--destructive",
  errorTextColor: "--destructive-foreground",
};

let renderSeq = 0;

/**
 * Search-hit strokes for rendered nodes — token-driven, shared by the inline
 * render and the expanded viewer (a `<style>` is document-global wherever it
 * mounts, so one copy per diagram instance is enough).
 */
const HIT_CSS = `
  .wb-dg-hit :is(rect, polygon, circle, ellipse, path.basic) { stroke: var(--warning) !important; stroke-width: 2.5px !important; }
  .wb-dg-hit-active :is(rect, polygon, circle, ellipse, path.basic) { stroke: var(--primary) !important; stroke-width: 3px !important; }
  .wb-dg-hit.edgeLabel { outline: 2px solid var(--warning); border-radius: 2px; }
  .wb-dg-hit-active.edgeLabel { outline: 2px solid var(--primary); border-radius: 2px; }
`;

/** Does mermaid's color lib (khroma) understand this format already? */
const KHROMA_SAFE_RE = /^(#|rgba?\(|hsla?\()/i;

/**
 * Normalize any CSS color (incl. oklch tokens) to a hex/rgb string the mermaid
 * engine (khroma) can manipulate. oklch converts mathematically (browsers do
 * NOT re-serialize it to rgb — Chromium's canvas keeps the oklch string);
 * anything else unknown falls back to canvas serialization, then raw.
 */
function normalizeColor(value: string, ctx: CanvasRenderingContext2D | null): string {
  const v = value.trim();
  if (!v || KHROMA_SAFE_RE.test(v)) return v;
  const fromOklch = oklchToHex(v);
  if (fromOklch) return fromOklch;
  if (ctx) {
    try {
      ctx.fillStyle = "#000";
      ctx.fillStyle = v;
      if (KHROMA_SAFE_RE.test(ctx.fillStyle)) return ctx.fillStyle;
    } catch {
      // fall through to raw
    }
  }
  return v;
}

function resolveThemeVariables(el: HTMLElement): Record<string, string> {
  const styles = getComputedStyle(el);
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement("canvas").getContext("2d");
  } catch {
    ctx = null;
  }
  const vars: Record<string, string> = {
    fontFamily: styles.getPropertyValue("--font-sans").trim() || "inherit",
  };
  for (const [mermaidVar, token] of Object.entries(TOKEN_VARS)) {
    const raw = styles.getPropertyValue(token).trim();
    if (raw) vars[mermaidVar] = normalizeColor(raw, ctx);
  }
  return vars;
}

export const MermaidDiagram = forwardRef<HTMLDivElement, MermaidDiagramProps>(
  function MermaidDiagram(
    {
      chart,
      label = "Diagram",
      copyable = true,
      expandable = true,
      highlightTerm,
      activeText,
      className,
      ...props
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const svgHostRef = useRef<HTMLDivElement | null>(null);
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);

    const downloadSvg = () => {
      if (!svg) return;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "diagram"}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    };
    // Bumped by the observer when the governing data-theme changes.
    const [themeVersion, setThemeVersion] = useState(0);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      const scope = host.closest("[data-theme]") ?? document.documentElement;
      const observer = new MutationObserver(() => setThemeVersion((v) => v + 1));
      observer.observe(scope, { attributes: true, attributeFilter: ["data-theme"] });
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      let cancelled = false;
      const host = hostRef.current;
      if (!host || !chart.trim()) {
        setSvg(null);
        setError(null);
        return;
      }
      (async () => {
        try {
          const mermaid = (await import("mermaid")).default;
          if (cancelled) return;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            suppressErrorRendering: true,
            theme: "base",
            themeVariables: resolveThemeVariables(host),
          });
          const render = (source: string) => mermaid.render(`brand-mermaid-${++renderSeq}`, source);
          let out;
          try {
            out = await render(chart);
          } catch (firstErr) {
            // Reserved-keyword node ids ("graph[...]", "end[...]") are the
            // most common authoring mistake — remediate the id (labels stay)
            // and retry once instead of failing the reader.
            const token = offendingToken(
              firstErr instanceof Error ? firstErr.message : String(firstErr),
            );
            const fixed = token ? remediateReservedIds(chart, token) : null;
            if (!fixed) throw firstErr;
            out = await render(fixed);
          }
          if (cancelled) return;
          setSvg(out.svg);
          setError(null);
        } catch (err) {
          if (cancelled) return;
          setSvg(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [chart, themeVersion]);

    // Mark search hits on the rendered nodes (class toggles only — the SVG
    // markup is mermaid's; we never rebuild it for a highlight change).
    useEffect(() => {
      const root = svgHostRef.current;
      if (!root) return;
      const term = (highlightTerm ?? "").trim().toLowerCase();
      const active = (activeText ?? "").trim().toLowerCase();
      for (const node of root.querySelectorAll<SVGGElement>("g.node, g.edgeLabel")) {
        const text = (node.textContent ?? "").trim().toLowerCase();
        const hit = term.length >= 2 && text.length > 0 && text.includes(term);
        node.classList.toggle("wb-dg-hit", hit);
        node.classList.toggle(
          "wb-dg-hit-active",
          hit && active.length > 0 && (active.includes(text) || text.includes(active)),
        );
      }
    }, [svg, highlightTerm, activeText]);

    return (
      <div
        ref={(el) => {
          hostRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        data-testid="mermaid-diagram"
        className={cn("group/mermaid relative", className)}
        {...props}
      >
        {svg && (copyable || expandable) ? (
          <div className="absolute end-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity duration-fast ease-standard focus-within:opacity-100 group-hover/mermaid:opacity-100 motion-reduce:transition-none">
            {expandable ? (
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Expand diagram"
                onClick={() => setExpanded(true)}
              >
                <Maximize2 className="size-3.5" />
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Download diagram as SVG"
              onClick={downloadSvg}
            >
              <Download className="size-3.5" />
            </Button>
            {copyable ? (
              <CopyButton
                value={chart}
                label={false}
                aria-label="Copy diagram source"
                size="icon-sm"
              />
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="space-y-2 border-s-2 border-s-destructive bg-destructive/10 p-3 text-body"
          >
            <p className="font-medium text-destructive-text">Diagram failed to render</p>
            <p className="text-muted-foreground">{error}</p>
            <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-code text-foreground">
              {chart}
            </pre>
          </div>
        ) : svg ? (
          <>
            <style>{HIT_CSS}</style>
            <div
              ref={svgHostRef}
              role="img"
              aria-label={label}
              className="overflow-x-auto rounded-md bg-card p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
              // Mermaid output; securityLevel "strict" sanitizes the source.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </>
        ) : (
          <div
            role="status"
            aria-label="Rendering diagram…"
            className="h-24 animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none"
          />
        )}

        {expandable ? (
          <Dialog open={expanded} onOpenChange={setExpanded}>
            <DialogContent className="flex h-[88dvh] w-[92vw] max-w-[92vw] flex-col p-4 sm:max-w-[92vw]">
              <DialogTitle className="sr-only">{label}</DialogTitle>
              {/* Hit strokes ship via the shared HIT_CSS <style> above. */}
              {svg ? <MermaidViewer svg={svg} label={label} /> : null}
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    );
  },
);
