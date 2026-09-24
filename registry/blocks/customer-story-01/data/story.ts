/**
 * The sample story: Northwind Retail, the fictional customer the marketing
 * blocks already quote. The film and every picture are synthesized by
 * `media-parts` (a silent clip stands in for the film, SVG for the frames), so
 * the block renders offline; point `video`, `screenshots` and `related` at your
 * own assets when you copy it.
 */
import {
  captionsTrack,
  posterArt,
  screenshotArt,
  silentClip,
} from "@/components/media-parts/media-fixtures";

export interface StoryVideo {
  /** The film (any URL the browser can play). */
  src: string;
  /** Its poster frame. */
  poster: string;
  /** WebVTT captions — every non-decorative film needs one. */
  captions?: string;
  /** Length in seconds, for the caption line. */
  seconds: number;
  /** Who speaks, shown under the player. */
  caption: string;
}

export interface StoryFact {
  label: string;
  /** A plain value, or several shown as tags. */
  value: string | string[];
  numeric?: boolean;
}

export interface StoryResult {
  label: string;
  value: string;
  description: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  /** Whether up is the good direction — `false` for a time or a cost. */
  positiveIsGood?: boolean;
}

export interface StoryQuote {
  text: string;
  name: string;
  role: string;
}

export interface StorySection {
  id: string;
  /** The running number, "01". */
  number: string;
  title: string;
  paragraphs: string[];
  /** A pull quote rendered after the paragraphs. */
  quote?: StoryQuote;
}

export interface StoryScreenshot {
  id: string;
  src: string;
  alt: string;
  caption: string;
}

export interface RelatedStory {
  id: string;
  customer: string;
  industry: string;
  title: string;
  poster: string;
  readMinutes: number;
  href: string;
}

export interface CustomerStory {
  customer: string;
  industry: string;
  title: string;
  lead: string;
  published: string;
  readMinutes: number;
  video: StoryVideo;
  results: StoryResult[];
  facts: StoryFact[];
  sections: StorySection[];
  screenshots: StoryScreenshot[];
  related: RelatedStory[];
  cta: { title: string; description: string; primary: string; secondary: string };
}

const FILM_SECONDS = 12;

