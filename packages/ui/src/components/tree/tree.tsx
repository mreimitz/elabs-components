// a2ui.exposed: yes
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronRight, AlertCircle, RotateCcw } from "lucide-react";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/cn";
import { Checkbox } from "../checkbox/checkbox";
import { useLocale } from "../locale-provider";
import { Skeleton } from "../skeleton/skeleton";
import { Spinner } from "../spinner/spinner";
import { useTreeKeyboard } from "./use-tree-keyboard";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TreeNode<T = unknown> {
  id: string;
  label: ReactNode;
  children?: TreeNode<T>[];
  /**
   * Marks a node as expandable even when `children` is not yet loaded.
   * A node with `hasChildren: true` and no `children` array will show the
   * expand affordance. Calling `loadChildren` will populate its children.
   */
  hasChildren?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  /**
   * Optional trailing content rendered after the label — e.g. a size or
   * token-count badge (#369). Rendered as a SIBLING of the label and kept out
   * of the row's accessible name: a string `label` names the row via
   * `aria-label`, a `ReactNode` label names it via `aria-labelledby` pointing
   * at the label span only, so the accessory text never joins either.
   *
   * The slot is isolated from the row: click, keydown and focus are stopped at
   * the accessory, so it never selects/expands the row, never lets the tree's
   * roving-tabindex handler swallow its keys, and never has focus yanked back
   * to the row. Interactive content (a button, a link) therefore works and is
   * independently focusable in normal tab order; the row's own keyboard
   * navigation (arrow keys, Enter/Space) is unaffected while the row is focused.
   */
  accessory?: ReactNode;
  data?: T;
}

export interface TreeProps<T = unknown> extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  nodes: TreeNode<T>[];
  /** Controlled expanded ids */
  expandedIds?: string[];
  /** Uncontrolled initial expanded ids */
  defaultExpandedIds?: string[];
  onExpandedChange?: (ids: string[]) => void;
  /** "single" | "multiple" | "none" — default "single" */
  selectionMode?: "single" | "multiple" | "none";
  /** Controlled selected ids */
  selectedIds?: string[];
  /** Uncontrolled initial selected ids */
  defaultSelectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Show checkboxes for multi-selection affordance — default false */
  checkboxes?: boolean;
  /**
   * The surface on which the tree is rendered.
   * - `"default"` (default) — renders selected rows with `bg-accent` (for use on
   *   background/card surfaces).
   * - `"sidebar"` — renders selected rows with the sidebar's own active-item
   *   treatment (`bg-sidebar-accent` + `text-sidebar-accent-foreground` +
   *   `font-medium`), so selection reads consistently with `SidebarMenuButton`'s
   *   active state on the `--sidebar` surface. (No fill is ≥3:1 on a sidebar;
   *   perceivability comes from the foreground/weight shift + `aria-selected`,
   *   the same multi-cue approach the Sidebar uses.)
   */
  surface?: "default" | "sidebar";
  /**
   * Enable windowed rendering for large trees (>50 visible rows).
   * When `true`, only the visible slice of the flattened tree is mounted in
   * the DOM. Requires a bounded scroll container — either via `maxHeight` or
   * by sizing the root element externally with `overflow-auto`.
   * Default: `false` (backward-compatible nested-group DOM).
   */
  virtualize?: boolean;
  /** Estimated row height in px used by the virtualizer. Default 32. */
  estimateRowHeight?: number;
  /** Number of extra rows to render beyond the visible window. Default 8. */
  overscan?: number;
  /**
   * CSS max-height for the scroll viewport when `virtualize` is true.
   * E.g. `"400px"` or `"60vh"`. When omitted the root div must be sized by
   * the caller (e.g. via `className="h-96 overflow-auto"`).
   */
  maxHeight?: number | string;
  /**
   * Scroll the node with this id into view when the value CHANGES. Reveals a
   * node selected programmatically (via `selectedIds`) that is windowed out of
   * the DOM in `virtualize` mode (or below the fold), so the tree shows "where
   * I am", not just structure. Expands the node's (loaded) ancestors and kicks
   * their lazy `loadChildren` as needed, then centers the node. Independent of
   * keyboard focus (keyboard nav's own scroll is unchanged).
   */
  scrollToId?: string;
  /**
   * When `true`, reveal the newly-selected controlled node (the id added to
   * `selectedIds`) into view — the selection-driven equivalent of `scrollToId`.
   * `scrollToId` wins when both are set.
   */
  scrollSelectionIntoView?: boolean;
  /**
   * Async function called when a node with `hasChildren: true` (and no
   * loaded `children`) is expanded for the first time. The returned nodes
   * are merged into the internal tree state and cached so re-expanding the
   * node does not re-fetch.
   */
  loadChildren?: (node: TreeNode<T>) => Promise<TreeNode<T>[]>;
  className?: string;
}

