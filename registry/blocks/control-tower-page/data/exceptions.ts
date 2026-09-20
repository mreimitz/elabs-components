/** Acme Logistics — shipments the control tower is watching this morning. */

export type ExceptionCause =
  | "Port congestion"
  | "Customs hold"
  | "Weather"
  | "Carrier delay"
  | "Missing documents";
export type ExceptionState = "open" | "mitigating" | "resolved";

export interface ShipmentMilestone {
  title: string;
  detail: string;
  time: string;
  status: "done" | "active" | "pending";
}

export interface ShipmentException {
  id: string;
  customer: string;
  lane: string;
  carrier: string;
  cause: ExceptionCause;
  state: ExceptionState;
  /** Hours behind the promised delivery. */
  slipHours: number;
  /** Hours until the customer's promised window closes. Negative means already missed. */
  hoursToPromise: number;
  /** Goods value, $k — what is at stake. */
  value: number;
  containers: number;
  eta: string;
  promised: string;
  milestones: ShipmentMilestone[];
  /** What the tower recommends doing next. */
  recommendation: string;
}

const journey = (active: string, detail: string): ShipmentMilestone[] => [
  {
    title: "Picked up at origin",
    detail: "Shanghai Yangshan terminal",
    time: "02 Sep",
    status: "done",
  },
  {
    title: "Departed origin port",
    detail: "Vessel loaded and sailed on schedule",
    time: "05 Sep",
    status: "done",
  },
  { title: active, detail, time: "18 Sep", status: "active" },
  {
    title: "Arrive destination port",
    detail: "Berth window not yet confirmed",
    time: "—",
    status: "pending",
  },
  { title: "Delivered", detail: "Final mile booked on arrival", time: "—", status: "pending" },
];

export const shipmentExceptions: ShipmentException[] = [
  {
    id: "SH-20418",
    customer: "Orbit Electronics",
    lane: "Shanghai → Los Angeles",
    carrier: "Atlas Cargo",
    cause: "Port congestion",
    state: "open",
    slipHours: 52,
    hoursToPromise: -4,
    value: 1_840,
    containers: 14,
    eta: "24 Sep",
    promised: "22 Sep",
    milestones: journey(
      "Waiting at anchorage",
      "11 vessels ahead at Long Beach; berth estimate moved twice",
    ),
    recommendation:
      "Divert the six priority containers to Oakland and truck them south — arrives 23 Sep, inside the penalty-free grace day.",
  },
  {
    id: "SH-20377",
    customer: "Halden Pharma",
    lane: "Rotterdam → New York",
    carrier: "Norden Freight",
    cause: "Customs hold",
    state: "mitigating",
    slipHours: 30,
    hoursToPromise: 18,
    value: 2_310,
    containers: 4,
    eta: "21 Sep",
    promised: "21 Sep",
    milestones: journey(
      "Held at customs",
      "Cold-chain certificate requested by the inspector; broker has re-filed",
    ),
    recommendation:
      "Certificate re-filed at 08:40. If no release by 14:00, escalate to the broker's duty officer — the reefers have 36 hours of autonomy.",
  },
  {
    id: "SH-20392",
    customer: "Kestrel Foods",
    lane: "Rotterdam → São Paulo",
    carrier: "Pelican Lines",
    cause: "Weather",
    state: "open",
    slipHours: 21,
    hoursToPromise: 40,
    value: 620,
    containers: 9,
    eta: "27 Sep",
    promised: "28 Sep",
    milestones: journey(
      "Rerouted around storm",
      "Vessel added 310 nautical miles south of the Azores",
    ),
    recommendation: "Still inside the promise. Tell the customer now; no action on the freight.",
  },
  {
    id: "SH-20351",
    customer: "Northwind Retail",
    lane: "Singapore → Rotterdam",
    carrier: "Atlas Cargo",
    cause: "Carrier delay",
    state: "mitigating",
    slipHours: 16,
    hoursToPromise: 60,
    value: 980,
    containers: 22,
    eta: "29 Sep",
    promised: "01 Oct",
    milestones: journey(
      "Transhipment missed",
      "Connection at Colombo missed by five hours; rebooked on the next sailing",
    ),
    recommendation:
      "Rebooked sailing holds the promise with two days of slack. Watch the Colombo departure.",
  },
  {
    id: "SH-20440",
    customer: "Summit Outdoor",
    lane: "Rotterdam → Los Angeles",
    carrier: "Atlas Cargo",
    cause: "Missing documents",
    state: "open",
    slipHours: 9,
    hoursToPromise: 72,
    value: 310,
    containers: 3,
    eta: "02 Oct",
    promised: "04 Oct",
    milestones: journey(
      "Waiting for paperwork",
      "Commercial invoice missing the HS code for two lines",
    ),
    recommendation:
      "Ask the customer's shipping desk for the corrected invoice today; the vessel cut-off is Monday 12:00.",
  },
  {
    id: "SH-20309",
    customer: "Lumen Optics",
    lane: "Dubai → Rotterdam",
    carrier: "Norden Freight",
    cause: "Carrier delay",
    state: "resolved",
    slipHours: 0,
    hoursToPromise: 96,
    value: 450,
    containers: 5,
    eta: "25 Sep",
    promised: "29 Sep",
    milestones: journey("Back on schedule", "Carrier recovered the delay with a faster transit"),
    recommendation: "No action. Closes itself on delivery.",
  },
];
