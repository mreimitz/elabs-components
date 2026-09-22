"use client";

import { LayoutPanelTop } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger, useLocale } from "@elabs-ai/components-ui";

import { EMPTY_SELECTION } from "../core/selection";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";
import {
  useDashboard,
  useDashboardActions,
  useDashboardContext,
} from "../dashboard-sheet/use-dashboard";

/** One tab of a `container` tile: a label and the tile ids it holds. */
export interface ContainerTabSpec {
  id: string;
  label: string;
  /** Ids of `TileSpec`s elsewhere in `spec.tiles` this tab renders when active. */
  children: string[];
}

/** Content of a `container` tile: a tabbed group of other tiles. */
export interface ContainerTileContent {
  kind: "tabs";
  tabs: ContainerTabSpec[];
}

/**
 * One child tile inside the active tab, rendered through the SAME registry a top-level
 * tile uses — kept intentionally small (no header/menu chrome, an approximate size) since
 * the tile contract has no nested-layout information for a container's children (see the
 * kind's docblock below).
 */
function ContainerChild({
  tileId,
  mode,
  density,
  variables,
  emit,
  width,
  height,
}: {
  tileId: string;
  mode: DashboardTileProps["mode"];
  density: DashboardTileProps["density"];
  variables: DashboardTileProps["variables"];
  emit: DashboardTileProps["emit"];
  width: number;
  height: number;
}) {
  const { registry } = useDashboardContext();
  const childTile = useDashboard((s) => s.spec.tiles.find((t) => t.id === tileId));
  const childKind = childTile ? registry.get(childTile.kind) : undefined;
  const selection = useDashboard((s) =>
    childKind?.capabilities.consumesSelection ? s.selection : EMPTY_SELECTION,
  );
  const hover = useDashboard((s) => (childKind?.capabilities.consumesHover ? s.hover : null));

  if (!childTile || !childKind) return null;
  const Component = childKind.component;
  return (
    <div data-slot="container-tile-child" className="min-h-0 min-w-0 flex-1">
      <Component
        tile={childTile}
        size={{ w: childTile.layout.w, h: childTile.layout.h, width, height }}
        mode={mode}
        interactions={{
          passive: true,
          active: true,
          select: mode === "view",
          edit: mode === "edit",
        }}
        selection={selection}
        hover={hover}
        variables={variables}
        emit={emit}
        density={density}
        frame={{
          chrome: "bare",
          density,
          interactions: {
            passive: true,
            active: true,
            select: mode === "view",
            edit: mode === "edit",
          },
          onExpandChange: () => {},
        }}
      />
    </div>
  );
}

function ContainerTile({
  tile,
  mode,
  density,
  variables,
  emit,
  size,
}: DashboardTileProps<ContainerTileContent>) {
  const actions = useDashboardActions();
  const { t } = useLocale();
  const activeTab = useDashboard((s) => s.tileState[tile.id]?.activeTab as string | undefined);
  const tabs = tile.content.tabs;
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <Tabs
      value={active?.id}
      onValueChange={(next) => actions.setTileState(tile.id, { activeTab: next })}
      className="flex size-full min-h-0 flex-col"
    >
      <TabsList aria-label={tile.title ?? t("charts.dashboard.containerTabs")}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="flex min-h-0 flex-1 flex-col gap-2">
          {tab.children.map((childId) => (
            <ContainerChild
              key={childId}
              tileId={childId}
              mode={mode}
              density={density}
              variables={variables}
              emit={emit}
              width={size.width}
              height={Math.max(80, Math.floor(size.height / Math.max(tab.children.length, 1)))}
            />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * `container` — a tabbed group of other tiles (`ui/Tabs`); the active tab lives in the
 * sheet's `tileState` (never in history).
 *
 * KNOWN GAP (RM-075 result file): each `tabs[].children` id must independently exist as a
 * `TileSpec` in `spec.tiles`; `DashboardTileProps` carries no per-child layout, so a
 * child's `width`/`height` here is an even split of the container's own box, not a real
 * nested grid — RM-074's sheet-level `ContainerSpec`/`DashboardSheetContainer` already
 * owns real nested-grid layout and is the better fit once the properties panel (RM-080)
 * needs one; this tile kind is the content-model shape the brief asked for.
 */
export function createContainerTileKind(
  kind = "container",
): DashboardTileKind<ContainerTileContent> {
  return {
    kind,
    label: "Container", // i18n-exempt: asset-panel label
    icon: LayoutPanelTop,
    description: "Tabs that hold other tiles.", // i18n-exempt: asset-panel description
    component: ContainerTile,
    defaultSize: { w: 12, h: 6 },
    minSize: { w: 4, h: 3 },
    capabilities: { expand: false },
    configForm: { formName: `${kind}-tile`, fields: [] },
    defaultContent: { kind: "tabs", tabs: [] },
  };
}

/** `createContainerTileKind()` — the `container` kind. */
export const containerTileKind = createContainerTileKind();