// ---------------------------------------------------------------------------
// Internal types for lazy-load state
// ---------------------------------------------------------------------------

type LoadState = "idle" | "loading" | "error";

interface LazyState {
  [nodeId: string]: LoadState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useControllableSet(
  controlled: string[] | undefined,
  defaultValue: string[] | undefined,
  onChange: ((ids: string[]) => void) | undefined,
): [Set<string>, (next: Set<string>) => void] {
  const isControlled = controlled !== undefined;
  const [internal, setInternal] = useState<Set<string>>(
    () => new Set(controlled ?? defaultValue ?? []),
  );

  const value: Set<string> = isControlled ? new Set(controlled) : internal;

  const setValue = useCallback(
    (next: Set<string>) => {
      if (!isControlled) setInternal(next);
      onChange?.(Array.from(next));
    },
    [isControlled, onChange],
  );

  return [value, setValue];
}

/** Merge resolved children into a tree, returning a new tree. */
function mergeChildren<T>(
  nodes: TreeNode<T>[],
  nodeId: string,
  children: TreeNode<T>[],
): TreeNode<T>[] {
  return nodes.map((n) => {
    if (n.id === nodeId) {
      return { ...n, children, hasChildren: undefined };
    }
    if (n.children?.length) {
      return { ...n, children: mergeChildren(n.children, nodeId, children) };
    }
    return n;
  });
}

// ---------------------------------------------------------------------------
// VirtualFlatRow — a single flat row for the virtualized path
// ---------------------------------------------------------------------------

interface FlatRow<T> {
  node: TreeNode<T>;
  level: number;
  setSize: number;
  posInSet: number;
}

interface VirtualFlatRowProps<T> {
  row: FlatRow<T>;
  isExpanded: boolean;
  isSelected: boolean;
  isActive: boolean;
  lazyState: LoadState;
  expandable: boolean; // has children OR hasChildren flag
  selectionMode: "single" | "multiple" | "none";
  checkboxes: boolean;
  surface: "default" | "sidebar";
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onRetry: (id: string) => void;
  registerNodeRef: (id: string, el: HTMLElement | null) => void;
  setActiveId: (id: string | null) => void;
}

function VirtualFlatRow<T>({
  row,
  isExpanded,
  isSelected,
  isActive,
  lazyState,
  expandable,
  selectionMode,
  checkboxes,
  surface,
  onToggleExpand,
  onSelect,
  onRetry,
  registerNodeRef,
  setActiveId,
}: VirtualFlatRowProps<T>) {
  const { t } = useLocale();
  const { node, level, setSize, posInSet } = row;
  const isLoading = lazyState === "loading";
  const isError = lazyState === "error";
  // A ReactNode label can't name the row via `aria-label`, so without this the
  // name would fall back to the row's CONTENTS — which includes the accessory
  // (#369). Point at the label span instead, so the accessory is excluded for
  // BOTH label shapes.
  const labelId = useId();

  const indentStyle = { paddingLeft: `${(level - 1) * 1}rem` };

  const handleRowClick = () => {
    if (node.disabled) return;
    setActiveId(node.id);
    onSelect(node.id);
    if (expandable) onToggleExpand(node.id);
  };

  return (
    <div
      role="treeitem"
      aria-expanded={expandable ? isExpanded : undefined}
      aria-selected={selectionMode !== "none" && !checkboxes ? isSelected : undefined}
      aria-checked={checkboxes ? isSelected : undefined}
      aria-label={typeof node.label === "string" ? node.label : undefined}
      aria-labelledby={typeof node.label === "string" ? undefined : labelId}
      aria-level={level}
      aria-setsize={setSize}
      aria-posinset={posInSet}
      aria-disabled={node.disabled ? true : undefined}
      aria-busy={isLoading ? true : undefined}
      tabIndex={isActive ? 0 : -1}
      data-tree-id={node.id}
      ref={(el) => registerNodeRef(node.id, el)}
      onClick={node.disabled ? undefined : handleRowClick}
      onFocus={() => setActiveId(node.id)}
      className={cn(
        "flex min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-1.5 text-body outline-none",
        "transition-colors duration-fast ease-standard motion-reduce:transition-none",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        isSelected &&
          selectionMode !== "none" &&
          (surface === "sidebar"
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "bg-accent text-accent-foreground font-medium"),
        node.disabled && "cursor-not-allowed opacity-50 pointer-events-none",
      )}
      style={indentStyle}
    >
      {/* expand/collapse chevron */}
      {expandable ? (
        <span
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded transition-transform duration-fast ease-standard motion-reduce:transition-none",
            isExpanded && "rotate-90",
          )}
        >
          {isLoading ? (
            <Spinner className="size-3.5" label="Loading children" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          )}
        </span>
      ) : (
        <span aria-hidden="true" className="size-4 shrink-0" />
      )}

