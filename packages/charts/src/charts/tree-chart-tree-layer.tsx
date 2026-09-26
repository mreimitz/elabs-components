"use client";

/**
 * The keyboard and screen-reader face of an expandable `TreeChart`: one APG
 * tree (`role="tree"`) of flat `role="treeitem"` boxes laid over the drawing.
 * The drawing itself stays `aria-hidden`; this layer is what focus lands on
 * and what assistive technology reads.
 *
 * Every item sits at its node's FINAL position — it never rides the
 * expand/collapse tween — so focus and hit-testing never wait on motion, and
 * an exiting node leaves the tree the moment it starts fading.
 *
 * Arrow keys, Home/End and typeahead come from ui's `useTreeKeyboard` (the
 * same hook the ui `Tree` uses). Enter, Space and `*` are handled here first,
 * because a chart's Enter means "drill in" when the host listens for it.
 */

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { cn, useTreeKeyboard, type TreeNode as UiTreeNode } from "@elabs-ai/components-ui";
import type {
  ResolvedTree,
  ResolvedTreeNode,
  TreeLayoutNode,
  TreeLayoutResult,
} from "./tree-chart-layout";
import { useChartTranslate } from "./chart-messages";

export interface TreeChartTreeLayerProps {
  layout: TreeLayoutResult<unknown>;
  resolved: ResolvedTree<unknown>;
  /** The branches whose children are laid out. */
  expanded: ReadonlySet<string>;
  /** A new expanded set, in depth-first order; `anchorId` is the node the reader acted on. */
  onExpandedChange: (ids: string[], anchorId: string) => void;
  /** The tree's accessible name. */
  label: string;
  /** Enter / a body click activate (drill in) instead of toggling. */
  canActivate: boolean;
  onActivate: (
    node: TreeLayoutNode<unknown>,
    event: ReactMouseEvent | ReactKeyboardEvent,
    source: "pointer" | "keyboard",
  ) => void;
  /** An item's accessible name. */
  nameOf: (node: TreeLayoutNode<unknown>) => string;
  /** The item holding the roving tab stop (already resolved to a visible node). */
  activeId: string | null;
  onActiveChange: (id: string) => void;
  /** Custom (`renderNode`) boxes get a rounder focus ring than a dot + label. */
  shape: "dot" | "box";
  onItemPointer?: (node: TreeLayoutNode<unknown>, event: ReactMouseEvent) => void;
  onItemLeave?: () => void;
  onItemFocus?: (node: TreeLayoutNode<unknown>) => void;
  /** Focus left the tree entirely. */
  onTreeBlur?: () => void;
  onEscape?: () => void;
}

function toUiNode(node: ResolvedTreeNode<unknown>): UiTreeNode {
  return {
    id: node.id,
    label: node.name,
    children: node.children.length > 0 ? node.children.map(toUiNode) : undefined,
  };
}

const NO_SELECTION = new Set<string>();
const noop = () => {};

