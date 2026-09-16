/**
 * Every user-visible string `DottedChart` (RM-059) renders. `{name}` placeholders are
 * filled at render; override any subset through the component's `labels` prop to localize.
 */

export interface DottedChartLabels {
  /** Accessible name of the plot and its keyboard cursor. */
  chart: string;
  /** `{cases}`, `{events}`, `{from}`, `{to}`, `{sort}`, `{colorBy}` — the parallel summary. */
  summary: string;
  sortStart: string;
  sortEnd: string;
  sortDuration: string;
  sortStartDay: string;
  colorByActivity: string;
  colorByResource: string;
  colorByCustom: string;
  /** `{caseId}`, `{events}`, `{duration}`, `{activities}` — spoken for a focused case row. */
  row: string;
  /** `{activity}`, `{time}`, `{caseId}` — spoken/shown for one event. */
  dot: string;
  /** `{resource}` — appended to a dot tooltip when the event has a resource. */
  dotResource: string;
  eventsOne: string;
  eventsOther: string;
  casesOne: string;
  casesOther: string;
  /** `{count}` more activities past the spoken prefix of a long trace. */
  moreActivities: string;
  /** `{cases}` — visible count of the current selection. */
  selectionCount: string;
  axisAbsolute: string;
  axisRelative: string;
  axisDay: string;
  axisWeek: string;
  /** The legend entry every category past the colour budget shares. */
  other: string;
  /** Category key for an event that carries no resource. */
  noResource: string;
  tableCaption: string;
  columnCase: string;
  columnFirstActivity: string;
  columnLastActivity: string;
  columnStart: string;
  columnEnd: string;
  columnDuration: string;
  columnEvents: string;
  columnState: string;
  selected: string;
  empty: string;
  emptyBody: string;
}

/** The shipped English labels. */
export const DOTTED_CHART_DEFAULT_LABELS: Readonly<DottedChartLabels> = Object.freeze({
  chart: "Dotted chart — one row per case, one dot per event",
  summary:
    "{cases} and {events}, from {from} to {to}. One row per case, sorted by {sort}; one dot per event, coloured by {colorBy}.",
  sortStart: "case start",
  sortEnd: "case end",
  sortDuration: "case duration",
  sortStartDay: "time of day the case started",
  colorByActivity: "activity",
  colorByResource: "resource",
  colorByCustom: "category",
  row: "Case {caseId}, {events}, {duration}: {activities}",
  dot: "{activity} at {time}, case {caseId}",
  dotResource: "by {resource}",
  eventsOne: "{count} event",
  eventsOther: "{count} events",
  casesOne: "{count} case",
  casesOther: "{count} cases",
  moreActivities: "and {count} more",
  selectionCount: "{cases} selected",
  axisAbsolute: "Time (UTC)",
  axisRelative: "Time since case start",
  axisDay: "Time of day (UTC)",
  axisWeek: "Time of week (UTC)",
  other: "Other",
  noResource: "No resource",
  tableCaption: "Cases — first and last activity, start, end, duration and event count",
  columnCase: "Case",
  columnFirstActivity: "First activity",
  columnLastActivity: "Last activity",
  columnStart: "Start",
  columnEnd: "End",
  columnDuration: "Duration",
  columnEvents: "Events",
  columnState: "State",
  selected: "selected",
  empty: "No events",
  emptyBody: "No cases match the current filters.",
});
