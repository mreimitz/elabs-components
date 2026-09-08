"use client";

/**
 * ProcessMap — the directly-follows map every process-mining session opens on (RM-051).
 *
 * ## What it is
 *
 * A composition, not a component library. Every mark on the canvas comes from
 * `@elabs-ai/components-flow`: the frame is `CanvasShell`, the layout is `layoutFlow`
 * (dagre), the controls are `ZoomControls`, the overview is `FlowMiniMap`, the key is
 * `Legend variant="scale"`, and the nodes and edges are `FlowNode` / `FlowWeightedEdge` /
 * `FlowSelfLoopEdge` wrapped by this package's two thin process-shaped components. What
 * lives HERE is the domain reading — which number a node prints, which edges a selection
 * keeps, what a right-click means — and nothing else.
 *
 * ## Two inputs, one model
 *
 * Pass a `graph` you already discovered, or pass a `log` and let the map run
 * `discoverGraph` (and `detectRework`) internally — the convenience path for a story, a
 * prototype or a screen that has no explorer around it yet. `abstraction` runs
 * `abstractGraph` over whichever of the two you gave. All three are memoized on their own
 * inputs, so a metric change never re-derives the graph.
 *
 * ## Why the layout does not twitch
 *
 * `useProcessLayout` caches dagre's output on the graph's STRUCTURE (see
 * `processGraphStructureKey`) rather than on the model, so switching the metric,
 * selecting an activity or hovering a path re-renders without moving a single node. The
 * observable proof is `layoutRuns`, which a test asserts against.
 *
 * ## Accessibility
 *
 * - Nodes are React Flow's own focusable elements, and `applyPositions` emits them SORTED
 *   BY THEIR LAID-OUT POSITION (top-to-bottom then left-to-right for `TB`, the transpose
 *   for `LR`) rather than in model order — so DOM order, and therefore `Tab` order, is
 *   layout order. `Enter`/`Space` selects via React Flow's `elementSelectionKeys`
 *   handling, not a re-implementation.
 * - Edges are NOT separate tab stops (`edgesFocusable={false}`). Every edge already
 *   carries a focusable, named label pill, so leaving the edge `<g>` focusable too put
 *   two stops on every arrow and buried the activities behind them. Keys pressed on a
 *   pill still reach the map: `EdgeLabelRenderer` is a React portal, so its events bubble
 *   up the REACT tree through `ProcessTransitionEdge`, which knows its own edge id and
 *   hands it to `onEdgeKey` (`ProcessMapEdgeKeyContext`).
 * - `F` opens the filter-intent menu for whatever is focused, falling back to the current
 *   selection. The same menu is reachable with the mouse by right-clicking a node or an
 *   edge, and with neither by the always-present "Filter…" button — a keyboard shortcut
 *   that is the ONLY way to reach a menu is not an affordance.
 * - `tableView` renders the identical numbers as two `Table`s. It shares
 *   `map-model.ts`'s formatting, so the twin can never drift from the canvas.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Filter } from "lucide-react";
import type { NodeChange } from "@xyflow/react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  StatePanel,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  CanvasShell,
  FlowMiniMap,
  Legend,
  ZoomControls,
  type FlowLayoutDirection,
} from "@elabs-ai/components-flow";
import { abstractGraph, type AbstractionOptions } from "../core/abstract-graph";
import { detectRework, type ReworkStats } from "../core/detect-rework";
import { discoverGraph } from "../core/discover-graph";
import type { EventLog, ProcessGraph } from "../core/types";
import {
  buildProcessMapModel,
  processGraphStructureKey,
  PROCESS_FILTER_INTENT_KINDS,
  PROCESS_FILTER_INTENT_LABELS,
  PROCESS_FILTER_INTENT_MESSAGE_KEYS,
  PROCESS_SELECTION_STATE_MESSAGE_KEYS,
  type ProcessFilterIntent,
  type ProcessMapEdge,
  type ProcessMapModel,
  type ProcessMapNode,
  type ProcessMetricSpec,
  type ProcessSelection,
  type ProcessSelectionState,
  type ProcessSelectionStates,
} from "./map-model";
import { ProcessActivityNode } from "./process-activity-node";
import { ProcessTransitionEdge } from "./process-transition-edge";
import {
  EMPTY_PROCESS_MAP_HOVER,
  ProcessMapEdgeKeyContext,
  ProcessMapHoverContext,
  type ProcessMapHoverState,
} from "./process-map-context";
import {
  PROCESS_MAP_NODE_MOTION_CLASS,
  useProcessLayout,
  type UseProcessLayoutResult,
} from "./use-process-layout";

/**
 * Registered once at module scope. React Flow re-creates every node when this object's
 * identity changes, so an inline literal would remount the whole canvas each render.
 */
