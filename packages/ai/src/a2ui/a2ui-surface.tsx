"use client";

/**
 * A2uiSurface — render an agent-DESIGNED screen from data (D2's safe generative
 * path). The agent emits an `A2uiSurfaceSpec` (JSON: a tree of catalog nodes);
 * this component validates it against the catalog and draws it with the real
 * components — never `eval`, never arbitrary tags, never agent styling.
 *
 * Readiness follows the house model (loading-states): `loading` → skeleton;
 * `isStreaming` (or a string surface that is still incomplete JSON) → build up,
 * pruning only the nodes that do not validate YET and suppressing errors; a
 * settled surface that fails validation → `role="alert"` with every problem and
 * `onError`. Interaction is data too: a node's `on.<event>` names a host action
 * that arrives at `onAction` — the app decides what "approve" means (D5).
 */
import { Skeleton, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { AlertCircle } from "lucide-react";
import type { ComponentProps, ReactNode, SyntheticEvent } from "react";
import { createElement, forwardRef, memo, useEffect, useMemo, useRef, useState } from "react";

import { completeJson, parseSurfaceJson } from "./core/complete-json";
import type {
  A2uiAction,
  A2uiElement,
  A2uiError,
  A2uiNode,
  A2uiPropValue,
  A2uiSurfaceSpec,
} from "./core/spec";
import { invalidNodePaths, isA2uiElement, validateA2uiSurface } from "./core/validate";
import { catalogSchema, uiCatalog, type A2uiCatalog } from "./ui-catalog";

export type A2uiSurfaceStatus = "idle" | "pending" | "ready" | "error";

/** What `onAction` receives besides the action the agent named. */
export interface A2uiActionContext {
  /** The catalog event that fired (`click`, `change`, …). */
  event: string;
  /** The control's value for `change` events (text, checked, selected value…). */
  value?: unknown;
  /** The node that carried the binding, and its path in the spec. */
  node: A2uiElement;
  path: string;
}

export type A2uiActionHandler = (action: A2uiAction, context: A2uiActionContext) => void;

export type A2uiSurfaceProps = Omit<ComponentProps<"div">, "children" | "onError"> & {
  /** The agent's surface: a parsed spec, or its JSON text (may be a streaming prefix). */
  surface: A2uiSurfaceSpec | string | null | undefined;
  /** Which types render, and how. Defaults to the shipped `uiCatalog`. */
  catalog?: A2uiCatalog;
  /** Receives every `on.<event>` binding the user triggers. */
  onAction?: A2uiActionHandler;
  /** Content is arriving incrementally — build up, suppress transient errors. */
  isStreaming?: boolean;
  /** No surface yet (fetch-then-show) — forces the skeleton. */
  loading?: boolean;
  /** Fires once per settled, invalid surface with the validation errors. */
  onError?: (errors: A2uiError[]) => void;
  /** Replace the default skeleton (shown before the first paint while pending). */
  skeleton?: ReactNode;
};

// ---------------------------------------------------------------------------
// Builtins — the two layout nodes the surface draws itself, on tokens only.
// ---------------------------------------------------------------------------
const GAP: Record<string, string> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};
const ALIGN: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};
const JUSTIFY: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

function builtinClass(type: string, props: Record<string, unknown>): string {
  const gap = GAP[String(props.gap ?? "md")] ?? GAP.md;
  if (type === "Grid") {
    return cn("grid", COLUMNS[Number(props.columns ?? 2)] ?? COLUMNS[2], gap);
  }
  return cn(
    "flex min-w-0",
    props.direction === "row" ? "flex-row" : "flex-col",
    props.wrap ? "flex-wrap" : "",
    ALIGN[String(props.align ?? "stretch")],
    JUSTIFY[String(props.justify ?? "start")],
    gap,
  );
}

// ---------------------------------------------------------------------------
// Tree rendering
// ---------------------------------------------------------------------------
interface RenderCtx {
  catalog: A2uiCatalog;
  invalid: Set<string>;
  onAction?: A2uiActionHandler;
}

