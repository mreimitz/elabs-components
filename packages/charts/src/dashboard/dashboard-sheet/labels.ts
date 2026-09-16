/**
 * Default English strings for the sheet chrome. Every visible string and accessible name
 * the sheet renders comes from this object, so a host localises by passing `labels` to
 * `DashboardProvider` (the charts locale seam lives in `ui`; these keys are sheet-local).
 */
export interface DashboardLabels {
  /** Accessible name of a sheet with no title. */
  sheet: string;
  /** Accessible name of a tile with no title. */
  untitledTile: (kind: string) => string;
  /** Title of the fallback shown for a tile kind nobody registered. */
  unknownKind: (kind: string) => string;
  /** Description of that fallback. */
  unknownKindDescription: string;
  /** The hover toolbar's expand button and the menu item that opens the dialog. */
  fullScreen: string;
  /** The kebab menu trigger. */
  moreActions: string;
  /** Menu item opening the description/footnote/source popover. */
  showDetails: string;
  /** Menu item flipping a frame tile to its data table. */
  viewData: string;
  /** Menu item flipping a frame tile back to its chart. */
  viewChart: string;
  /** Menu item and toolbar button downloading a frame tile's data. */
  download: string;
  /** Heading inside the details popover for the footnote. */
  footnote: string;
  /** Heading inside the details popover for the source. */
  source: string;
}

/** The labels a sheet uses when the host passes none. */
export const DEFAULT_DASHBOARD_LABELS: DashboardLabels = {
  sheet: "Dashboard",
  untitledTile: (kind) => `Untitled ${kind} tile`,
  unknownKind: (kind) => `No renderer for “${kind}”`,
  unknownKindDescription: "This tile kind is not registered on the dashboard.",
  fullScreen: "Full screen",
  moreActions: "More actions",
  showDetails: "Show details",
  viewData: "View data",
  viewChart: "View chart",
  download: "Download",
  footnote: "Footnote",
  source: "Source",
};