const NODE_TYPES = { "process-activity": ProcessActivityNode };
const EDGE_TYPES = { "process-transition": ProcessTransitionEdge };

/**
 * The zoom the map refuses to open below, however big the process is.
 *
 * A discovered log is routinely wider than any pane, and a fit that shows ALL of it shows
 * none of it: the 24-activity fixture frames at 0.28, where the activity name (14 px on
 * the card) prints at 3.9 px and the card is a grey smudge. The floor is set from the
 * card's own type rather than from a graph size: at 0.75 the name renders at 10.5 px and
 * the secondary line (12 px) at 9 px, which is the smallest either stays a word.
 *
 * It is the OPENING zoom only — {@link MIN_ZOOM} still lets the reader pull all the way
 * back to an overview, and the minimap says where in the process the pane is sitting. A
 * fit clamped by this floor is anchored on the START of the process, not its middle;
 * `CanvasShell` does that (see `anchorToStartWhenClamped`).
 */
export const PROCESS_MAP_LEGIBLE_ZOOM = 0.75;

/**
 * How the canvas re-frames itself after a layout.
 *
 * `padding` is generous because the edge label pills are portalled OUTSIDE the SVG and so
 * contribute nothing to React Flow's fitted bounds — a tight fit clips the pills on the
 * outermost transitions. `maxZoom: 1` stops a two-activity graph from being blown up to
 * React Flow's default 2× ceiling, which is what the reader was seeing.
 */
const FIT_VIEW_OPTIONS = {
  padding: 0.15,
  maxZoom: 1,
  minZoom: PROCESS_MAP_LEGIBLE_ZOOM,
} as const;

/**
 * How far out the reader may zoom.
 *
 * React Flow's own floor is `0.5`, and `fitView` CLAMPS to it — so a process with more
 * ranks than the pane is tall could not be framed at all: the fit stopped at 0.5 and left
 * the last activities below the fold with no way to pull back. Measured on the 11-activity
 * fixture in a 1200×576 pane, where the honest fit is 0.42. A discovered process routinely
 * has three or four times that many activities, so the floor has to be a real overview
 * zoom, not a legibility one — legibility at the far end of the dial is what the minimap
 * and the table twin are for.
 */
const MIN_ZOOM = 0.1;

/** Props for {@link ProcessMap}. `onSelect` shadows the DOM handler, so it is omitted. */
export interface ProcessMapProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** A discovered graph. Takes precedence over {@link log} when both are given. */
  graph?: ProcessGraph;
  /**
   * An event log to discover from, for a surface with no explorer around it. Runs
   * `/core`'s `discoverGraph` and `detectRework` internally, memoized on the log.
   */
  log?: EventLog;
  /** Fractions of activities / paths to KEEP, as `/core`'s `abstractGraph` reads them. */
  abstraction?: Pick<AbstractionOptions, "activities" | "paths">;
  /** Which readings the nodes and edges paint. */
  metric: ProcessMetricSpec;
  /** Rework tallies for the node badge. Derived from {@link log} when that is given. */
  rework?: ReworkStats;
  /** Controlled selection. Omit for an uncontrolled map that owns its own. */
  selection?: ProcessSelection | null;
  /**
   * Per-element states an active filter contributes (RM-052 round 2, #227) — e.g. from
   * `useProcessExplorer`'s own `selectionStates`. Applying or clearing a filter never adds
   * or removes a node or an edge (Invariant F): it only re-inks the elements a filter
   * dropped as `"excluded"` (dimmed, never `aria-disabled`). Omit for a map with no
   * filtering, which reproduces today's selection-only behaviour exactly.
   */
  selectionStates?: ProcessSelectionStates;
  /** Fires with the new selection, or `null` when the reader deselects. */
  onSelect?: (target: ProcessSelection | null) => void;
  /** Fires with an intent from the filter menu — hand it straight to `filterLog`. */
  onFilterIntent?: (intent: ProcessFilterIntent) => void;
  /** @default "TB" */
  direction?: FlowLayoutDirection;
  /** @default true */
  showMiniMap?: boolean;
  /** @default true */
  showLegend?: boolean;
  /** Render the accessible table twin instead of the canvas. @default false */
  tableView?: boolean;
  /** No graph yet. Renders the loading panel rather than an empty canvas. */
  loading?: boolean;
  /**
   * Accessible name for the canvas region. Defaults to the localized
   * `process.map.label` message.
   */
  label?: string;
}

