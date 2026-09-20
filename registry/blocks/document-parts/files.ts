/**
 * The supplier data room every document block reads from — a contract, a policy, a quality
 * report, a defect log, a batch record, an inspection log, a chart and the code that routes a
 * return. Text sources on purpose: the blocks run without a network or a parser download, and
 * the viewer treats a string, a File, a Blob and a URL the same way.
 *
 * Everything here is fictional.
 */
import type { FileSource } from "@elabs-ai/components-ui";

export interface DataRoomFile {
  id: string;
  folder: "Contracts" | "Quality" | "Operations";
  /** Bytes, for the list. */
  size: number;
  /** ISO date, for the list. */
  modified: string;
  owner: string;
  source: FileSource & { name: string };
}

const AGREEMENT = `# Supply agreement — NB Packs GmbH

**Between** Northwind Outdoor B.V. ("the Buyer") **and** NB Packs GmbH ("the Supplier").
Effective 1 March 2024. Reference NW-SUP-0417.

## 1. Scope

The Supplier manufactures backpacks of the Trail series to the Buyer's specification TS-40 rev. C and delivers them to the Buyer's warehouse in Venlo.

## 4. Quality

4.1 Every batch is inspected on arrival against acceptance level AQL 1.5 for major defects.

4.2 A seam that fails below 220 newtons in the pull test counts as a major defect.

4.3 The Buyer may reject a batch in which more than 1.5 % of inspected units show a major defect.

## 7. Defects and remedies

7.1 The Supplier warrants every unit against defects in material and workmanship for 24 months from delivery.

7.2 The Buyer must notify the Supplier of a defect in writing within 30 days of discovering it, with the batch number and photographs of at least three affected units.

7.3 For a confirmed defect the Supplier refunds the unit price and the Buyer's documented cost of handling the return, up to 15 % of the unit price.

7.4 If more than 3 % of a batch is returned by end customers for the same defect within 12 months, the Supplier bears the cost of recalling the rest of that batch.

## 9. Liability

9.1 Neither party is liable for indirect or consequential loss.

9.2 The Supplier's total liability in a contract year is capped at the value of goods delivered in that year.

## 11. Term and termination

11.1 This agreement runs for three years and renews for one year at a time unless either party gives 90 days' notice.

11.2 The Buyer may terminate with 30 days' notice if three batches are rejected under clause 4.3 within six months.
`;

const REFUND_POLICY = `# Refund policy — consumer orders

Version 7, in force since 1 January 2025.

## Window

A customer can return an unused item within 30 days of delivery for a full refund.

## Defects

A defect in material or workmanship is refunded in full at any time within the 24-month warranty, whether or not the item was used.

A team lead may approve a refund up to 14 days after the window closes when the photographs show a manufacturing defect rather than wear.

## Store credit

Instead of a refund an agent may offer store credit of the refund amount plus 11 %. The customer has seven days to accept.

## What we log

Every refund for a defect is logged against the supplier batch printed on the inside label, so that repeated failures reach the quality team.
`;

const QUALITY_REPORT = `# Quality report — Q3 2025

Prepared by the quality team, 6 October 2025.

## Summary

Returns for defects rose from 0.9 % to 1.6 % of units sold. One product and one supplier batch explain the rise.

## Trail 40, batch NB-0931

Batch NB-0931 was delivered on 14 July with 4,800 units. By 30 September 171 units had come back with a failed shoulder-strap seam, which is 3.6 % of the batch.

The pull test on twelve returned units measured between 148 and 201 newtons. The specification requires 220 newtons.

The supplier changed the thread on 2 July without telling us. Batches before that date show no seam failures.

## Other products

No other product moved by more than 0.2 points. The Ridge 28 zip failure reported in Q2 has not recurred since the slider was replaced.

## Recommendation

Stop selling the remaining 1,912 units of NB-0931, notify the supplier under the agreement and claim the recall cost.
`;

const DEFECT_LOG = `date,order,product,batch,defect,pull_test_n,refund_eur
2025-08-04,57102,Trail 40,NB-0931,strap seam,188,189.00
2025-08-11,57388,Trail 40,NB-0931,strap seam,172,189.00
2025-08-12,57401,Ridge 28,RB-2210,zip slider,,129.00
2025-08-19,57644,Trail 40,NB-0931,strap seam,201,189.00
2025-08-27,57790,Trail 40,NB-0931,strap seam,148,189.00
2025-09-02,57856,Trail 40,NB-0931,buckle,,189.00
2025-09-09,57990,Trail 40,NB-0931,strap seam,166,189.00
2025-09-15,58044,Trail 40,NB-0929,strap seam,231,189.00
2025-09-22,58101,Trail 40,NB-0931,strap seam,159,189.00
2025-09-29,58114,Trail 40,NB-0931,strap seam,177,189.00
`;

const BATCH_RECORD = `{
  "batch": "NB-0931",
  "product": "Trail 40 backpack, moss",
  "supplier": "NB Packs GmbH",
  "delivered": "2025-07-14",
  "units": 4800,
  "inspection": {
    "sampled": 200,
    "majorDefects": 2,
    "aql": 1.5,
    "result": "accepted"
  },
  "threadLot": "TL-5520",
  "threadChangedOn": "2025-07-02",
  "returnedForSeam": 171,
  "inStock": 1912,
  "status": "sales-hold"
}
`;

