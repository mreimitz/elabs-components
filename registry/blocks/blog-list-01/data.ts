import { posterArt, type PosterMotif } from "@/components/media-parts/media-fixtures";

export interface BlogAuthor {
  name: string;
  role: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  tag: string;
  author: BlogAuthor;
  /** ISO date (`YYYY-MM-DD`), formatted with `Intl` at render time. */
  date: string;
  readMinutes: number;
  /** The cover picture — a data URL drawn offline here; point it at your own asset. */
  cover: string;
  href: string;
  /** The one post shown large at the top. Defaults to the newest. */
  featured?: boolean;
}

const post = (
  id: string,
  title: string,
  excerpt: string,
  tag: string,
  author: BlogAuthor,
  date: string,
  readMinutes: number,
  motif: PosterMotif,
  featured?: boolean,
): BlogPost => ({
  id,
  title,
  excerpt,
  tag,
  author,
  date,
  readMinutes,
  cover: posterArt(motif, `blog-${id}`),
  href: `#/blog/${id}`,
  featured,
});

const AUTHORS = {
  mara: { name: "Mara Okonkwo", role: "Head of Product" },
  jonas: { name: "Jonas Lindqvist", role: "Staff Engineer, Routing" },
  priya: { name: "Priya Raman", role: "Customs Lead" },
  tomas: { name: "Tomas Berg", role: "CEO & co-founder" },
  aiko: { name: "Aiko Sato", role: "Data Science" },
} satisfies Record<string, BlogAuthor>;

/** The Harbourline blog — engineering, customs, product and company posts. */
export const POSTS: BlogPost[] = [
  post(
    "eta-model-v3",
    "Why our ETAs got 40% tighter in a quarter",
    "We replaced a carrier-reported arrival time with a model that watches vessel AIS, port dwell and the last 90 days of the same lane. Here is what moved the needle — and what did not.",
    "Engineering",
    AUTHORS.jonas,
    "2026-09-18",
    9,
    "waves",
    true,
  ),
  post(
    "customs-brokers-guide",
    "The customs broker’s guide to pre-clearance",
    "Filing before the vessel docks is legal, encouraged and still rare. A walkthrough of the paperwork, the timing window and the three fields brokers get wrong most.",
    "Customs",
    AUTHORS.priya,
    "2026-09-11",
    12,
    "grid",
  ),
  post(
    "control-tower-launch",
    "Introducing Control Tower: every shipment on one screen",
    "Exceptions, not rows. Control Tower groups what needs a decision today and hides the 94% of shipments that are fine.",
    "Product",
    AUTHORS.mara,
    "2026-09-03",
    5,
    "skyline",
  ),
  post(
    "series-b",
    "Harbourline raises a Series B to bring the ops desk to every port",
    "We are hiring across routing, customs and design, and opening an office in Rotterdam. A note on what the money is for.",
    "Company",
    AUTHORS.tomas,
    "2026-08-27",
    4,
    "harbour",
  ),
  post(
    "dwell-time-benchmarks",
    "Port dwell time, benchmarked across 41 terminals",
    "The median container waits 3.4 days after discharge. The best terminal on our network clears in 1.1. The spread is the story.",
    "Data",
    AUTHORS.aiko,
    "2026-08-20",
    7,
    "bars",
  ),
  post(
    "carrier-connect-edi",
    "How we parse 22 EDI dialects without a rules engine",
    "Every carrier speaks a slightly different EDI 315. We stopped writing rules and started writing tests — 4,100 of them.",
    "Engineering",
    AUTHORS.jonas,
    "2026-08-12",
    11,
    "orbit",
  ),
  post(
    "hs-code-mistakes",
    "Five HS code mistakes that cost you a week",
    "Misclassification is the top cause of customs holds we see. Each of these five is a one-line fix in the commercial invoice.",
    "Customs",
    AUTHORS.priya,
    "2026-08-05",
    6,
    "field",
  ),
  post(
    "routing-weather",
    "Routing around a typhoon, in the product",
    "When Typhoon Nari closed Kaohsiung for 60 hours, Harbourline re-planned 1,900 shipments. What the planners saw, and what they overrode.",
    "Product",
    AUTHORS.mara,
    "2026-07-29",
    8,
    "waves",
  ),
  post(
    "on-time-definition",
    "What “on time” should actually mean",
    "Arrived at port? Cleared? At the warehouse door? Three customers, three definitions. We picked one and made it configurable.",
    "Data",
    AUTHORS.aiko,
    "2026-07-22",
    6,
    "grid",
  ),
  post(
    "design-system-notes",
    "Designing for a planner who has eleven tabs open",
    "Our users do not read; they scan, decide and move on. Notes from six months of watching them work.",
    "Product",
    AUTHORS.mara,
    "2026-07-15",
    7,
    "skyline",
  ),
  post(
    "rotterdam-office",
    "Opening Rotterdam",
    "Europe’s largest port gets a Harbourline desk. Why we chose it, and who is moving.",
    "Company",
    AUTHORS.tomas,
    "2026-07-08",
    3,
    "harbour",
  ),
  post(
    "ais-gaps",
    "AIS goes dark more than you think",
    "Nine percent of vessel tracks we ingest have a gap of six hours or more. How we fill them, and when we refuse to guess.",
    "Engineering",
    AUTHORS.jonas,
    "2026-06-30",
    10,
    "orbit",
  ),
];