      {/* optional checkbox for multi-select */}
      {checkboxes && selectionMode === "multiple" && (
        <Checkbox
          checked={isSelected}
          disabled={node.disabled}
          aria-hidden="true"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node.id);
          }}
          className="shrink-0"
        />
      )}

      {/* optional node icon */}
      {node.icon && (
        <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
          {node.icon}
        </span>
      )}

      {/* label */}
      {isError ? (
        <span id={labelId} className="min-w-0 flex items-center gap-1 text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{t("ui.tree.failedToLoad")}</span>
          <button
            type="button"
            aria-label="Retry loading children"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(node.id);
            }}
            className={cn(
              "ms-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-caption",
              "text-muted-foreground hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Retry
          </button>
        </span>
      ) : (
        <span id={labelId} className="min-w-0 truncate">
          {node.label}
        </span>
      )}

      {/* optional trailing accessory — a sibling of the label, never inside it
          and never part of the row's accessible name (#369); click/keydown/focus
          are stopped so it never selects, expands or steals the row's handling. */}
      {node.accessory ? (
        <span
          data-slot="tree-item-accessory"
          className="ms-auto flex shrink-0 items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          // The tree's keyboard handler lives on the ROOT and preventDefaults
          // Enter/Space/arrows; without this an interactive accessory could
          // never be activated (its native click is cancelled) and the ROW
          // would be selected instead.
          onKeyDown={(e) => e.stopPropagation()}
          // React's onFocus is focusin (it bubbles), and the row's handler
          // calls setActiveId → el.focus(), which would yank focus straight
          // back out of an interactive accessory.
          onFocus={(e) => e.stopPropagation()}
        >
          {node.accessory}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lazy-loading skeleton row (child of a loading node in non-virtual path)
// ---------------------------------------------------------------------------

function LoadingRow({ level }: { level: number }) {
  const indentStyle = { paddingLeft: `${(level - 1) * 1}rem` };
  return (
    <div
      role="treeitem"
      aria-label="Loading…"
      aria-disabled="true"
      tabIndex={-1}
      className="flex min-w-0 items-center gap-1.5 px-2 py-1.5"
      style={indentStyle}
    >
      <span aria-hidden="true" className="size-4 shrink-0" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

function ErrorRow({ level, onRetry }: { level: number; onRetry: () => void }) {
  const { t } = useLocale();
  const indentStyle = { paddingLeft: `${(level - 1) * 1}rem` };
  return (
    <div
      role="treeitem"
      aria-label={t("ui.tree.failedToLoad")}
      aria-disabled="true"
      tabIndex={-1}
      className="flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-body text-destructive"
      style={indentStyle}
    >
      <span aria-hidden="true" className="size-4 shrink-0" />
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{t("ui.tree.failedToLoad")}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className={cn(
          "ms-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-xs",
          "text-muted-foreground hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <RotateCcw className="size-3" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TreeItemRow — renders a single treeitem row (recursive, non-virtual path)
// ---------------------------------------------------------------------------

interface TreeItemProps<T> {
  node: TreeNode<T>;
  level: number;
  setSize: number;
  posInSet: number;
  expandedIds: Set<string>;
  onExpandedChange: (ids: Set<string>) => void;
  selectionMode: "single" | "multiple" | "none";
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  checkboxes: boolean;
  surface: "default" | "sidebar";
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  registerNodeRef: (id: string, el: HTMLElement | null) => void;
  lazyState: LazyState;
  onExpandLazy: (node: TreeNode<T>) => void;
}

function TreeItem<T>({
  node,
  level,
  setSize,
  posInSet,
  expandedIds,
  onExpandedChange,
  selectionMode,
  selectedIds,
  onSelectionChange,
  checkboxes,
  surface,
  activeId,
  setActiveId,
  registerNodeRef,
  lazyState,
  onExpandLazy,
}: TreeItemProps<T>) {
  const hasLoadedChildren = !!node.children?.length;
  // A node is expandable if it has loaded children OR the hasChildren flag is set
  const expandable = hasLoadedChildren || !!node.hasChildren;
  const isExpanded = expandable && expandedIds.has(node.id);
  const isSelected = selectedIds.has(node.id);
  const isActive = activeId === node.id;
  const nodeLoadState: LoadState = lazyState[node.id] ?? "idle";
  const isLoading = nodeLoadState === "loading";
  const isError = nodeLoadState === "error";
  // See VirtualFlatRow: a ReactNode label must name the row via `aria-labelledby`
  // so the trailing accessory never joins the accessible name (#369).
  const labelId = useId();

  const toggleExpanded = () => {
    if (!expandable) return;
    const next = new Set(expandedIds);
    if (isExpanded) {
      next.delete(node.id);
    } else {
      next.add(node.id);
      // If no loaded children yet, trigger lazy load
      if (!hasLoadedChildren && node.hasChildren) {
        onExpandLazy(node);
      }
    }
    onExpandedChange(next);
  };

  const handleSelect = () => {
    if (node.disabled || selectionMode === "none") return;
    setActiveId(node.id);
    if (selectionMode === "single") {
      onSelectionChange(new Set([node.id]));
    } else {
      const next = new Set(selectedIds);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      onSelectionChange(next);
    }
  };

  const handleRowClick = () => {
    setActiveId(node.id);
    handleSelect();
    if (expandable) toggleExpanded();
  };

  const indentStyle = { paddingLeft: `${(level - 1) * 1}rem` };

  return (
    <li role="none">
      {/* treeitem row */}
      <div
        role="treeitem"
        aria-expanded={expandable ? isExpanded : undefined}
        aria-selected={selectionMode !== "none" && !checkboxes ? isSelected : undefined}
        aria-checked={checkboxes ? isSelected : undefined}
        aria-label={typeof node.label === "string" ? node.label : undefined}
        aria-labelledby={typeof node.label === "string" ? undefined : labelId}
        aria-level={level}
        aria-setsize={setSize}
        aria-posinset={posInSet}
        aria-disabled={node.disabled ? true : undefined}
        aria-busy={isLoading ? true : undefined}
        tabIndex={isActive ? 0 : -1}
        data-tree-id={node.id}
        ref={(el) => registerNodeRef(node.id, el)}
        onClick={node.disabled ? undefined : handleRowClick}
        onFocus={() => setActiveId(node.id)}
        className={cn(
          "flex min-w-0 cursor-pointer select-none items-center gap-1.5 rounded-md px-2 py-1.5 text-body outline-none",
          "transition-colors duration-fast ease-standard motion-reduce:transition-none",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          isSelected &&
            selectionMode !== "none" &&
            (surface === "sidebar"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "bg-accent text-accent-foreground font-medium"),
          node.disabled && "cursor-not-allowed opacity-50 pointer-events-none",
        )}
        style={indentStyle}
      >
        {/* expand/collapse chevron */}
        {expandable ? (
          <span
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded transition-transform duration-fast ease-standard motion-reduce:transition-none",
              isExpanded && !isLoading && "rotate-90",
            )}
          >
            {isLoading ? (
              <Spinner className="size-3.5" label="Loading children" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
          </span>
        ) : (
          <span aria-hidden="true" className="size-4 shrink-0" />
        )}

        {/* optional checkbox for multi-select */}
        {checkboxes && selectionMode === "multiple" && (
          <Checkbox
            checked={isSelected}
            disabled={node.disabled}
            aria-hidden="true"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect();
            }}
            className="shrink-0"
          />
        )}

        {/* optional node icon */}
        {node.icon && (
          <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
            {node.icon}
          </span>
        )}

        {/* label */}
        <span id={labelId} className="min-w-0 truncate">
          {node.label}
        </span>

        {/* optional trailing accessory — a sibling of the label, never inside
            it and never part of the row's accessible name (#369);
            click/keydown/focus are stopped at the accessory. */}
        {node.accessory ? (
          <span
            data-slot="tree-item-accessory"
            className="ms-auto flex shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            // See VirtualFlatRow: the tree's root keydown handler preventDefaults
            // Enter/Space/arrows, and the row's onFocus (focusin, bubbling) calls
            // setActiveId → el.focus(). Both must stop at the accessory or
            // interactive content in this slot is unusable.
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
          >
            {node.accessory}
          </span>
        ) : null}
      </div>

      {/* children group */}
      {isExpanded && (
        <ul role="group" className="list-none m-0 p-0">
          {isLoading ? (
            <li role="none">
              <LoadingRow level={level + 1} />
            </li>
          ) : isError ? (
            <li role="none">
              <ErrorRow level={level + 1} onRetry={() => onExpandLazy(node)} />
            </li>
          ) : (
            node.children?.map((child, i) => (
              <TreeItem
                key={child.id}
                node={child}
                level={level + 1}
                setSize={node.children!.length}
                posInSet={i + 1}
                expandedIds={expandedIds}
                onExpandedChange={onExpandedChange}
                selectionMode={selectionMode}
                selectedIds={selectedIds}
                onSelectionChange={onSelectionChange}
                checkboxes={checkboxes}
                surface={surface}
                activeId={activeId}
                setActiveId={setActiveId}
                registerNodeRef={registerNodeRef}
                lazyState={lazyState}
                onExpandLazy={onExpandLazy}
              />
            ))
          )}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// flattenVisibleWithMeta — for the virtual path
// ---------------------------------------------------------------------------

function flattenVisibleWithMeta<T>(
  nodes: TreeNode<T>[],
  expandedIds: Set<string>,
  lazyState: LazyState,
  level = 1,
  parentSetSize?: number,
): FlatRow<T>[] {
  const result: FlatRow<T>[] = [];
  const setSize = parentSetSize ?? nodes.length;
  nodes.forEach((node, i) => {
    result.push({
      node,
      level,
      setSize,
      posInSet: i + 1,
    });
    const hasLoadedChildren = !!node.children?.length;
    const isExpandable = hasLoadedChildren || !!node.hasChildren;
    if (isExpandable && expandedIds.has(node.id)) {
      const nodeLoad = lazyState[node.id];
      if (nodeLoad === "loading" || nodeLoad === "error") {
        // placeholder row represented by a synthetic "loading/error" node
        // We don't push a row here — the loading/error state is shown via
        // aria-busy on the parent treeitem row (virtual path inline indicators)
      } else if (hasLoadedChildren) {
        const childRows = flattenVisibleWithMeta(
          node.children!,
          expandedIds,
          lazyState,
          level + 1,
          node.children!.length,
        );
        result.push(...childRows);
      }
    }
  });
  return result;
}

// ---------------------------------------------------------------------------
// Tree — root component
// ---------------------------------------------------------------------------

/**
 * A fully accessible tree view with roving tabindex keyboard navigation,
 * single/multiple selection, expand/collapse, checkboxes, and type-ahead.
 *
 * Set `virtualize` to window large trees (>50 visible rows). Set `loadChildren`
 * to lazily fetch children on demand when a node has `hasChildren: true`.
 */
/** Ancestor ids (root → parent) of `id` within the loaded tree, or `null` if absent. */
function findNodePath(nodes: TreeNode[], id: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.id === id) return trail;
    if (n.children?.length) {
      const found = findNodePath(n.children, id, [...trail, n.id]);
      if (found) return found;
    }
  }
  return null;
}

/** The node with `id` within the loaded tree, or `null`. */
function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

export const Tree = forwardRef<HTMLDivElement, TreeProps>(function Tree(
  {
    nodes: nodesProp,
    expandedIds: expandedIdsProp,
    defaultExpandedIds,
    onExpandedChange,
    selectionMode = "single",
    selectedIds: selectedIdsProp,
    defaultSelectedIds,
    onSelectionChange,
    checkboxes = false,
    virtualize = false,
    estimateRowHeight = 32,
    overscan = 8,
    maxHeight,
    scrollToId,
    scrollSelectionIntoView = false,
    loadChildren,
    surface = "default",
    className,
    ...props
  },
  ref,
) {
  // Internal mutable tree (supports lazy-loaded children merge)
  const [nodes, setNodes] = useState<TreeNode[]>(() => nodesProp as TreeNode[]);

  // Keep internal tree in sync with nodesProp if it changes externally
  useEffect(() => {
    setNodes(nodesProp as TreeNode[]);
  }, [nodesProp]);

  const [expandedIds, setExpandedIds] = useControllableSet(
    expandedIdsProp,
    defaultExpandedIds,
    onExpandedChange,
  );
  const [selectedIds, setSelectedIds] = useControllableSet(
    selectedIdsProp,
    defaultSelectedIds,
    onSelectionChange,
  );

  // Lazy-load state per node id
  const [lazyState, setLazyState] = useState<LazyState>({});

  // Scroll container ref for virtualizer
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pending focus id — used when the target row isn't yet mounted (virtual path)
  const pendingFocusIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Lazy load handler
  // ---------------------------------------------------------------------------

  const handleExpandLazy = useCallback(
    async (node: TreeNode) => {
      if (!loadChildren) return;
      if (lazyState[node.id] === "loading") return;

      setLazyState((prev) => ({ ...prev, [node.id]: "loading" }));
      try {
        const children = await loadChildren(node as TreeNode<unknown>);
        setNodes((prev) => mergeChildren(prev, node.id, children as TreeNode[]));
        setLazyState((prev) => {
          const next = { ...prev };
          delete next[node.id];
          return next;
        });
      } catch {
        setLazyState((prev) => ({ ...prev, [node.id]: "error" }));
      }
    },
    [loadChildren, lazyState],
  );

  // ---------------------------------------------------------------------------
  // Flattened visible rows (for virtualized path and keyboard hook)
  // ---------------------------------------------------------------------------

  const flatRows = flattenVisibleWithMeta(nodes, expandedIds, lazyState);
  const flatNodeIds = flatRows.map((r) => r.node.id);

  // ---------------------------------------------------------------------------
  // Keyboard hook
  // ---------------------------------------------------------------------------

  // For the virtual path: when navigating to a node whose DOM is not mounted,
  // we need to scroll to it first and then focus when it mounts.
  // We achieve this by passing a scrollToIndex callback to the keyboard hook.

  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);

  const scrollToVirtualIndex = useCallback((index: number) => {
    virtualizerRef.current?.scrollToIndex(index, { align: "auto" });
  }, []);

  const { activeId, setActiveId, registerNodeRef, onKeyDown } = useTreeKeyboard({
    nodes,
    expandedIds,
    onExpandedChange: setExpandedIds,
    selectionMode,
    selectedIds,
    onSelectionChange: setSelectedIds,
    // Virtualization-aware extras
    virtualize,
    flatNodeIds,
    pendingFocusIdRef,
    scrollToVirtualIndex,
  });

  // ---------------------------------------------------------------------------
  // Handle expand/collapse for virtual path (needs to call lazy loader)
  // ---------------------------------------------------------------------------

  const handleToggleExpand = useCallback(
    (nodeId: string) => {
      const flatRow = flatRows.find((r) => r.node.id === nodeId);
      if (!flatRow) return;
      const node = flatRow.node;
      const hasLoadedChildren = !!node.children?.length;
      const next = new Set(expandedIds);
      if (expandedIds.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
        if (!hasLoadedChildren && node.hasChildren && loadChildren) {
          handleExpandLazy(node);
        }
      }
      setExpandedIds(next);
    },
    [expandedIds, flatRows, setExpandedIds, loadChildren, handleExpandLazy],
  );

  const handleSelectVirtual = useCallback(
    (nodeId: string) => {
      const flatRow = flatRows.find((r) => r.node.id === nodeId);
      if (!flatRow) return;
      const node = flatRow.node;
      if (node.disabled || selectionMode === "none") return;
      if (selectionMode === "single") {
        setSelectedIds(new Set([nodeId]));
      } else {
        const next = new Set(selectedIds);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        setSelectedIds(next);
      }
    },
    [flatRows, selectionMode, selectedIds, setSelectedIds],
  );

  // ---------------------------------------------------------------------------
  // Layout effect to flush pending focus once a row mounts (virtual path)
  // ---------------------------------------------------------------------------

  // This runs after every render; if pendingFocusIdRef has an id, try to focus it.
  // The registerNodeRef callback will have stored the element if it mounted.
  // We use useLayoutEffect so the DOM is painted before we try to focus.
  const nodeRefsForFlush = useRef<Map<string, HTMLElement>>(new Map());

  const registerAndFlush = useCallback(
    (id: string, el: HTMLElement | null) => {
      registerNodeRef(id, el);
      if (el) {
        nodeRefsForFlush.current.set(id, el);
        if (pendingFocusIdRef.current === id) {
          pendingFocusIdRef.current = null;
          el.focus();
        }
      } else {
        nodeRefsForFlush.current.delete(id);
      }
    },
    [registerNodeRef],
  );

  // ---------------------------------------------------------------------------
  // Virtualizer (only created in virtual mode)
  // ---------------------------------------------------------------------------

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => (virtualize ? scrollRef.current : null),
    estimateSize: () => estimateRowHeight,
    overscan,
    enabled: virtualize,
  });

  // Keep ref so keyboard handler can call scrollToIndex
  useEffect(() => {
    if (virtualize) {
      virtualizerRef.current = virtualizer;
    }
  });

  // ---------------------------------------------------------------------------
  // Reveal-into-view (scrollToId / scrollSelectionIntoView)
  // ---------------------------------------------------------------------------

  // Set while a requested node isn't yet a visible row (its ancestors are still
  // expanding / lazy-loading); the retry effect finishes once the rows change.
  const pendingRevealIdRef = useRef<string | null>(null);
  const prevSelectedRef = useRef<Set<string>>(selectedIds);
  const prevScrollToIdRef = useRef<string | undefined>(undefined);

  // Scroll `id` into view if it is currently a visible row. Virtual mode drives
  // the virtualizer (the row may be unmounted); non-virtual uses the mounted DOM
  // node (registered via registerAndFlush in both paths).
  const scrollNodeIntoView = useCallback(
    (id: string): boolean => {
      const index = flatNodeIds.indexOf(id);
      if (index < 0) return false;
      if (virtualize) {
        virtualizerRef.current?.scrollToIndex(index, { align: "center" });
      } else {
        // `?.` on scrollIntoView too — jsdom doesn't implement it (browser-only).
        nodeRefsForFlush.current.get(id)?.scrollIntoView?.({ block: "center" });
      }
      return true;
    },
    [flatNodeIds, virtualize],
  );

  // Reveal `id`: scroll it now if visible, else expand its (loaded) ancestors and
  // kick their lazy loaders so it becomes a row — the retry effect finishes the job.
  const revealNode = useCallback(
    (id: string) => {
      if (scrollNodeIntoView(id)) {
        pendingRevealIdRef.current = null;
        return;
      }
      pendingRevealIdRef.current = id;
      const path = findNodePath(nodes, id);
      if (!path || path.length === 0) return; // unknown / not yet loaded — best effort
      const next = new Set(expandedIds);
      path.forEach((ancestorId) => next.add(ancestorId));
      setExpandedIds(next);
      if (loadChildren) {
        for (const ancestorId of path) {
          const anc = findNodeById(nodes, ancestorId);
          if (anc && anc.hasChildren && !anc.children?.length) void handleExpandLazy(anc);
        }
      }
    },
    [scrollNodeIntoView, nodes, expandedIds, setExpandedIds, loadChildren, handleExpandLazy],
  );

  // Latest revealNode so the trigger effect fires on target CHANGE only (without
  // re-running when flatNodeIds / expandedIds churn each render).
  const revealNodeRef = useRef(revealNode);
  revealNodeRef.current = revealNode;

  // Trigger: reveal when `scrollToId` changes; else (scrollSelectionIntoView) when
  // the selection gains a node. `scrollToId` wins.
  useEffect(() => {
    const scrollIdChanged = scrollToId !== prevScrollToIdRef.current;
    const selectionChanged = selectedIds !== prevSelectedRef.current;
    const prevSel = prevSelectedRef.current;
    prevScrollToIdRef.current = scrollToId;
    prevSelectedRef.current = selectedIds;

    if (scrollToId != null && scrollIdChanged) {
      revealNodeRef.current(scrollToId);
    } else if (scrollToId == null && scrollSelectionIntoView && selectionChanged) {
      const added = [...selectedIds].find((sid) => !prevSel.has(sid));
      const target = added ?? (selectedIds.size > 0 ? [...selectedIds][0] : undefined);
      if (target != null) revealNodeRef.current(target);
    }
  }, [scrollToId, scrollSelectionIntoView, selectedIds]);

  // Retry a pending reveal after the rows change (ancestors expanded / lazy data
  // arrived) — scroll once the node materialises, then clear.
  useEffect(() => {
    const id = pendingRevealIdRef.current;
    if (id != null && scrollNodeIntoView(id)) {
      pendingRevealIdRef.current = null;
    }
  }, [scrollNodeIntoView]);

  // ---------------------------------------------------------------------------
  // Render: NON-virtual path (backward compatible nested-group DOM)
  // ---------------------------------------------------------------------------

  if (!virtualize) {
    return (
      <div
        ref={ref}
        role="tree"
        aria-multiselectable={selectionMode === "multiple" ? true : undefined}
        onKeyDown={onKeyDown}
        className={cn("w-full select-none", className)}
        {...props}
      >
        <ul role="none" className="m-0 list-none p-0">
          {nodes.map((node, i) => (
            <TreeItem
              key={node.id}
              node={node}
              level={1}
              setSize={nodes.length}
              posInSet={i + 1}
              expandedIds={expandedIds}
              onExpandedChange={setExpandedIds}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              checkboxes={checkboxes}
              surface={surface}
              activeId={activeId}
              setActiveId={setActiveId}
              // registerAndFlush (not raw registerNodeRef) so nodeRefsForFlush is
              // populated in the non-virtual path too — lets scrollToId reveal a
              // below-the-fold node. pendingFocusIdRef is virtual-only, so the
              // focus-flush branch never fires here: keyboard behavior is unchanged.
              registerNodeRef={registerAndFlush}
              lazyState={lazyState}
              onExpandLazy={handleExpandLazy}
            />
          ))}
        </ul>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: VIRTUAL path (flat DOM, windowed rows)
  // ---------------------------------------------------------------------------

  const virtualItems = virtualizer.getVirtualItems();

  const scrollStyle: React.CSSProperties = maxHeight
    ? { maxHeight, overflowY: "auto" }
    : { overflowY: "auto" };

  return (
    <div
      ref={ref}
      role="tree"
      aria-multiselectable={selectionMode === "multiple" ? true : undefined}
      onKeyDown={onKeyDown}
      className={cn("w-full select-none", className)}
      {...props}
    >
      {/* Scroll viewport — role="presentation" so the tree still OWNS the
          treeitems (windowing wrappers are skipped in the a11y tree, keeping
          aria-required-children valid). */}
      <div ref={scrollRef} role="presentation" style={scrollStyle} className="outline-none">
        {/* Total-size spacer — gives the scroll container its full height */}
        <div
          role="presentation"
          style={{ height: virtualizer.getTotalSize(), position: "relative" }}
        >
          {virtualItems.map((virtualRow) => {
            const row = flatRows[virtualRow.index];
            if (!row) return null;
            const { node } = row;
            const hasLoadedChildren = !!node.children?.length;
            const expandable = hasLoadedChildren || !!node.hasChildren;
            const isExpanded = expandable && expandedIds.has(node.id);
            const isSelected = selectedIds.has(node.id);
            const isActive = activeId === node.id;
            const nodeLoad: LoadState = lazyState[node.id] ?? "idle";

            return (
              <div
                key={virtualRow.key}
                role="presentation"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <VirtualFlatRow
                  row={row}
                  isExpanded={isExpanded}
                  isSelected={isSelected}
                  isActive={isActive}
                  lazyState={nodeLoad}
                  expandable={expandable}
                  selectionMode={selectionMode}
                  checkboxes={checkboxes}
                  surface={surface}
                  onToggleExpand={handleToggleExpand}
                  onSelect={handleSelectVirtual}
                  onRetry={() => handleExpandLazy(node)}
                  registerNodeRef={registerAndFlush}
                  setActiveId={setActiveId}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}) as <T = unknown>(
  props: TreeProps<T> & { ref?: React.Ref<HTMLDivElement> },
) => React.ReactElement | null;