export const STORY: CustomerStory = {
  customer: "Northwind Retail",
  industry: "Logistics",
  title: "How Northwind Retail cut customs clearance from 31 hours to 19",
  lead: "Four ports, nine brokers and a wall of spreadsheets. Northwind moved its import desk onto one operating view and gave the people on the docks the next action, not another report.",
  published: "3 Sep 2026",
  readMinutes: 6,
  video: {
    src: silentClip(FILM_SECONDS),
    poster: posterArt("harbour", "northwind-film"),
    captions: captionsTrack(FILM_SECONDS, [
      "We stopped asking where a shipment is.",
      "We started asking what to do about it.",
      "Clearance went from 31 hours to 19 in the first month.",
      "The drivers chose to keep the app after the pilot.",
    ]),
    seconds: FILM_SECONDS,
    caption: "Ingrid Solberg, COO, and Leila Haddad, Customs Lead, on the first month",
  },
  results: [
    {
      label: "Clearance time",
      value: "19 h",
      description: "From 31 h before the rollout",
      delta: "−39%",
      deltaDirection: "down",
      positiveIsGood: false,
    },
    {
      label: "Shipments on one view",
      value: "100%",
      description: "Four ports, nine brokers",
      delta: "+4 ports",
      deltaDirection: "up",
    },
    {
      label: "Demurrage charges",
      value: "−€412k",
      description: "First two quarters, year on year",
      delta: "−58%",
      deltaDirection: "down",
      positiveIsGood: false,
    },
    {
      label: "Driver app adoption",
      value: "94%",
      description: "Weekly active after the pilot",
      delta: "+61 pts",
      deltaDirection: "up",
    },
  ],
  facts: [
    { label: "Industry", value: "Retail logistics" },
    { label: "Headquarters", value: "Bergen, Norway" },
    { label: "Employees", value: "2,400", numeric: true },
    { label: "Ports served", value: "4", numeric: true },
    { label: "Products", value: ["Operations Desk", "Driver App", "Customs Connector"] },
    { label: "Went live", value: "March 2026" },
    { label: "Deployment", value: "Cloud, EU region" },
    { label: "Integrations", value: ["SAP", "Descartes", "Port community systems"] },
  ],
  sections: [
    {
      id: "challenge",
      number: "01",
      title: "The challenge",
      paragraphs: [
        "Northwind imports about 1,900 containers a month through Bergen, Oslo, Gothenburg and Rotterdam. Every one of them passed through a broker, a port community system and at least one spreadsheet before anyone on the import desk knew whether it was cleared, held or waiting on a document nobody had asked for.",
        "The desk was not short of data. It was short of one place where the data agreed with itself. By the time a hold showed up in the weekly report, the container had usually been sitting for two days and the demurrage clock was already running.",
      ],
    },
    {
      id: "approach",
      number: "02",
      title: "The approach",
      paragraphs: [
        "The team started with the one question the desk asked most: which containers need a person today? The Operations Desk answers it as a queue, ordered by cost of delay, with the missing document or the broker to call as the next action on each row.",
        "The Customs Connector reads the brokers’ and ports’ feeds as they change, so the queue is the current state, not a nightly export. The Driver App shows the same container to the driver — pick-up window, gate, paperwork — so the yard and the desk stop reconciling by phone.",
      ],
      quote: {
        text: "The team stopped asking where a shipment is and started asking what to do about it.",
        name: "Ingrid Solberg",
        role: "COO, Northwind Retail",
      },
    },
    {
      id: "result",
      number: "03",
      title: "The result",
      paragraphs: [
        "Clearance time fell from 31 hours to 19 in the first month and has held there. Demurrage charges came down by more than half over the two quarters that followed, and the customs team now spends its mornings on the exceptions rather than on finding out which ones exist.",
        "The part nobody planned for: the drivers chose to keep the app after the pilot. Weekly active use is at 94 percent, and the yard has stopped keeping its own list.",
      ],
      quote: {
        text: "Clearance went from 31 hours to 19 in the first month. Nothing else we changed that year came close.",
        name: "Leila Haddad",
        role: "Customs Lead, Northwind Retail",
      },
    },
  ],
  screenshots: [
    {
      id: "queue",
      src: screenshotArt("table", "northwind-queue"),
      alt: "The import desk queue: one row per container, ordered by cost of delay",
      caption:
        "The queue the desk opens every morning — containers ordered by cost of delay, with the next action on each row.",
    },
    {
      id: "desk",
      src: screenshotArt("dashboard", "northwind-desk"),
      alt: "The operations dashboard with clearance time, holds and demurrage tiles",
      caption: "Clearance time, open holds and demurrage at risk, by port.",
    },
    {
      id: "route",
      src: screenshotArt("map", "northwind-route"),
      alt: "A map of the four ports with a container’s route drawn between them",
      caption: "Where each container is, and where it goes next.",
    },
    {
      id: "flow",
      src: screenshotArt("flow", "northwind-flow"),
      alt: "The customs connector’s document flow between brokers and ports",
      caption: "The Customs Connector: brokers, ports and the desk on one document flow.",
    },
    {
      id: "timeline",
      src: screenshotArt("timeline", "northwind-timeline"),
      alt: "A container’s timeline from booking to gate-out",
      caption: "One container’s timeline, booking to gate-out.",
    },
  ],
  related: [
    {
      id: "pelican",
      customer: "Pelican Lines",
      industry: "Shipping",
      title: "Drivers kept the app after the pilot — and the yard stopped keeping its own list",
      poster: posterArt("waves", "pelican"),
      readMinutes: 5,
      href: "#pelican-lines",
    },
    {
      id: "halden",
      customer: "Halden Pharma",
      industry: "Pharmaceuticals",
      title: "Three tools and a wall of spreadsheets, replaced before the audit",
      poster: posterArt("grid", "halden"),
      readMinutes: 4,
      href: "#halden-pharma",
    },
    {
      id: "kestrel",
      customer: "Kestrel Foods",
      industry: "Food and beverage",
      title: "Knowing a vessel slipped before the customer did",
      poster: posterArt("skyline", "kestrel"),
      readMinutes: 7,
      href: "#kestrel-foods",
    },
  ],
  cta: {
    title: "See it on your own lanes",
    description: "A 30-minute walkthrough with your ports, your brokers and one week of your data.",
    primary: "Talk to sales",
    secondary: "Download the story (PDF)",
  },
};
