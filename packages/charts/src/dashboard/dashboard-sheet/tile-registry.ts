/**
 * The tile contract (analysis §4 R21–R22): what a tile kind declares and what the sheet
 * hands its component. Every built-in and host-registered tile implements it.
 */
import type { ComponentType, ReactNode } from "react";
import type { FormSpec } from "@elabs-ai/components-ui";

import type { ChartFrameMenuApi } from "../../chart-frame/chart-frame";
import type { ChartDensity, ChartInteractions } from "../../charts/chart-config-context";
import type { SelectionOptions, SelectionSnapshot, SelectionValue } from "../core/selection";
import type { DashboardSpecError, TileSpec, VariableValue } from "../core/spec";
import type { DashboardHover, DashboardMode } from "../core/store";

/** What a tile kind can do. Absent flags are `false`, except `expand` (default `true`). */
export interface DashboardTileCapabilities {
  emitsSelection?: boolean;
  consumesSelection?: boolean;
  consumesHover?: boolean;
  emitsHover?: boolean;
  resizable?: boolean;
  exportable?: boolean;
  /** Offer Full screen in the hover toolbar and menu. Default `true`. */
  expand?: boolean;
  /**
   * How much the tile frame pads the body: `default` (the card's padding), `compact` (a
   * one-row banner such as a heading) or `none` (a divider, an image that bleeds to the edge).
   */
  padding?: "default" | "compact" | "none";
  /**
   * `card` (default) frames the tile as a raised card; `plain` draws no frame at all (a
   * heading, a divider, a text note sitting directly on the sheet) — edit mode still outlines
   * it with a dashed hairline so an author can find and grab it.
   */
  surface?: "card" | "plain";
  /**
   * The kind renders its own `ChartFrame` and spreads `props.frame` onto it, so the tile
   * header lands in the frame's `headerSlot` (exactly one header) and "View data" /
   * "Download" come from the frame's features. Default `false`: the sheet wraps the body in
   * a `ChartFrame chrome="tile"` itself.
   */
  frame?: boolean;
}

/** A size in grid cells. */
export interface DashboardCellSize {
  w: number;
  h: number;
}

/** Props a frame kind spreads onto its `ChartFrame` (see `DashboardTileCapabilities.frame`). */
export interface DashboardTileFrameProps {
  chrome: "tile" | "bare";
  title?: string;
  source?: string;
  headerSlot?: ReactNode;
  menuSlot?: (api: ChartFrameMenuApi) => ReactNode;
  density: ChartDensity;
  interactions: Required<ChartInteractions>;
  onExpandChange: (open: boolean) => void;
}

/** What the sheet passes to a tile kind's component (R22). */
export interface DashboardTileProps<TContent = unknown> {
  tile: TileSpec<TContent>;
  /** Cells and pixels. */
  size: { w: number; h: number; width: number; height: number };
  mode: DashboardMode;
  interactions: Required<ChartInteractions>;
  /** The live selection when the kind `consumesSelection`; otherwise a frozen empty snapshot. */
  selection: SelectionSnapshot;
  /** The live hover when the kind `consumesHover`; otherwise `null`. */
  hover: DashboardHover | null;
  variables: Readonly<Record<string, VariableValue>>;
  emit: {
    select(field: string, values: SelectionValue[], opts?: SelectionOptions): void;
    hover(hover: Omit<DashboardHover, "tileId"> | null): void;
    setVariable(name: string, value: VariableValue): void;
    navigate(sheetId: string): void;
    openBookmark(id: string): void;
    /** Ask the host to refresh this tile's data (D5: the host fetches). */
    refresh(): void;
    /**
     * Fire a `button` tile's `{ type: "host" }` action (or any kind's own host-defined
     * action) — the host decides what `id` means (D5). No-op with no `onAction` on
     * `DashboardProvider`.
     */
    action(id: string): void;
  };
  density: ChartDensity;
  /** Spread onto `ChartFrame` when the kind declares `capabilities.frame`. */
  frame: DashboardTileFrameProps;
}

/** One registered tile kind (R21). */
export interface DashboardTileKind<TContent = unknown> {
  /** Matches `TileSpec.kind`. */
  kind: string;
  /** Name the asset panel shows. */
  label: string;
  /** One line under the name in the asset panel: what a reader gets from this kind. */
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  component: ComponentType<DashboardTileProps<TContent>>;
  defaultSize: DashboardCellSize;
  minSize: DashboardCellSize;
  maxSize?: DashboardCellSize;
  /** Width ÷ height in cells a resize keeps. */
  aspect?: number;
  capabilities: DashboardTileCapabilities;
  /** The properties-panel form for `content`. */
  configForm: FormSpec;
  defaultContent: TContent;
  /** Upgrade `content` written by an older version of this kind. */
  migrate?: (content: unknown, fromVersion: number) => TContent;
  /**
   * Validate `content` beyond what the config form's own field rules cover (a rule that
   * spans fields, or one the form vocabulary can't express, e.g. `image`'s required
   * `alt`). Returns `null` when `content` is valid. Not yet called by the sheet or the
   * validator in `core/validate.ts` — no run-every-kind entry point exists today, so a
   * kind that declares this exposes it for its own tests/host to call directly.
   */
  validateContent?: (content: TContent) => DashboardSpecError | null;
}

/** Tile kinds keyed by `kind`. */
export interface TileRegistry {
  get(kind: string): DashboardTileKind | undefined;
  has(kind: string): boolean;
  /** Every kind, in registration order. */
  readonly kinds: readonly DashboardTileKind[];
}

/** Kinds as a list or a `kind → definition` map. */
export type DashboardTileKinds =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a registry holds kinds of differing content types
  readonly DashboardTileKind<any>[] | Readonly<Record<string, DashboardTileKind<any>>>;

/** Build a registry. A later kind with the same `kind` replaces an earlier one. */
export function createTileRegistry(kinds: DashboardTileKinds): TileRegistry {
  const list = (Array.isArray(kinds) ? kinds : Object.values(kinds)) as DashboardTileKind[];
  const byKind = new Map<string, DashboardTileKind>();
  for (const kind of list) byKind.set(kind.kind, kind);
  const all = [...byKind.values()];
  return {
    get: (kind) => byKind.get(kind),
    has: (kind) => byKind.has(kind),
    kinds: all,
  };
}