const isEvent = (v: unknown): v is SyntheticEvent =>
  typeof v === "object" && v !== null && "nativeEvent" in v && "target" in v;

/** The value a `change`-style handler carries: the control's value, or the handler's first arg. */
function eventValue(args: unknown[]): unknown {
  const first = args[0];
  if (isEvent(first)) {
    const target = first.target as HTMLInputElement | null;
    if (target && typeof target.type === "string" && target.type === "checkbox")
      return target.checked;
    return target && "value" in target ? target.value : undefined;
  }
  return first;
}

function renderPropValue(value: A2uiPropValue, path: string, ctx: RenderCtx): unknown {
  if (Array.isArray(value) && value.some(isA2uiElement)) {
    return value.map((item, i) => renderNode(item as A2uiNode, `${path}[${i}]`, ctx));
  }
  if (isA2uiElement(value)) return renderNode(value, path, ctx);
  return value;
}

function renderNode(node: A2uiNode, path: string, ctx: RenderCtx): ReactNode {
  if (typeof node === "string" || typeof node === "number") return node;
  if (ctx.invalid.has(path)) return null;
  const entry = ctx.catalog[node.type];
  if (!entry) return null;
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(node.props ?? {})) {
    const schema = entry.schema.props[name];
    props[name] =
      schema?.type === "node" ? renderPropValue(value, `${path}.props.${name}`, ctx) : value;
  }
  for (const [event, action] of Object.entries(node.on ?? {})) {
    const handlerName = entry.schema.events[event];
    if (!handlerName) continue;
    props[handlerName] = (...args: unknown[]) => {
      // A control's value travels only with `change`-style events; a click
      // carries no value (a button's `target.value` is an empty string).
      const value = event === "click" ? undefined : eventValue(args);
      ctx.onAction?.(action, { event, value, node, path });
    };
  }
  const children = entry.schema.children
    ? (node.children ?? []).map((child, i) => renderNode(child, `${path}.children[${i}]`, ctx))
    : undefined;
  const key = path;
  const dataAttrs = {
    "data-a2ui-type": node.type,
    ...(node.id ? { "data-a2ui-id": node.id } : {}),
  };
  if (entry.schema.builtin) {
    return createElement(
      "div",
      { key, className: builtinClass(node.type, props), ...dataAttrs },
      ...(children ?? []),
    );
  }
  return createElement(
    entry.component as never,
    { key, ...props, ...dataAttrs },
    ...(children ?? []),
  );
}

/** A memoised subtree so a streaming parent re-render does not redraw settled siblings. */
const SurfaceTree = memo(function SurfaceTree({
  spec,
  catalog,
  invalid,
  onAction,
}: {
  spec: A2uiSurfaceSpec;
  catalog: A2uiCatalog;
  invalid: Set<string>;
  onAction?: A2uiActionHandler;
}) {
  return <>{renderNode(spec.root, "root", { catalog, invalid, onAction })}</>;
});

