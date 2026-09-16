"use client";

/**
 * `qlik-object` (RM-085, #433) — a TILE KIND SKELETON documenting how a nebula.js visualisation
 * would mount inside the sheet's grid. No `@nebula.js/*` dependency anywhere in this file or its
 * README (`.claude/rules/dashboard.md`: `dashboard/` imports only `charts`/`ui`/`tokens`/
 * `icons`) — the render function itself is injected by the host through `DashboardProvider`'s
 * `host` prop (`dashboard-sheet/dashboard-provider.tsx`, `// host pass-through — RM-085`), never
 * called or imported from here.
 *
 * REFERENCE IMPLEMENTATION, not shipped API: nothing in `@elabs-ai/components-charts/dashboard`
 * imports this module — copy it into your own app and replace `QlikObjectHost.renderObject`'s
 * call site with your own `embed.render({ element, id, options })` (see `./README.md`).
 *
 * `DashboardTileProps.interactions` (`Required<ChartInteractions>` —
 * `{ passive, active, select, edit }`, `charts/chart-config-context.tsx`) was chosen precisely so
 * this mapping onto nebula.js's own `Interactions` shape is IDENTITY — no translation layer, no
 * per-key renaming, just `{ interactions }` handed straight through.
 */
import { useEffect, useRef } from "react";
import { StatePanel } from "@elabs-ai/components-ui";

import type { DashboardTileKind, DashboardTileProps } from "../../dashboard-sheet/tile-registry";
import type { DashboardContextValueWithHost } from "../../dashboard-sheet/dashboard-provider";
import { useDashboardContext } from "../../dashboard-sheet/use-dashboard";

/** Content of a `qlik-object` tile: the id of the object a nebula.js `embed` would render. */
export interface QlikObjectTileContent {
  objectId: string;
}

/** What a host's `renderObject` receives — identical in shape to nebula.js's own `Interactions`. */
export interface QlikObjectRenderOptions {
  interactions: { passive?: boolean; active?: boolean; select?: boolean; edit?: boolean };
}

/**
 * The `host` shape this tile kind reads off `DashboardProvider`'s optional `host` prop. A real
 * host's `renderObject` would call `embed.render({ element, id: objectId, options })` (see
 * `./README.md`) and return nebula's own teardown function.
 */
export interface QlikObjectHost {
  renderObject?: (
    element: HTMLElement,
    objectId: string,
    options: QlikObjectRenderOptions,
  ) => (() => void) | void;
}

/** Strings `qlik-object` renders. Pass your own to `createQlikObjectTileKind` to localise. */
export interface QlikObjectTileLabels {
  missingHostTitle: string;
  missingHostDescription: string;
}

/** The labels `qlik-object` uses when a host passes none. */
export const DEFAULT_QLIK_OBJECT_TILE_LABELS: QlikObjectTileLabels = {
  missingHostTitle: "Host renderer missing",
  missingHostDescription:
    "Pass a renderObject function through DashboardProvider’s host prop to mount this object.",
};

function createQlikObjectTileComponent(labels: QlikObjectTileLabels) {
  return function QlikObjectTile({
    tile,
    interactions,
  }: DashboardTileProps<QlikObjectTileContent>) {
    const elementRef = useRef<HTMLDivElement>(null);
    // `DashboardContextValue` (`use-dashboard.ts`) does not yet declare `host` — the widened
    // cast documents the gap; see `dashboard-provider.tsx`'s `DashboardContextValueWithHost`.
    const host = (useDashboardContext() as DashboardContextValueWithHost).host as
      | QlikObjectHost
      | undefined;
    const objectId = tile.content?.objectId ?? "";

    useEffect(() => {
      const element = elementRef.current;
      if (!element || !host?.renderObject) return;
      const cleanup = host.renderObject(element, objectId, { interactions });
      return () => {
        cleanup?.();
      };
      // `interactions` is a fresh object identity every render (`Required<ChartInteractions>`
      // computed by `dashboard-tile.tsx`) but its VALUES only change with mode/capabilities, so
      // this effect still re-mounts on every render rather than diffing — acceptable for a
      // skeleton; a real adapter would memoise `interactions` before this dependency array.
    }, [host, objectId, interactions]);

    if (!host?.renderObject) {
      return (
        <StatePanel
          kind="empty"
          size="sm"
          titleAs="h4"
          title={labels.missingHostTitle}
          description={labels.missingHostDescription}
          className="size-full"
        />
      );
    }

    return (
      <div
        ref={elementRef}
        data-slot="qlik-object-tile"
        data-tile-kind={tile.kind}
        data-tile-id={tile.id}
        className="size-full"
      />
    );
  };
}

/** Build a `qlik-object` tile kind. `kind` lets a host register several presets; `labels` localises. */
export function createQlikObjectTileKind(
  kind = "qlik-object",
  labels: QlikObjectTileLabels = DEFAULT_QLIK_OBJECT_TILE_LABELS,
): DashboardTileKind<QlikObjectTileContent> {
  return {
    kind,
    label: "Qlik object", // i18n-exempt: asset-panel label of a tile kind, mirrors placeholderTileKind
    component: createQlikObjectTileComponent(labels),
    defaultSize: { w: 8, h: 4 },
    minSize: { w: 3, h: 2 },
    capabilities: { resizable: true },
    configForm: {
      formName: `${kind}-tile`,
      fields: [{ type: "string", name: "objectId", label: "Object ID", required: true }], // i18n-exempt: config-form label
    },
    defaultContent: { objectId: "" },
  };
}

/** `createQlikObjectTileKind()` — the `qlik-object` kind. */
export const qlikObjectTileKind = createQlikObjectTileKind();