const INSPECTION_LOG = `2025-07-14 08:02:11 INFO  dock 3: batch NB-0931 arrived, 96 cartons, 4800 units
2025-07-14 08:40:52 INFO  sampling 200 units at AQL 1.5 (general level II)
2025-07-14 10:15:03 INFO  visual check complete: 0 critical, 2 major, 5 minor
2025-07-14 10:15:04 WARN  major: loose shoulder-strap seam on units 0417 and 1288
2025-07-14 11:02:37 INFO  pull test on 5 units: 226 N, 231 N, 219 N, 224 N, 228 N
2025-07-14 11:02:38 WARN  unit 3 measured 219 N, below the 220 N specification
2025-07-14 11:30:00 INFO  result: accepted, 2 major defects against an acceptance number of 7
2025-07-14 11:30:01 INFO  note from inspector: thread looks thinner than on NB-0929, flagged to quality
2025-07-14 11:45:19 INFO  batch released to pick faces
`;

const RETURNS_HANDLER = `interface Order {
  id: string;
  batch: string;
  deliveredAt: Date;
}

const WINDOW_DAYS = 30;
const LEAD_EXTENSION_DAYS = 14;

export type Decision = "auto-approve" | "needs-team-lead" | "decline";

/** Routes a return request. A defect inside the warranty never depends on the window. */
export function routeReturn(order: Order, reason: "unused" | "defect", today = new Date()): Decision {
  const days = Math.floor((today.getTime() - order.deliveredAt.getTime()) / 86_400_000);

  if (reason === "defect") {
    console.info("defect", { order: order.id, batch: order.batch, days });
    return days <= WINDOW_DAYS ? "auto-approve" : "needs-team-lead";
  }
  if (days <= WINDOW_DAYS) return "auto-approve";
  return days <= WINDOW_DAYS + LEAD_EXTENSION_DAYS ? "needs-team-lead" : "decline";
}
`;

// The file's own colours, as authored: a viewer shows a document as it is and themes only the
// chrome around it.
const SEAM_CHART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="300" viewBox="0 0 520 300">
  <rect width="520" height="300" fill="white"/>
  <text x="24" y="38" font-family="Helvetica, Arial, sans-serif" font-size="17" fill="dimgray">Strap seam pull test, returned units of NB-0931 (newtons)</text>
  <line x1="40" y1="250" x2="496" y2="250" stroke="darkgray" stroke-width="2"/>
  <line x1="40" y1="96" x2="496" y2="96" stroke="indianred" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="404" y="88" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="indianred">spec 220 N</text>
  <rect x="56" y="118" width="40" height="132" fill="steelblue"/>
  <rect x="112" y="130" width="40" height="120" fill="steelblue"/>
  <rect x="168" y="109" width="40" height="141" fill="steelblue"/>
  <rect x="224" y="146" width="40" height="104" fill="steelblue"/>
  <rect x="280" y="134" width="40" height="116" fill="steelblue"/>
  <rect x="336" y="139" width="40" height="111" fill="steelblue"/>
  <rect x="392" y="126" width="40" height="124" fill="steelblue"/>
  <rect x="448" y="121" width="40" height="129" fill="steelblue"/>
</svg>`;

export const DATA_ROOM: DataRoomFile[] = [
  {
    id: "agreement",
    folder: "Contracts",
    size: 18_432,
    modified: "2024-03-01",
    owner: "Legal",
    source: { kind: "text", text: AGREEMENT, name: "Supply agreement NB Packs.md" },
  },
  {
    id: "refund-policy",
    folder: "Contracts",
    size: 6_144,
    modified: "2025-01-01",
    owner: "Customer care",
    source: { kind: "text", text: REFUND_POLICY, name: "Refund policy v7.md" },
  },
  {
    id: "quality-report",
    folder: "Quality",
    size: 24_576,
    modified: "2025-10-06",
    owner: "Quality",
    source: { kind: "text", text: QUALITY_REPORT, name: "Quality report Q3 2025.md" },
  },
  {
    id: "defect-log",
    folder: "Quality",
    size: 2_048,
    modified: "2025-09-29",
    owner: "Quality",
    source: { kind: "text", text: DEFECT_LOG, name: "defect-log.csv" },
  },
  {
    id: "seam-chart",
    folder: "Quality",
    size: 1_536,
    modified: "2025-10-02",
    owner: "Quality",
    source: {
      kind: "url",
      url: `data:image/svg+xml;utf8,${encodeURIComponent(SEAM_CHART_SVG)}`,
      name: "seam-pull-test.svg",
      mediaType: "image/svg+xml",
      alt: "Bar chart of eight pull tests on returned units; every bar ends below the dashed 220 newton specification line.",
    },
  },
  {
    id: "batch-record",
    folder: "Operations",
    size: 512,
    modified: "2025-10-01",
    owner: "Warehouse",
    source: { kind: "text", text: BATCH_RECORD, name: "batch-NB-0931.json" },
  },
  {
    id: "inspection-log",
    folder: "Operations",
    size: 1_024,
    modified: "2025-07-14",
    owner: "Warehouse",
    source: { kind: "text", text: INSPECTION_LOG, name: "inbound-inspection-NB-0931.log" },
  },
  {
    id: "returns-handler",
    folder: "Operations",
    size: 1_280,
    modified: "2025-02-18",
    owner: "Platform",
    source: { kind: "text", text: RETURNS_HANDLER, name: "route-return.ts" },
  },
];

export const fileById = (id: string) => DATA_ROOM.find((file) => file.id === id);