export function TreeChartTreeLayer({
  layout,
  resolved,
  expanded,
  onExpandedChange,
  label,
  canActivate,
  onActivate,
  nameOf,
  activeId,
  onActiveChange,
  shape,
  onItemPointer,
  onItemLeave,
  onItemFocus,
  onTreeBlur,
  onEscape,
}: TreeChartTreeLayerProps) {
  const t = useChartTranslate();
  const treeRef = useRef<HTMLDivElement | null>(null);
  /** The item that last held focus, until focus genuinely leaves it. */
  const lastFocusedRef = useRef<string | null>(null);

  const uiNodes = useMemo(() => [toUiNode(resolved.root)], [resolved]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const nodeById = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout.nodes]);

  const emit = useCallback(
    (next: Set<string>, anchorId: string) => {
      const ordered = resolved.preorder.filter((n) => next.has(n.id)).map((n) => n.id);
      onExpandedChange(ordered, anchorId);
    },
    [onExpandedChange, resolved],
  );

  const kb = useTreeKeyboard({
    nodes: uiNodes,
    expandedIds: expandedSet,
    onExpandedChange: (next) => {
      const anchor = kb.activeId;
      if (anchor) emit(next, anchor);
    },
    selectionMode: "none",
    selectedIds: NO_SELECTION,
    onSelectionChange: noop,
  });

  const toggle = useCallback(
    (node: TreeLayoutNode<unknown>) => {
      if (!node.isExpandable) return;
      const next = new Set(expandedSet);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      emit(next, node.id);
    },
    [emit, expandedSet],
  );

  /** APG `*`: expand every sibling of the focused node. */
  const expandSiblings = useCallback(
    (node: TreeLayoutNode<unknown>) => {
      const parent = node.parentId ? resolved.byId.get(node.parentId) : null;
      const siblings = parent ? parent.children : [resolved.root];
      const next = new Set(expandedSet);
      for (const s of siblings) if (s.childCount > 0) next.add(s.id);
      if (next.size !== expandedSet.size) emit(next, node.id);
    },
    [emit, expandedSet, resolved],
  );

  const focusItem = useCallback(
    (id: string) => {
      kb.setActiveId(id);
      onActiveChange(id);
    },
    [kb, onActiveChange],
  );

  // Focus recovery: collapsing an ancestor (by pointer, or by a controlled
  // parent) removes the focused item. Put focus on the node that now stands
  // for it — the nearest visible ancestor — rather than dropping it on <body>.
  useLayoutEffect(() => {
    const last = lastFocusedRef.current;
    if (!last || nodeById.has(last)) return;
    lastFocusedRef.current = null;
    const current = typeof document === "undefined" ? null : document.activeElement;
    if (current && current !== document.body) return;
    if (activeId) focusItem(activeId);
  }, [activeId, focusItem, nodeById]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>("[data-node-id]");
    const node = item?.dataset.nodeId ? nodeById.get(item.dataset.nodeId) : undefined;
    if (node && !event.altKey && !event.ctrlKey && !event.metaKey) {
      switch (event.key) {
        case "Enter":
          event.preventDefault();
          if (canActivate) onActivate(node, event, "keyboard");
          else toggle(node);
          return;
        case " ":
          event.preventDefault();
          toggle(node);
          return;
        case "*":
          event.preventDefault();
          expandSiblings(node);
          return;
        case "Escape":
          onEscape?.();
          return;
        default:
          break;
      }
    }
    kb.onKeyDown(event);
  };

  return (
    <div
      aria-label={label}
      className="pointer-events-none absolute inset-0"
      data-slot="tree-chart-tree"
      onKeyDown={handleKeyDown}
      ref={treeRef}
      role="tree"
    >
      {layout.nodes.map((node) => {
        const { hit, toggle: zone } = node;
        const actionable = canActivate || node.isExpandable;
        const toggleName = node.isExpanded
          ? t("charts.treeChart.collapse", { name: node.name })
          : t("charts.treeChart.expand", { name: node.name, count: node.childCount });
        const zoneStyle = zone
          ? {
              left: zone.x - hit.x,
              top: zone.y - hit.y,
              width: zone.width,
              height: zone.height,
            }
          : undefined;
        return (
          <div
            aria-expanded={node.isExpandable ? node.isExpanded : undefined}
            aria-label={nameOf(node)}
            aria-level={node.depth + 1}
            aria-posinset={node.siblingIndex + 1}
            aria-setsize={node.siblingCount}
            className={cn(
              "pointer-events-auto absolute scroll-m-6 focus-ring",
              shape === "box" ? "rounded-xl" : "rounded-sm",
              actionable && "cursor-pointer",
            )}
            data-node-id={node.id}
            data-slot="tree-chart-item"
            data-target-id={node.id}
            key={node.id}
            onBlur={(event) => {
              const el = event.currentTarget;
              const next = event.relatedTarget as Node | null;
              if (!next || !treeRef.current?.contains(next)) onTreeBlur?.();
              // A blur caused by the item being REMOVED keeps `lastFocusedRef`
              // so focus recovery can run; a real blur clears it.
              setTimeout(() => {
                if (el.isConnected && lastFocusedRef.current === node.id) {
                  lastFocusedRef.current = null;
                }
              }, 0);
            }}
            onClick={(event) => {
              if (canActivate) {
                onActivate(node, event, event.detail === 0 ? "keyboard" : "pointer");
              } else if (node.isExpandable) {
                toggle(node);
              } else {
                return;
              }
              // Only a click that did something is kept from a surrounding
              // clickable card; a click on an inert leaf still reaches it.
              event.stopPropagation();
            }}
            onFocus={(event) => {
              if (event.target !== event.currentTarget) return;
              lastFocusedRef.current = node.id;
              kb.setActiveId(node.id);
              onActiveChange(node.id);
              onItemFocus?.(node);
            }}
            onMouseEnter={onItemPointer && ((event) => onItemPointer(node, event))}
            onMouseLeave={onItemLeave}
            onMouseMove={onItemPointer && ((event) => onItemPointer(node, event))}
            ref={(el) => kb.registerNodeRef(node.id, el)}
            role="treeitem"
            style={{ left: hit.x, top: hit.y, width: hit.width, height: hit.height }}
            tabIndex={node.id === activeId ? 0 : -1}
          >
            {zone &&
              (canActivate ? (
                // With a drill-in handler the body click activates, so the
                // toggle needs its own name for pointer + AT users (voice
                // control). It never takes focus: keyboard users toggle the
                // item itself with Space or the arrow keys. `z-10`: a
                // neighbour's wide label box never covers this node's toggle.
                <button
                  aria-label={toggleName}
                  className="absolute z-10 rounded-full focus-ring"
                  data-slot="tree-chart-toggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(node);
                    // A click made without a pointer (voice control, AT)
                    // moves focus the usual way.
                    if (event.detail === 0) {
                      focusItem(node.id);
                      return;
                    }
                    // A pointer click moves the tab stop here too, but
                    // without a keyboard focus ring: after the prevented
                    // mousedown, a plain script focus would count as
                    // keyboard focus and paint one.
                    const item = event.currentTarget.closest<HTMLElement>('[role="treeitem"]');
                    if (!item || item === document.activeElement) return;
                    item.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
                  }}
                  onFocus={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.preventDefault()}
                  style={zoneStyle}
                  tabIndex={-1}
                  type="button"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="absolute z-10"
                  data-slot="tree-chart-toggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(node);
                  }}
                  style={zoneStyle}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