// ---------------------------------------------------------------------------
// The surface
// ---------------------------------------------------------------------------
export const A2uiSurface = forwardRef<HTMLDivElement, A2uiSurfaceProps>(function A2uiSurface(
  {
    surface,
    catalog = uiCatalog,
    onAction,
    isStreaming = false,
    loading = false,
    onError,
    skeleton,
    className,
    ...props
  },
  ref,
) {
  const { t } = useLocale();
  const schema = useMemo(() => catalogSchema(catalog), [catalog]);

  // Parse (completing a streaming prefix), then validate. A string that is not
  // yet valid JSON even after completion is "incomplete", not invalid.
  const parsed = useMemo(() => {
    if (loading || surface == null) return { value: null, incomplete: false };
    if (typeof surface !== "string") return { value: surface, incomplete: false };
    const complete = parseSurfaceJson(surface, false);
    if (complete !== null) return { value: complete, incomplete: false };
    const partial = parseSurfaceJson(surface, true);
    return { value: partial, incomplete: surface.trim() !== "" };
  }, [surface, loading]);

  const validation = useMemo(
    () => (parsed.value === null ? null : validateA2uiSurface(parsed.value, schema)),
    [parsed.value, schema],
  );

  const pending = loading || isStreaming || parsed.incomplete;
  const empty = surface == null || (typeof surface === "string" && surface.trim() === "");

  // While pending, prune the failing subtrees and draw the rest; a settled
  // surface is all-or-nothing.
  const invalid = useMemo(
    () =>
      validation && !validation.ok && pending
        ? invalidNodePaths(validation.errors)
        : new Set<string>(),
    [validation, pending],
  );
  const drawable =
    validation?.spec && (validation.ok || (pending && !invalid.has("root")))
      ? validation.spec
      : null;

  // The last tree that painted, so an unparsable streaming chunk (mid-token) or
  // a momentarily root-invalid prefix keeps the previous frame on screen.
  const lastGoodRef = useRef<A2uiSurfaceSpec | null>(null);
  if (drawable) lastGoodRef.current = drawable;
  const shown = drawable ?? (pending ? lastGoodRef.current : null);
  const [hasRendered, setHasRendered] = useState(false);
  useEffect(() => {
    if (shown && !hasRendered) setHasRendered(true);
  }, [shown, hasRendered]);

  const status: A2uiSurfaceStatus = loading
    ? "pending"
    : empty
      ? hasRendered
        ? "ready"
        : "idle"
      : pending
        ? "pending"
        : validation && !validation.ok
          ? "error"
          : "ready";

  // Terminal errors only — once per settled, invalid surface.
  // Keyed by the error LIST, not the input's identity, so a parent re-render
  // that passes an equal object literal does not report the same failure twice.
  const reportedRef = useRef<string | null>(null);
  useEffect(() => {
    if (status !== "error" || !validation || validation.ok) return;
    const key = JSON.stringify(validation.errors);
    if (reportedRef.current === key) return;
    reportedRef.current = key;
    onError?.(validation.errors);
  }, [status, validation, onError]);

  const showSkeleton = status === "pending" && !shown;
  const title = shown?.title;

  return (
    <div
      ref={ref}
      data-slot="a2ui-surface"
      data-status={status}
      className={cn("relative min-w-0", className)}
      {...(title ? { role: "group", "aria-label": title } : {})}
      {...props}
    >
      {showSkeleton ? (
        <div
          data-slot="a2ui-surface-skeleton"
          role="status"
          aria-live="polite"
          className="space-y-2"
        >
          <span className="sr-only">{t("ai.a2ui.loading")}</span>
          {skeleton ?? (
            <>
              <Skeleton className="h-6 w-1/3" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
              <Skeleton className="h-24 w-full" />
            </>
          )}
        </div>
      ) : null}
      {shown ? (
        <SurfaceTree spec={shown} catalog={catalog} invalid={invalid} onAction={onAction} />
      ) : null}
      {status === "error" && validation && !validation.ok ? (
        <div
          data-slot="a2ui-surface-error"
          role="alert"
          // The status wash is the one separation gesture (surface-separation);
          // `-text` is the AA ink rung on a wash (status-rung).
          className="flex gap-2 rounded-md bg-destructive/10 p-3 text-body text-destructive-text"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{t("ai.a2ui.invalid")}</p>
            <ul className="space-y-0.5 text-caption">
              {validation.errors.slice(0, 8).map((e) => (
                <li key={`${e.path}:${e.code}`} className="break-words">
                  <code className="text-code">{e.path || "root"}</code> — {e.message}
                </li>
              ))}
              {validation.errors.length > 8 ? (
                <li>{t("ai.a2ui.moreErrors", { count: validation.errors.length - 8 })}</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
});

A2uiSurface.displayName = "A2uiSurface";

/** Re-exported so a host can pre-complete a streaming prefix itself (e.g. for a raw-JSON view). */
export { completeJson };
