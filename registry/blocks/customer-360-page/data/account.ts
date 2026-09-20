/** One customer of Acme Logistics, seen from the account team's side. Facts only. */

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const account = {
  name: "Northwind Retail",
  initials: "NR",
  industry: "Grocery and general retail",
  tier: "Strategic",
  region: "EMEA · Rotterdam",
  owner: "Ava Reyes",
  successManager: "Jonas Weber",
  customerSince: "March 2021",
  renewal: "14 December 2026",
  daysToRenewal: 86,
  /** Annual recurring revenue, $k. */
  arr: 1_240,
  arrChange: "+18%",
  /** Shipments a month, contract commitment and last month's actual. */
  committedShipments: 4_200,
  actualShipments: 4_870,
  nps: 46,
  npsChange: "+8",
  openTickets: 3,
  health: 78,
};

/** What moves the health score, in points — fed to the score-explanation block. */
export const healthSignals = [
  { id: "volume", label: "Volume 16% above commitment for three months", points: 14 },
  { id: "adoption", label: "Customs module adopted by both depots", points: 9 },
  { id: "exec", label: "Quarterly review attended by their COO", points: 7 },
  { id: "tickets", label: "Two tickets open longer than ten days", points: -8 },
  { id: "champion", label: "Day-to-day champion moved to another team", points: -6 },
];

export type ShipmentWeek = { date: Date; shipments: number; commitment: number };

/** Weekly shipments against the contract's weekly commitment, 26 weeks. */
export const shipmentWeeks: ShipmentWeek[] = (() => {
  const rnd = seeded(314);
  return Array.from({ length: 26 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 2, 23 + i * 7)),
    shipments: Math.round(930 + i * 9 + Math.sin(i / 2.4) * 70 + (rnd() - 0.5) * 80),
    commitment: 970,
  }));
})();

export const healthMetrics = [
  { key: "adoption", label: "Adoption" },
  { key: "volume", label: "Volume" },
  { key: "support", label: "Support" },
  { key: "payments", label: "Payments" },
  { key: "sentiment", label: "Sentiment" },
];

export const healthProfiles = [
  {
    label: "Northwind Retail",
    values: { adoption: 84, volume: 92, support: 58, payments: 95, sentiment: 72 },
  },
  {
    label: "Strategic accounts, median",
    values: { adoption: 70, volume: 74, support: 76, payments: 88, sentiment: 68 },
  },
];

export interface AccountContact {
  name: string;
  role: string;
  stance: "champion" | "supporter" | "neutral" | "new";
  lastTouch: string;
}

export const contacts: AccountContact[] = [
  {
    name: "Ingrid Solberg",
    role: "Chief Operating Officer",
    stance: "supporter",
    lastTouch: "QBR, 4 Sep",
  },
  {
    name: "Tomas Pereira",
    role: "Head of Logistics",
    stance: "new",
    lastTouch: "Intro call, 11 Sep",
  },
  {
    name: "Leila Haddad",
    role: "Customs Lead",
    stance: "champion",
    lastTouch: "Ticket reply, 17 Sep",
  },
  {
    name: "Pieter de Boer",
    role: "Procurement Manager",
    stance: "neutral",
    lastTouch: "Email, 28 Aug",
  },
];

export interface AccountEvent {
  title: string;
  detail: string;
  time: string;
  status: "done" | "active" | "pending";
}

export const accountEvents: AccountEvent[] = [
  {
    title: "Renewal proposal due",
    detail: "Three-year term with the customs module bundled. Draft is with finance.",
    time: "2 Oct",
    status: "pending",
  },
  {
    title: "Ticket escalated: label printing at Depot 2",
    detail: "Open 12 days. Engineering has a fix in test; customer asked for a date.",
    time: "17 Sep",
    status: "active",
  },
  {
    title: "New Head of Logistics introduced",
    detail: "Tomas Pereira replaces the previous day-to-day champion.",
    time: "11 Sep",
    status: "done",
  },
  {
    title: "Quarterly business review",
    detail: "COO attended. Asked for a carbon report per lane by year end.",
    time: "4 Sep",
    status: "done",
  },
  {
    title: "Customs module live at both depots",
    detail: "Clearance time down from 31 to 19 hours in the first month.",
    time: "12 Aug",
    status: "done",
  },
];

export interface NextAction {
  id: string;
  title: string;
  why: string;
  owner: string;
  due: string;
}

export const nextActions: NextAction[] = [
  {
    id: "ticket",
    title: "Give Leila a fix date for the Depot 2 ticket",
    why: "Oldest open ticket; it is the largest drag on the health score.",
    owner: "Jonas Weber",
    due: "Today",
  },
  {
    id: "champion",
    title: "Book a working session with Tomas Pereira",
    why: "New in role and decides day-to-day usage; no relationship yet.",
    owner: "Ava Reyes",
    due: "This week",
  },
  {
    id: "carbon",
    title: "Scope the per-lane carbon report",
    why: "The COO's one ask from the review, and a reason to renew for three years.",
    owner: "Ava Reyes",
    due: "Before 2 Oct",
  },
];