/** Resolve the graph the map paints, running `/core` only when its own inputs change. */
function useResolvedGraph(
  graph: ProcessGraph | undefined,
  log: EventLog | undefined,
  abstraction: Pick<AbstractionOptions, "activities" | "paths"> | undefined,
): ProcessGraph | undefined {
  const discovered = useMemo(
    () => (graph ? undefined : log ? discoverGraph(log) : undefined),
    [graph, log],
  );
  const base = graph ?? discovered;
  const activities = abstraction?.activities;
  const paths = abstraction?.paths;
  return useMemo(() => {
    if (!base) return undefined;
    if (activities === undefined && paths === undefined) return base;
    return abstractGraph(base, { activities: activities ?? 1, paths: paths ?? 1 });
  }, [base, activities, paths]);
}

/**
 * The process map.
 *
 * @example
 * ```tsx
 * <ProcessMap log={log} metric={{ node: "absolute_case", edge: "absolute" }} />
 * ```
 */
export function ProcessMap({
  graph,
  log,
  abstraction,
  metric,
  rework,
  selection,
  selectionStates,
  onSelect,
  onFilterIntent,
  direction = "TB",
  showMiniMap = true,
  showLegend = true,
  tableView = false,
  loading = false,
  label,
  className,
  ...props
}: ProcessMapProps) {
  // Every user-visible string on this surface goes through the locale seam (ADR 0017);
  // the table twin's headers especially, since that table IS the accessible reading of
  // the canvas — an untranslated header leaves numbers with no measure name.
  const { t } = useLocale();
  const mapLabel = label ?? t("process.map.label");
  // The State column's own cell text (#413 review, PRRT_kwDOT6D7ts6gJX2C) — `map-model.ts`
  // has no locale seam of its own, so the render site resolves
  // `PROCESS_SELECTION_STATE_MESSAGE_KEYS` through `t()` instead of printing
  // `selectionStateLabel`'s bare English word. `"associated"` has no key and prints nothing,
  // same as before.
  const selectionStateText = useCallback(
    (state: ProcessSelectionState): string => {
      const key = PROCESS_SELECTION_STATE_MESSAGE_KEYS[state];
      return key ? t(key) : "";
    },
    [t],
  );
  const resolved = useResolvedGraph(graph, log, abstraction);
  const derivedRework = useMemo(
    () => (rework ? undefined : log ? detectRework(log) : undefined),
    [rework, log],
  );
  const activeRework = rework ?? derivedRework;

  // Controlled/uncontrolled selection, derived once and never flipped between modes.
  const isControlled = selection !== undefined;
  const [ownSelection, setOwnSelection] = useState<ProcessSelection | null>(null);
  const activeSelection = isControlled ? (selection ?? null) : ownSelection;

  const applySelection = useCallback(
    (next: ProcessSelection | null) => {
      if (!isControlled) setOwnSelection(next);
      onSelect?.(next);
    },
    [isControlled, onSelect],
  );

  const structureKey = useMemo(
    () => (resolved ? processGraphStructureKey(resolved) : ""),
    [resolved],
  );

  // PASS 1 — a model with no back-edge knowledge, because nothing has been laid out yet.
  const firstPass = useMemo(
    () =>
      resolved
        ? buildProcessMapModel({
            graph: resolved,
            metric,
            rework: activeRework,
            selection: activeSelection,
            selectionStates,
          })
        : null,
    [resolved, metric, activeRework, activeSelection, selectionStates],
  );

  // ── Measured node sizes ───────────────────────────────────────────────────
  // dagre needs to know how big an activity card actually is, and React Flow only ever
  // writes its measurements onto its OWN internal record — the node objects this
  // component builds never learn them. Without this, `layoutFlow` fell back to React
  // Flow's generic 172×40 default for a card that really renders ~176×85, so every rank
  // was laid out about half a card too close and the edge label pills landed on the nodes
  // below them. Collecting the dimensions here is what lets the SECOND layout pass use
  // real sizes.
  const [nodeSizes, setNodeSizes] = useState<Record<string, { width: number; height: number }>>({});
  const handleNodesChange = useCallback((changes: NodeChange<ProcessMapNode>[]) => {
    setNodeSizes((current) => {
      let next: Record<string, { width: number; height: number }> | null = null;
      for (const change of changes) {
        if (change.type !== "dimensions" || !change.dimensions) continue;
        const previous = current[change.id];
        if (
          previous?.width === change.dimensions.width &&
          previous.height === change.dimensions.height
        ) {
          continue;
        }
        next ??= { ...current };
        next[change.id] = { width: change.dimensions.width, height: change.dimensions.height };
      }
      return next ?? current;
    });
  }, []);

  const layoutNodes = useMemo(() => {
    const source = firstPass?.nodes ?? EMPTY_NODES;
    let changed = false;
    const next = source.map((node) => {
      const measured = nodeSizes[node.id];
      if (!measured) return node;
      changed = true;
      return { ...node, measured };
    });
    return changed ? next : source;
  }, [firstPass, nodeSizes]);

  /**
   * The measured ENVELOPE, quantized — the layout cache key's size half.
   *
   * Deliberately not the per-node sizes: a metric switch rewrites every subtitle, which
   * can nudge a card's width by a pixel, and keying on that would re-run dagre for a
   * metric change — exactly the twitch `useProcessLayout`'s cache exists to prevent (and
   * what `layoutRuns` asserts against). The envelope, rounded to 8px, moves when the card
   * ANATOMY changes (a meter appears, a line wraps) and sits still otherwise.
   */
  const sizeKey = useMemo(() => {
    let width = 0;
    let height = 0;
    for (const size of Object.values(nodeSizes)) {
      if (size.width > width) width = size.width;
      if (size.height > height) height = size.height;
    }
    if (width === 0 && height === 0) return "unmeasured";
    return `${Math.round(width / 8)}x${Math.round(height / 8)}`;
  }, [nodeSizes]);

  const layoutKey = `${structureKey}::${sizeKey}`;

  const layout: UseProcessLayoutResult = useProcessLayout({
    nodes: layoutNodes,
    edges: firstPass?.edges ?? EMPTY_EDGES,
    structureKey: layoutKey,
    direction,
  });

  // PASS 2 — the same model, now told which edges run against the layout direction, so
  // those edges take the dashed back-edge shape. The structure key is unchanged, so this
  // is a cache HIT: `layoutRuns` does not increase.
  const model: ProcessMapModel | null = useMemo(
    () =>
      resolved
        ? buildProcessMapModel({
            graph: resolved,
            metric,
            rework: activeRework,
            selection: activeSelection,
            selectionStates,
            backEdgeIds: layout.backEdgeIds,
          })
        : null,
    [resolved, metric, activeRework, activeSelection, selectionStates, layout.backEdgeIds],
  );

  const positionedNodes = useMemo(
    () => (model ? applyPositions(model, layout, direction) : EMPTY_NODES),
    [model, layout, direction],
  );

  // ── Hover ─────────────────────────────────────────────────────────────────
  const [hover, setHover] = useState<ProcessMapHoverState>(EMPTY_PROCESS_MAP_HOVER);
  const edgesRef = useRef<ProcessMapEdge[]>([]);
  edgesRef.current = model?.edges ?? [];

  const handleNodeEnter = useCallback((_event: ReactMouseEvent, node: { id: string }) => {
    const incident = new Set<string>();
    for (const edge of edgesRef.current) {
      if (edge.source === node.id || edge.target === node.id) incident.add(edge.id);
    }
    setHover({ activityId: node.id, incidentEdgeIds: incident });
  }, []);
  const handleNodeLeave = useCallback(() => setHover(EMPTY_PROCESS_MAP_HOVER), []);

  // ── Filter-intent menu ────────────────────────────────────────────────────
  const [menuTarget, setMenuTarget] = useState<ProcessSelection | null>(null);
  const menuOpen = menuTarget !== null;

  /**
   * How to put focus back when the menu closes (F5).
   *
   * Radix returns focus to the TRIGGER by default, which is correct for a menu the user
   * opened from the trigger and wrong for one opened with `f` while standing on a node or
   * an arrow — that drops a keyboard user out of the graph and makes them tab back in.
   * Holds a {@link focusRestorer} rather than an element, because a portalled edge label
   * does not survive the re-render. Set only on the keyboard path; `null` means "let Radix
   * do its usual thing".
   */
  const returnFocusRef = useRef<(() => void) | null>(null);

  const openMenuFor = useCallback(
    (target: ProcessSelection | null, restoreFocus: (() => void) | null = null) => {
      if (!target) return;
      returnFocusRef.current = restoreFocus;
      setMenuTarget(target);
    },
    [],
  );

  // The menu filters by ACTIVITY, so a transition offers both of its endpoints.
  const menuActivities = useMemo(() => {
    if (!menuTarget) return [];
    if (menuTarget.kind === "activity") return [menuTarget.id];
    const edge = (model?.edges ?? []).find((e) => e.id === menuTarget.id);
    if (!edge) return [];
    return edge.source === edge.target ? [edge.source] : [edge.source, edge.target];
  }, [menuTarget, model]);

  /** Which element a key event is "about": the focused node/edge, else the selection. */
  const targetOfEvent = useCallback(
    (element: HTMLElement | null): ProcessSelection | null => {
      // React Flow stamps `data-id` on both node and edge wrappers, so the focused
      // element identifies itself; the selection is only the fallback.
      const focusedId = element?.closest<HTMLElement>("[data-id]")?.dataset.id;
      if (!focusedId) return activeSelection;
      return model?.edges.some((edge) => edge.id === focusedId)
        ? { kind: "transition", id: focusedId }
        : { kind: "activity", id: focusedId };
    },
    [activeSelection, model],
  );

  /**
   * The two element keys, for a target the caller already resolved.
   *
   * Shared by the root handler (which resolves the target from the focused DOM element)
   * and by `ProcessTransitionEdge`, which resolves it from its own `id` because an edge's
   * label pill is portalled out of the edge's DOM subtree and so has no `[data-id]`
   * ancestor to read. Returns whether it handled the key, so the edge can stop the event
   * rather than let the root re-handle it against the wrong target.
   */
  const handleElementKey = useCallback(
    (event: ReactKeyboardEvent, target: ProcessSelection | null): boolean => {
      if (!target) return false;
      if (event.metaKey || event.ctrlKey || event.altKey) return false;

      // Enter / Space: React Flow's `elementSelectionKeys` handling marks its OWN
      // selection on the focused element — which is a different thing from this map's
      // domain selection. This bridges the two rather than re-implementing either: React
      // Flow still runs (no `preventDefault`), and the domain selection follows the same
      // toggle a click performs.
      if (event.key === "Enter" || event.key === " ") {
        applySelection(
          activeSelection?.kind === target.kind && activeSelection.id === target.id ? null : target,
        );
        return true;
      }

      if (event.key !== "f" && event.key !== "F") return false;
      event.preventDefault();
      // Remember where the user was standing, so Escape puts them back there (F5).
      const active = (event.target as HTMLElement | null)?.ownerDocument.activeElement;
      openMenuFor(target, active instanceof HTMLElement ? focusRestorer(active) : null);
      return true;
    },
    [activeSelection, applySelection, openMenuFor],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const element = event.target as HTMLElement | null;
      // Never steal a letter someone is typing.
      if (element?.closest("input, textarea, [contenteditable='true']")) return;
      // Enter/Space only means "select" while standing ON a React Flow element; anywhere
      // else it is the button/menu-item activation the browser already owns.
      const onFlowElement = Boolean(element?.closest<HTMLElement>("[data-id]"));
      if ((event.key === "Enter" || event.key === " ") && !onFlowElement) return;
      handleElementKey(event, targetOfEvent(element));
    },
    [handleElementKey, targetOfEvent],
  );

  /**
   * The edge half of {@link handleElementKey}, handed to every `ProcessTransitionEdge`.
   *
   * `stopPropagation` matters: without it the same event reaches the root handler, whose
   * `targetOfEvent` finds no `[data-id]` ancestor above a portalled pill and would fall
   * back to the current SELECTION — i.e. `f` on one arrow's pill would open the menu for
   * a different element entirely.
   */
  const handleEdgeKey = useCallback(
    (edgeId: string, event: ReactKeyboardEvent) => {
      if (handleElementKey(event, { kind: "transition", id: edgeId })) event.stopPropagation();
    },
    [handleElementKey],
  );

  const emitIntent = useCallback(
    (kind: ProcessFilterIntent["kind"], activity: string) => {
      onFilterIntent?.({ kind, activity } as ProcessFilterIntent);
      setMenuTarget(null);
    },
    [onFilterIntent],
  );

  // A selection that disappears (the graph was re-abstracted) must not keep a menu open
  // against an element that is no longer on the map.
  useEffect(() => {
    if (!menuTarget || !model) return;
    const stillThere =
      menuTarget.kind === "activity"
        ? model.nodes.some((n) => n.id === menuTarget.id)
        : model.edges.some((e) => e.id === menuTarget.id);
    if (!stillThere) setMenuTarget(null);
  }, [menuTarget, model]);

  if (loading) {
    return (
      <div
        data-slot="process-map"
        data-state="loading"
        className={cn("relative size-full min-h-64", className)}
        {...props}
      >
        <StatePanel kind="loading" title={t("process.map.loading")} />
      </div>
    );
  }

  if (!model || model.nodes.length === 0) {
    return (
      <div
        data-slot="process-map"
        data-state="empty"
        className={cn("relative size-full min-h-64", className)}
        {...props}
      >
        <StatePanel
          kind="empty"
          title={t("process.map.empty")}
          description={t("process.map.emptyBody")}
        />
      </div>
    );
  }

  const filterMenu = (
    <DropdownMenu
      // NOT modal: a modal Radix menu calls `hideOthers`, which stamps `aria-hidden` on
      // every sibling of the menu — including the overlay that holds this menu's own
      // trigger, producing a focusable element inside an `aria-hidden` subtree (axe
      // `aria-hidden-focus`). A canvas menu also has no business scroll-locking the page.
      modal={false}
      open={menuOpen}
      onOpenChange={(open) => {
        if (!open) setMenuTarget(null);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-slot="process-map-filter-trigger"
          aria-keyshortcuts="f"
          onClick={() => {
            if (menuOpen) return;
            openMenuFor(activeSelection ?? { kind: "activity", id: model.nodes[0]!.id });
          }}
        >
          <Filter aria-hidden="true" className="size-4" />
          {t("process.map.filter")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-slot="process-map-filter-menu"
        // Put a keyboard user back where they were standing (F5). Radix's default is to
        // focus the TRIGGER, which is right for a menu opened FROM the trigger and wrong
        // for one opened with `f` from a node — that drops the user out of the graph and
        // makes them tab all the way back in.
        onCloseAutoFocus={(event) => {
          const restore = returnFocusRef.current;
          returnFocusRef.current = null;
          if (!restore) return;
          event.preventDefault();
          restore();
        }}
      >
        {menuActivities.map((activity, index) => (
          <div key={activity}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{activity}</DropdownMenuLabel>
            {PROCESS_FILTER_INTENT_KINDS.map((kind) => (
              <DropdownMenuItem
                key={kind}
                // #346: the visible text alone is not unique on a transition's menu (the
                // same four intents render once per endpoint), so the accessible name
                // states which activity this item filters by, via the locale seam — the
                // visible text stays unsuffixed and compact.
                aria-label={t(PROCESS_FILTER_INTENT_MESSAGE_KEYS[kind], { activity })}
                onSelect={() => emitIntent(kind, activity)}
              >
                {PROCESS_FILTER_INTENT_LABELS[kind]}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // #375: one polite live region names what the active selection/filter just changed —
  // every OTHER element's per-element "excluded" state (activityAriaLabel/
  // transitionAriaLabel) is correct but unannounceable in aggregate; this is the summary
  // nothing else in the map derives. Two independently-pluralized fragments composed at the
  // call site (see the message's own comment) — never an empty string, even when nothing
  // is excluded, so the region is never silently blank on mount.
  //
  // #413 review (PRRT_kwDOT6D7ts6gJX2I): counts ALONE are not enough. Moving between two
  // selections/filters that exclude DIFFERENT elements but land on the SAME activity and
  // transition counts left this string byte-for-byte identical, so the region — which
  // announces content CHANGES, not model changes — stayed silent even though the map
  // re-inked. Fold in which elements are excluded (sorted, so the string is stable across a
  // render that changed nothing else), not only how many — that tracks the actual affected
  // set regardless of whether it moved via `selection` or via `selectionStates`.
  const excludedActivityNames = model.activityRows
    .filter((row) => row.selectionState === "excluded")
    .map((row) => row.title)
    .sort((a, b) => a.localeCompare(b));
  const excludedTransitionNames = model.transitionRows
    .filter((row) => row.selectionState === "excluded")
    .map((row) => `${row.source} → ${row.target}`)
    .sort((a, b) => a.localeCompare(b));
  const selectionSummary = [
    t("process.map.excludedActivities", {
      count: model.excludedCounts.activities,
      total: model.excludedCounts.totalActivities,
    }),
    excludedActivityNames.length > 0
      ? t("process.map.excludedActivityNames", { names: excludedActivityNames.join(", ") })
      : null,
    t("process.map.excludedTransitions", {
      count: model.excludedCounts.transitions,
      total: model.excludedCounts.totalTransitions,
    }),
    excludedTransitionNames.length > 0
      ? t("process.map.excludedTransitionNames", { names: excludedTransitionNames.join(", ") })
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  if (tableView) {
    return (
      <div
        data-slot="process-map"
        data-view="table"
        className={cn("flex size-full flex-col gap-4", className)}
        {...props}
      >
        <p
          data-slot="process-map-selection-summary"
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {selectionSummary}
        </p>
        <div className="flex items-center justify-end">{filterMenu}</div>
        <Table data-slot="process-map-activity-table">
          <TableCaption>
            {t("process.map.activityCaption", { metric: model.nodeMetricLabel.toLowerCase() })}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("process.map.columnActivity")}</TableHead>
              <TableHead scope="col">{t("process.map.columnRole")}</TableHead>
              <TableHead scope="col">{model.nodeMetricLabel}</TableHead>
              <TableHead scope="col">{t("process.map.columnRework")}</TableHead>
              <TableHead scope="col">{t("process.map.columnState")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.activityRows.map((row) => (
              <TableRow
                key={row.id}
                data-selection={row.selectionState}
                // Complementary, colour-only styling hook (step 4): the real channel is the
                // State cell's text below, which fires for `selected` AND `excluded`; this
                // only lights up `TableRow`'s existing `data-[state=selected]:bg-accent`.
                data-state={row.selectionState === "selected" ? "selected" : undefined}
              >
                <TableCell>{row.title}</TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell className="tabular-nums">
                  {row.secondaryLabel
                    ? `${row.primaryLabel} · ${row.secondaryLabel}`
                    : row.primaryLabel}
                </TableCell>
                <TableCell className="tabular-nums">{row.reworkCount ?? 0}</TableCell>
                <TableCell>{selectionStateText(row.selectionState)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table data-slot="process-map-transition-table">
          <TableCaption>
            {t("process.map.transitionCaption", {
              metric: model.edgeMetricLabel.toLowerCase(),
            })}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t("process.map.columnFrom")}</TableHead>
              <TableHead scope="col">{t("process.map.columnTo")}</TableHead>
              <TableHead scope="col">{t("process.map.columnShape")}</TableHead>
              <TableHead scope="col">{model.edgeMetricLabel}</TableHead>
              <TableHead scope="col">{t("process.map.columnState")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.transitionRows.map((row) => (
              <TableRow
                key={row.id}
                data-selection={row.selectionState}
                data-state={row.selectionState === "selected" ? "selected" : undefined}
              >
                <TableCell>{row.source}</TableCell>
                <TableCell>{row.target}</TableCell>
                <TableCell>{row.shape}</TableCell>
                <TableCell className="tabular-nums">
                  {row.secondaryLabel
                    ? `${row.primaryLabel} · ${row.secondaryLabel}`
                    : row.primaryLabel}
                </TableCell>
                <TableCell>{selectionStateText(row.selectionState)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div
      data-slot="process-map"
      data-view="canvas"
      data-direction={direction}
      className={cn("relative size-full min-h-64", className)}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <p
        data-slot="process-map-selection-summary"
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {selectionSummary}
      </p>
      <ProcessMapHoverContext value={hover}>
        <ProcessMapEdgeKeyContext value={handleEdgeKey}>
          <CanvasShell
            nodes={positionedNodes}
            edges={model.edges}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            // dagre runs in an EFFECT, so the first paint has every node stacked at the
            // origin and React Flow's own one-shot `fitView` fits that degenerate box —
            // it clamps at `maxZoom` (2) and never fires again, which is why this canvas
            // used to open at 2× showing 2 of 11 activities with a perfectly good layout
            // underneath. Re-fit on the key the layout itself is cached on: a structural
            // change (or a direction flip) genuinely moves the picture and has to be
            // re-framed; a metric switch is a cache hit, leaves this key alone, and must
            // NOT yank the viewport out from under the reader.
            fitViewKey={`${layoutKey}::${direction}::${layout.layoutRuns}`}
            fitViewKeyOptions={FIT_VIEW_OPTIONS}
            minZoom={MIN_ZOOM}
            nodesDraggable={false}
            nodesConnectable={false}
            // One tab stop per arrow, not two. Every edge already renders a focusable,
            // named label pill (`EdgeLabelPill`), so leaving React Flow's edge `<g>`
            // focusable as well doubled the stops in front of the activities — 28 of them
            // before the first node in the shipped fixture. Keys pressed on the pill still
            // reach this component through `ProcessMapEdgeKeyContext`.
            edgesFocusable={false}
            className={PROCESS_MAP_NODE_MOTION_CLASS}
            aria-label={mapLabel}
            onNodeClick={(_event, node) =>
              applySelection(
                activeSelection?.kind === "activity" && activeSelection.id === node.id
                  ? null
                  : { kind: "activity", id: node.id },
              )
            }
            onEdgeClick={(_event, edge) =>
              applySelection(
                activeSelection?.kind === "transition" && activeSelection.id === edge.id
                  ? null
                  : { kind: "transition", id: edge.id },
              )
            }
            onNodeMouseEnter={handleNodeEnter}
            onNodeMouseLeave={handleNodeLeave}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              openMenuFor({ kind: "activity", id: node.id });
            }}
            onEdgeContextMenu={(event, edge) => {
              event.preventDefault();
              openMenuFor({ kind: "transition", id: edge.id });
            }}
            onPaneClick={() => applySelection(null)}
            onNodesChange={handleNodesChange}
          >
            {/* `bottom-right` is the minimap's corner; the controls take the other
                bottom corner so a pannable/zoomable minimap never sits on top of them
                (#350). The top rail (legend + filter trigger) already owns the top. */}
            <ZoomControls position="bottom-left" />
            {showMiniMap ? <FlowMiniMap pannable zoomable /> : null}
          </CanvasShell>
        </ProcessMapEdgeKeyContext>
      </ProcessMapHoverContext>

      <div
        data-slot="process-map-top-rail"
        className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3"
      >
        {showLegend ? (
          <Legend
            variant="scale"
            kind="width"
            domain={model.edgeDomain}
            format={model.formatEdgeValue}
            title={model.edgeMetricLabel}
            className="pointer-events-auto"
          />
        ) : (
          <span />
        )}
        <div className="pointer-events-auto">{filterMenu}</div>
      </div>
    </div>
  );
}

/**
 * Remember how to FIND the element focus should come back to — not the element itself.
 *
 * An edge's label pill is rendered through React Flow's `EdgeLabelRenderer`, a portal
 * whose children are RE-CREATED on a re-render (measured: opening the filter menu replaces
 * all fifteen pill buttons in the shipped fixture). By the time the menu closes, the
 * button the user was standing on is detached and focusing it does nothing. A node wrapper
 * does survive, so it is found again by its `data-id`; a portalled label is found by its
 * position among its siblings in the label layer, which is stable because React reconciles
 * the portals in edge order.
 */
function focusRestorer(element: HTMLElement): () => void {
  const flowId = element.closest<HTMLElement>("[data-id]")?.dataset.id;
  const slot = element.dataset.slot;
  const layer = element.closest<HTMLElement>(".react-flow__edgelabel-renderer");
  const peers =
    slot && layer ? [...layer.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)] : [];
  const index = peers.indexOf(element);
  const root = element.closest<HTMLElement>('[data-slot="process-map"]');

  return () => {
    if (element.isConnected) {
      element.focus();
      return;
    }
    if (flowId && root) {
      root.querySelector<HTMLElement>(`[data-id="${CSS.escape(flowId)}"]`)?.focus();
      return;
    }
    if (slot && index >= 0 && layer?.isConnected) {
      layer.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)[index]?.focus();
    }
  };
}

/** Stable empty arrays, so a graph-less render does not churn the layout hook's inputs. */
const EMPTY_NODES: ProcessMapModel["nodes"] = [];
const EMPTY_EDGES: ProcessMapModel["edges"] = [];

/**
 * Re-apply the laid-out positions onto the second-pass model, IN LAID-OUT ORDER.
 *
 * The layout hook positions the FIRST-pass nodes; the second pass rebuilds them with
 * back-edge knowledge, which produces new objects at the origin again. Matching on id is
 * the same trick `applyLayoutSnapshot` uses, one level up.
 *
 * The sort is the other half, and it is load-bearing for the keyboard: React Flow renders
 * node wrappers in array order, and each wrapper is a tab stop, so the array order IS the
 * tab order. Mapping over `model.nodes` made that MODEL order — which is discovery order,
 * so `Tab` could reach a mid-process activity before the start one. Reading down the graph
 * (`TB`: ascending `y`, then `x`; `LR`: the transpose) is what a sighted user's eye does,
 * so it is what `Tab` should do. Ties break on id so the order is total and stable — dagre
 * gives whole ranks the same coordinate.
 *
 * This runs AFTER `useProcessLayout`, on its output; the hook's inputs and its cache key
 * are untouched, so re-ordering here cannot make the layout re-run.
 */
function applyPositions(
  model: ProcessMapModel,
  layout: UseProcessLayoutResult,
  direction: FlowLayoutDirection,
) {
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const positioned = model.nodes.map((node) => {
    const laidOut = byId.get(node.id);
    if (!laidOut) return node;
    return {
      ...node,
      position: laidOut.position,
      sourcePosition: laidOut.sourcePosition,
      targetPosition: laidOut.targetPosition,
    };
  });

  const alongFlow = direction === "LR" || direction === "RL" ? "x" : "y";
  const acrossFlow = alongFlow === "x" ? "y" : "x";
  // `BT`/`RL` lay rank 0 out at the HIGH end of the flow axis, so reading order down the
  // process is descending there — the sign, not a different axis.
  const sign = direction === "BT" || direction === "RL" ? -1 : 1;
  return positioned.sort((a, b) => {
    const along = sign * (a.position[alongFlow] - b.position[alongFlow]);
    if (along !== 0) return along;
    const across = a.position[acrossFlow] - b.position[acrossFlow];
    if (across !== 0) return across;
    return a.id.localeCompare(b.id);
  });
}
