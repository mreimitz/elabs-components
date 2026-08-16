"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TreeNode } from "./tree";

/**
 * Flattens the visible (expanded) tree into an ordered list of node ids.
 * Nodes whose ancestors are collapsed are excluded.
 */
export function flattenVisible<T>(nodes: TreeNode<T>[], expandedIds: Set<string>): string[] {
  const result: string[] = [];
  function walk(list: TreeNode<T>[]) {
    for (const node of list) {
      result.push(node.id);
      if ((node.children?.length || node.hasChildren) && expandedIds.has(node.id)) {
        if (node.children?.length) walk(node.children);
      }
    }
  }
  walk(nodes);
  return result;
}

/**
 * Builds a lookup map: node id → parent id (or null for roots).
 */
function buildParentMap<T>(
  nodes: TreeNode<T>[],
  parentId: string | null = null,
  map: Map<string, string | null> = new Map(),
): Map<string, string | null> {
  for (const node of nodes) {
    map.set(node.id, parentId);
    if (node.children?.length) {
      buildParentMap(node.children, node.id, map);
    }
  }
  return map;
}

/**
 * Finds a node by id in the tree (depth-first).
 */
export function findNode<T>(nodes: TreeNode<T>[], id: string): TreeNode<T> | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export interface UseTreeKeyboardOptions<T> {
  nodes: TreeNode<T>[];
  expandedIds: Set<string>;
  onExpandedChange: (ids: Set<string>) => void;
  selectionMode: "single" | "multiple" | "none";
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  /**
   * When `true`, the tree uses windowed rendering. Focus navigation must
   * scroll the virtualizer before focusing an unmounted row.
   */
  virtualize?: boolean;
  /**
   * Ordered list of visible node ids in the virtual flat list. Provided by
   * the Tree when `virtualize` is true so the keyboard hook can map an id to
   * a virtual index without re-flattening.
   */
  flatNodeIds?: string[];
  /**
   * Ref that the keyboard hook writes a node id into when it needs to focus a
   * row that is currently scrolled out of view. The Tree's `registerAndFlush`
   * callback reads this ref on every ref registration and focuses the element
   * once it mounts.
   */
  pendingFocusIdRef?: React.MutableRefObject<string | null>;
  /**
   * Called when the keyboard hook wants to bring an index into view before
   * focusing it. Only called in virtual mode.
   */
  scrollToVirtualIndex?: (index: number) => void;
}

export interface UseTreeKeyboardResult {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  /** ref callback — register each tree item element keyed by node id */
  registerNodeRef: (id: string, el: HTMLElement | null) => void;
  /** onKeyDown handler to attach to the root tree div */
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

export function useTreeKeyboard<T>(options: UseTreeKeyboardOptions<T>): UseTreeKeyboardResult {
  const {
    nodes,
    expandedIds,
    onExpandedChange,
    selectionMode,
    selectedIds,
    onSelectionChange,
    virtualize = false,
    flatNodeIds,
    pendingFocusIdRef,
    scrollToVirtualIndex,
  } = options;

  // The currently "roving" active item id
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    // default to first visible node
    const visible = flattenVisible(nodes, expandedIds);
    return visible[0] ?? null;
  });

  // Map from node id → DOM element reference
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerNodeRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      nodeRefs.current.set(id, el);
    } else {
      nodeRefs.current.delete(id);
    }
  }, []);

  // Typeahead buffer
  const typeaheadBuffer = useRef<string>("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending typeahead timer on unmount.
  useEffect(
    () => () => {
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    },
    [],
  );

  /**
   * Focus the element for `id`. In virtual mode, if the element isn't
   * mounted yet, record it as pending and scroll the virtualizer so the row
   * enters the render window; the Tree's `registerAndFlush` will focus it
   * once the ref fires.
   */
  const setActiveId = useCallback(
    (id: string | null) => {
      setActiveIdState(id);
      if (!id) return;

      const el = nodeRefs.current.get(id);
      if (el) {
        el.focus();
        return;
      }

      // Element not mounted — happens when it's scrolled out of the virtual window.
      if (virtualize && scrollToVirtualIndex && pendingFocusIdRef) {
        const ids = flatNodeIds ?? [];
        const index = ids.indexOf(id);
        if (index >= 0) {
          pendingFocusIdRef.current = id;
          scrollToVirtualIndex(index);
          // The Tree's registerAndFlush will call el.focus() once the row mounts.
        }
      }
    },
    [virtualize, flatNodeIds, pendingFocusIdRef, scrollToVirtualIndex],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!activeId) return;

      // In virtual mode use the pre-computed flat list so we don't re-flatten
      const visible = virtualize && flatNodeIds ? flatNodeIds : flattenVisible(nodes, expandedIds);
      const currentIndex = visible.indexOf(activeId);
      const currentNode = findNode(nodes, activeId);
      const parentMap = buildParentMap(nodes);

      const moveTo = (id: string) => {
        e.preventDefault();
        setActiveId(id);
      };

      const selectNode = (id: string) => {
        if (selectionMode === "none") return;
        const node = findNode(nodes, id);
        if (node?.disabled) return;
        if (selectionMode === "single") {
          onSelectionChange(new Set([id]));
        } else {
          const next = new Set(selectedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          onSelectionChange(next);
        }
      };

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = visible[currentIndex + 1];
          if (next) moveTo(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = visible[currentIndex - 1];
          if (prev) moveTo(prev);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (!currentNode) break;
          const expandable = !!(currentNode.children?.length || currentNode.hasChildren);
          if (expandable && !expandedIds.has(activeId)) {
            // expand
            const next = new Set(expandedIds);
            next.add(activeId);
            onExpandedChange(next);
          } else if (expandable && expandedIds.has(activeId)) {
            // move to first child (only if loaded)
            const firstChild = currentNode.children?.[0];
            if (firstChild) moveTo(firstChild.id);
          }
          // leaf: do nothing
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (!currentNode) break;
          const expandable = !!(currentNode.children?.length || currentNode.hasChildren);
          if (expandable && expandedIds.has(activeId)) {
            // collapse
            const next = new Set(expandedIds);
            next.delete(activeId);
            onExpandedChange(next);
          } else {
            // move to parent
            const parentId = parentMap.get(activeId) ?? null;
            if (parentId) moveTo(parentId);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          const first = visible[0];
          if (first) moveTo(first);
          break;
        }
        case "End": {
          e.preventDefault();
          const last = visible[visible.length - 1];
          if (last) moveTo(last);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          selectNode(activeId);
          break;
        }
        default: {
          // typeahead — single printable characters
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const char = e.key.toLowerCase();
            typeaheadBuffer.current += char;

            if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
            typeaheadTimer.current = setTimeout(() => {
              typeaheadBuffer.current = "";
            }, 500);

            const prefix = typeaheadBuffer.current;
            // find the next visible node (after current) whose label starts with prefix
            const searchList = [
              ...visible.slice(currentIndex + 1),
              ...visible.slice(0, currentIndex + 1),
            ];
            for (const id of searchList) {
              const node = findNode(nodes, id);
              if (!node) continue;
              // only string labels are searchable
              if (typeof node.label !== "string") continue;
              if (node.label.toLowerCase().startsWith(prefix)) {
                moveTo(id);
                break;
              }
            }
          }
          break;
        }
      }
    },
    [
      activeId,
      nodes,
      expandedIds,
      onExpandedChange,
      selectionMode,
      selectedIds,
      onSelectionChange,
      setActiveId,
      virtualize,
      flatNodeIds,
    ],
  );

  return { activeId, setActiveId, registerNodeRef, onKeyDown };
}
