"use client";

import { useCallback, useMemo, useState } from "react";

export interface UsePlanSelectionOptions {
  /** Allow more than one region to be selected at a time (default false). */
  multiple?: boolean;
  /** The ids selected to begin with. */
  initialSelectedIds?: readonly string[];
  /** Called whenever the selection changes. */
  onChange?: (selectedIds: string[]) => void;
}

export interface PlanSelection {
  /** The single selected id, or the last of a multiple selection; `null` for none. */
  selectedId: string | null;
  /** Every selected id, in selection order. */
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  /** Toggle a region; `null` clears everything. */
  select: (id: string | null) => void;
  clear: () => void;
}

/**
 * Selection state for a plan, keyed by region **id** rather than index — a
 * status tick that re-orders the regions must not move the selection with it.
 *
 * Hand `selectedIds` to `<MapGeoJSON selectedId>` for the paint and to
 * `<MapPlanOverlay selectedId>` for the pressed state, so both read one source.
 */
export function usePlanSelection({
  multiple = false,
  initialSelectedIds,
  onChange,
}: UsePlanSelectionOptions = {}): PlanSelection {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => [...(initialSelectedIds ?? [])]);

  const commit = useCallback(
    (next: string[]) => {
      setSelectedIds(next);
      onChange?.(next);
    },
    [onChange],
  );

  const select = useCallback(
    (id: string | null) => {
      if (id === null) {
        commit([]);
        return;
      }
      setSelectedIds((current) => {
        const next = current.includes(id)
          ? current.filter((entry) => entry !== id)
          : multiple
            ? [...current, id]
            : [id];
        onChange?.(next);
        return next;
      });
    },
    [commit, multiple, onChange],
  );

  const clear = useCallback(() => commit([]), [commit]);

  return useMemo(
    () => ({
      selectedId: selectedIds.at(-1) ?? null,
      selectedIds,
      isSelected: (id: string) => selectedIds.includes(id),
      select,
      clear,
    }),
    [selectedIds, select, clear],
  );
}
