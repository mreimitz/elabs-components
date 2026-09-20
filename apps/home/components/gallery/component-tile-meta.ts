/**
 * The component tiles' metadata — a plain module a server component can read (see
 * `chart-tile-meta.ts` for why). Order is wall reading order: the first tiles land in the first
 * viewport. Renders live in `component-tiles.tsx`, keyed by the same ids.
 */
export type ComponentCategoryId = "forms" | "data" | "navigation" | "feedback" | "ai" | "blocks";

export const COMPONENT_TILE_IDS = [
  "kpi-arr",
  "chat",
  "invite",
  "kpi-trend",
  "table",
  "command",
  "kpi-churn",
  "controls",
  "pipeline",
  "team",
  "calendar",
  "kpi-status",
  "notifications",
  "verify",
  "order",
  "nav",
  "faq",
  "empty",
  "kpi-movers",
] as const;
export type ComponentTileId = (typeof COMPONENT_TILE_IDS)[number];

export interface ComponentTileMeta {
  id: ComponentTileId;
  category: ComponentCategoryId;
  /** Components this tile is made of — each resolves to a Storybook docs page. */
  components: string[];
  /** Shown in the home page's wall; every tile shows on `/components`. */
  wall?: boolean;
}

export const COMPONENT_TILE_META: ComponentTileMeta[] = [
  { id: "kpi-arr", category: "data", components: ["MetricCard", "Sparkline"], wall: true },
  { id: "chat", category: "ai", components: ["Conversation", "Message", "Tool"], wall: true },
  {
    id: "invite",
    category: "forms",
    components: ["Input", "Select", "TagInput", "Checkbox", "Button"],
    wall: true,
  },
  { id: "kpi-trend", category: "blocks", components: ["ChartCard"], wall: true },
  { id: "table", category: "data", components: ["DataTable", "Badge"], wall: true },
  { id: "command", category: "navigation", components: ["Command"], wall: true },
  { id: "kpi-churn", category: "data", components: ["MetricCard", "Sparkline"], wall: true },
  {
    id: "controls",
    category: "forms",
    components: ["Slider", "SegmentedField", "Switch", "Rating"],
    wall: true,
  },
  {
    id: "pipeline",
    category: "feedback",
    components: ["StatusBadge", "Progress", "Alert"],
    wall: true,
  },
  { id: "team", category: "data", components: ["Avatar", "Badge", "DropdownMenu"], wall: true },
  { id: "calendar", category: "forms", components: ["Calendar"], wall: true },
  { id: "kpi-status", category: "blocks", components: ["MetricCard"], wall: true },
  { id: "notifications", category: "forms", components: ["Switch", "Label"] },
  { id: "verify", category: "forms", components: ["InputOTP"] },
  { id: "order", category: "data", components: ["Descriptions", "Badge"] },
  { id: "nav", category: "navigation", components: ["Breadcrumb", "Tabs"] },
  { id: "faq", category: "navigation", components: ["Accordion"] },
  { id: "empty", category: "feedback", components: ["EmptyState"] },
  { id: "kpi-movers", category: "blocks", components: ["MetricCard"] },
];

export const WALL_TILE_META = COMPONENT_TILE_META.filter((tile) => tile.wall);
export const COMPONENT_CATEGORY_IDS = Array.from(
  new Set(COMPONENT_TILE_META.map((tile) => tile.category)),
);
export const COMPONENT_TILE_COMPONENTS = Array.from(
  new Set(COMPONENT_TILE_META.flatMap((tile) => tile.components)),
);
