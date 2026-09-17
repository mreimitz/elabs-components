/**
 * `process-map` dashboard tile (copy-owned block) — a `DashboardTileKind` wrapping
 * `@elabs-ai/components-process`'s `ProcessMap`. `dashboard/` itself may only import
 * `charts`/`ui`/`tokens`/`icons` (.claude/rules/dashboard.md), so a `process` tile is
 * host-registered through the tile-kind registry (D4) — this block IS that
 * registration.
 *
 * `ProcessMap`'s own `ProcessSelectionState` is the exact same tri-state union as the
 * dashboard's `SelectionState` ("selected" | "associated" | "excluded") — `map-model.ts`
 * and `core/selection.ts` ship the identical literal type, so this tile reads the live
 * dashboard selection for `tile.content.field` and hands it straight to `ProcessMap`'s
 * `selectionStates.activities` with no translation. A node click resolves to the
 * activity's NAME (`ProcessSelection.id` for `kind: "activity"`) and emits it as this
 * tile's selection intent.
 *
 * Depends on installed @elabs-ai/components-process + @elabs-ai/components-charts (its
 * /dashboard subpath) + @elabs-ai/components-ui.
 */
"use client";

import { useMemo } from "react";
import { ProcessMap, type ProcessMetricSpec } from "@elabs-ai/components-process";
import type { EventLog } from "@elabs-ai/components-process/core";
import type { DashboardTileKind, DashboardTileProps } from "@elabs-ai/components-charts/dashboard";

/** Content of a `process-map` tile. */
export interface DashboardTileProcessMapContent {
  /** The selection field activity names bind to. Default `"activity"`. */
  field?: string;
  log: EventLog;
  metric: ProcessMetricSpec;
}

const DEFAULT_METRIC: ProcessMetricSpec = { node: "absolute", edge: "absolute" };

function ProcessMapTile({
  tile,
  selection,
  interactions,
  emit,
}: DashboardTileProps<DashboardTileProcessMapContent>) {
  const content = tile.content;
  const field = content?.field ?? "activity";
  const log = content?.log ?? { events: [] };
  const metric = content?.metric ?? DEFAULT_METRIC;

  const activities = useMemo(() => {
    const names = new Set<string>();
    for (const event of log.events) names.add(event.activity);
    return [...names];
  }, [log]);

  const selectionStates = useMemo(() => {
    const activityStates: Record<string, "selected" | "associated" | "excluded"> = {};
    for (const name of activities) activityStates[name] = selection.states(field, name);
    return { activities: activityStates };
  }, [activities, selection, field]);

  return (
    <div
      data-slot="dashboard-tile-process-map"
      data-tile-kind={tile.kind}
      className="size-full min-h-0"
    >
      <ProcessMap
        log={log}
        metric={metric}
        selectionStates={selectionStates}
        onSelect={
          interactions.select === false
            ? undefined
            : (target) => {
                if (!target || target.kind !== "activity") return;
                emit.select(field, [target.id], { toggle: true });
              }
        }
        className="size-full"
      />
    </div>
  );
}

/** Build a `process-map` tile kind. `kind` lets a host register several presets. */
export function createProcessMapTileKind(
  kind = "process-map",
): DashboardTileKind<DashboardTileProcessMapContent> {
  return {
    kind,
    label: "Process map",
    component: ProcessMapTile,
    defaultSize: { w: 12, h: 10 },
    minSize: { w: 6, h: 5 },
    capabilities: { emitsSelection: true, consumesSelection: true, expand: true },
    configForm: { formName: `${kind}-tile`, fields: [] },
    defaultContent: { log: { events: [] }, metric: DEFAULT_METRIC },
  };
}

/** `createProcessMapTileKind()` — the default `process-map` kind. */
export const processMapTileKind = createProcessMapTileKind();
