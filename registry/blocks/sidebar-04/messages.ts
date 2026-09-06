/**
 * The message model this shell renders, plus a believable fixture.
 *
 * The shape is deliberately small: a mail shell is a LIST + a READING PANE, and
 * everything the two zones need is here. Replace `DEMO_MESSAGES` with your own
 * query — nothing in the shell reads the fixture directly, it is only the
 * default for the shell's `messages` prop.
 */

/** One message, as both the list row and the reading pane need it. */
export interface MailMessage {
  /** Stable id — also the last segment of the message route. */
  id: string;
  from: { name: string; email: string };
  subject: string;
  /** First line or two, shown under the subject in the list. */
  preview: string;
  /** Full body. Blank lines separate paragraphs. */
  body: string;
  /** ISO 8601 — formatted for display through `Intl`, never a hand-rolled string. */
  receivedAt: string;
  unread?: boolean;
  /** Label ids from `nav-items.ts`, shown as chips in the reading pane. */
  labels?: string[];
}

/** The route a message opens at. One place, so the list and the pane agree. */
export function messageHref(id: string): string {
  return `/mail/${id}`;
}

/**
 * Display date for a list row and the reading pane.
 *
 * `Intl.DateTimeFormat` rather than a hand-written `MMM d` — a hard-coded date
 * format is one of the anti-patterns this repo lints for, and a mail list is
 * exactly where a reader expects their own locale's ordering. The formatter is
 * built once per module rather than per row: constructing one is the expensive
 * part of `Intl`, and a 200-row list would build 200 of them.
 */
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const FULL_FORMAT = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
export function formatDay(iso: string): string {
  return DAY_FORMAT.format(new Date(iso));
}
export function formatFull(iso: string): string {
  return FULL_FORMAT.format(new Date(iso));
}

/** Demo fixture — replace with your own data. */
export const DEMO_MESSAGES: MailMessage[] = [
  {
    id: "welcome",
    from: { name: "Nora Patel", email: "nora@northwind.example" },
    subject: "Welcome to the Northwind pilot",
    preview:
      "Your workspace is ready. I have added the three seats you asked for and pinned the runbook.",
    body: "Your workspace is ready. I have added the three seats you asked for and pinned the runbook to the top of the shared space.\n\nThe pilot runs for six weeks. We will look at adoption at the halfway mark and decide together whether to widen it to the rest of the team.\n\nAnything you need in the meantime, reply here and it lands with me directly.",
    receivedAt: "2026-09-04T09:12:00Z",
    unread: true,
    labels: ["work"],
  },
  {
    id: "invoice-4821",
    from: { name: "Billing", email: "billing@northwind.example" },
    subject: "Invoice 4821 is ready",
    preview: "September usage came in slightly under the plan minimum. No action needed.",
    body: "September usage came in slightly under the plan minimum, so this invoice charges the minimum rather than the metered total.\n\nNo action is needed — the card on file is charged on the 8th.",
    receivedAt: "2026-09-03T16:40:00Z",
    unread: true,
    labels: ["receipts"],
  },
  {
    id: "itinerary",
    from: { name: "Marek Dvořák", email: "marek@northwind.example" },
    subject: "Itinerary for the Lisbon workshop",
    preview: "Flights are booked. The room is held from Tuesday afternoon through Thursday lunch.",
    body: "Flights are booked and the room is held from Tuesday afternoon through Thursday lunch.\n\nI have left Wednesday evening open — there is a place near the water that takes a group of twelve if we decide by Monday.",
    receivedAt: "2026-09-03T11:05:00Z",
    unread: true,
    labels: ["travel", "work"],
  },
  {
    id: "design-review",
    from: { name: "Ada Okonkwo", email: "ada@northwind.example" },
    subject: "Notes from the design review",
    preview: "Two things came up that we should settle before the build starts.",
    body: "Two things came up that we should settle before the build starts.\n\nFirst, the empty state needs a way out — right now it names the absence and stops there. Second, the list and the reading pane disagree about what “selected” looks like.\n\nBoth are small. I can take them if nobody else has picked them up.",
    receivedAt: "2026-09-02T14:22:00Z",
    labels: ["work"],
  },
  {
    id: "receipt-hosting",
    from: { name: "Hosting", email: "receipts@vendor.example" },
    subject: "Your receipt for August",
    preview: "Thanks for your payment. This receipt is for your records.",
    body: "Thanks for your payment. This receipt is for your records; nothing else is needed.\n\nYour next renewal is on the first of the month.",
    receivedAt: "2026-08-31T07:00:00Z",
    labels: ["receipts"],
  },
  {
    id: "book-club",
    from: { name: "Tomas Rey", email: "tomas@example.com" },
    subject: "Thursday?",
    preview: "We are two chapters behind and nobody minds. Same place, seven o’clock.",
    body: "We are two chapters behind and nobody minds.\n\nSame place, seven o’clock. Bring the one you were arguing for last time.",
    receivedAt: "2026-08-30T19:31:00Z",
    labels: ["personal"],
  },
  {
    id: "status-page",
    from: { name: "Status", email: "status@northwind.example" },
    subject: "Resolved: elevated latency in eu-west",
    preview: "Between 06:10 and 06:52 UTC a subset of requests took longer than usual.",
    body: "Between 06:10 and 06:52 UTC a subset of requests in eu-west took longer than usual.\n\nThe cause was a slow rollout of a cache change. It has been rolled back and latency is back to normal. A full write-up follows this week.",
    receivedAt: "2026-08-29T08:05:00Z",
  },
];
