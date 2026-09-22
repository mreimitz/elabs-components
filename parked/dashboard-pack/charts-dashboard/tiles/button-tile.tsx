"use client";

import { MousePointerClick } from "lucide-react";
import { Button } from "@elabs-ai/components-ui";

import type { VariableValue } from "../core/spec";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";
import { useDashboardActions } from "../dashboard-sheet/use-dashboard";

/** One action a `button` tile can fire. */
export type ButtonTileAction =
  | { type: "navigate"; sheetId: string }
  | { type: "applyBookmark"; id: string }
  | { type: "clearSelections" }
  | { type: "setVariable"; name: string; value: VariableValue }
  | { type: "host"; id: string };

/** Content of a `button` tile. */
export interface ButtonTileContent {
  label: string;
  action: ButtonTileAction;
}

function ButtonTile({ tile, emit, interactions }: DashboardTileProps<ButtonTileContent>) {
  const actions = useDashboardActions();
  const { label, action } = tile.content;
  const disabled = !interactions.select;

  const handleClick = () => {
    switch (action.type) {
      case "navigate":
        emit.navigate(action.sheetId);
        return;
      case "applyBookmark":
        emit.openBookmark(action.id);
        return;
      case "clearSelections":
        actions.clearSelection();
        return;
      case "setVariable":
        emit.setVariable(action.name, action.value);
        return;
      case "host":
        emit.action(action.id);
        return;
      default:
        return;
    }
  };

  return (
    <div data-slot="button-tile" className="flex size-full min-h-0 items-center justify-center">
      <Button onClick={handleClick} disabled={disabled}>
        {label}
      </Button>
    </div>
  );
}

/**
 * `button` — fires a sheet-level action (navigate, apply a bookmark, clear selections,
 * set a variable, or a host-defined `host` action via `emit.action`/`DashboardProvider`'s
 * `onAction`).
 */
export function createButtonTileKind(kind = "button"): DashboardTileKind<ButtonTileContent> {
  return {
    kind,
    label: "Button", // i18n-exempt: asset-panel label
    icon: MousePointerClick,
    description: "Navigate, apply a bookmark or clear selections.", // i18n-exempt: asset-panel description
    component: ButtonTile,
    defaultSize: { w: 3, h: 1 },
    minSize: { w: 2, h: 1 },
    capabilities: { expand: false },
    configForm: {
      formName: `${kind}-tile`,
      fields: [
        { type: "string", name: "label", label: "Label", required: true },
        {
          type: "enum",
          name: "actionType",
          label: "Action",
          options: ["navigate", "applyBookmark", "clearSelections", "setVariable", "host"],
          default: "clearSelections",
        },
        {
          type: "string",
          name: "sheetId",
          label: "Sheet id",
          visibleWhen: { field: "actionType", equals: "navigate" },
        },
        {
          type: "string",
          name: "bookmarkId",
          label: "Bookmark id",
          visibleWhen: { field: "actionType", equals: "applyBookmark" },
        },
        {
          type: "string",
          name: "variableName",
          label: "Variable name",
          visibleWhen: { field: "actionType", equals: "setVariable" },
        },
        {
          type: "string",
          name: "variableValue",
          label: "Variable value",
          visibleWhen: { field: "actionType", equals: "setVariable" },
        },
        {
          type: "string",
          name: "hostActionId",
          label: "Host action id",
          visibleWhen: { field: "actionType", equals: "host" },
        },
      ],
    },
    defaultContent: { label: "Button", action: { type: "clearSelections" } },
  };
}

/** `createButtonTileKind()` — the `button` kind. */
export const buttonTileKind = createButtonTileKind();
