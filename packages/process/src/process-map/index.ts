/**
 * The process map (RM-051) — public surface.
 *
 * Only what a consumer composes with: the three components, the hover context two of them
 * read, the layout hook, and the whole `map-model` vocabulary (the model is what keeps the
 * canvas and the `tableView` twin printing identical numbers, so it is public on purpose).
 */
export * from "./map-model";
export * from "./process-map";
export * from "./process-map-context";
export * from "./process-activity-node";
export * from "./process-transition-edge";
export * from "./use-process-layout";
