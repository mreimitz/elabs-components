/**
 * Timeline — MOVED to `@qlik-coe-emea/qlabs-components-ui` (#190, research 10 §B.2; the ADR-0012
 * own/re-export model). `@qlik-coe-emea/qlabs-components-ui` owns the canonical rail; this shim keeps
 * the editor-facing surface byte-compatible — `markdown/index.ts` and the
 * `:::timeline` preview keep importing from `../timeline` unchanged.
 *
 * `TimelineItem` here is the ARRAY-item data shape (named `TimelineEntry` in
 * `@qlik-coe-emea/qlabs-components-ui`, where `TimelineItem` is the compound `<li>` part); the alias
 * preserves the editor's original public type name. `TimelineStatus`
 * (`done|active|pending`) now lives with its `fromTimelineStatus` mapper in
 * status-badge and reaches the `@qlik-coe-emea/qlabs-components-ui` barrel from there.
 */
export {
  Timeline,
  type TimelineEntry as TimelineItem,
  type TimelineProps,
  type TimelineStatus,
} from "@qlik-coe-emea/qlabs-components-ui";
