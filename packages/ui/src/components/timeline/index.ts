// NOTE: `TimelineStatus` (the editor's 3-state vocabulary) is deliberately NOT
// re-exported here — it already reaches the @elabs/components-ui barrel via
// ./components/status-badge; exporting it twice would make the star-exports
// ambiguous.
export {
  Timeline,
  TimelineItem,
  TimelineRoot,
  type TimelineEntry,
  type TimelineItemProps,
  type TimelineProps,
  type TimelineRootProps,
} from "./timeline";
