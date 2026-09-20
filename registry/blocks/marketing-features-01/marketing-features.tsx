import type { ReactNode } from "react";
import { Gauge, LockKeyhole, Route, ScanSearch, Truck, Workflow } from "lucide-react";
import { FeatureGrid, type Feature } from "@elabs-ai/components-marketing";
import { SectionHeader } from "@elabs-ai/components-ui";

export interface MarketingFeaturesProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  features?: Feature[];
  columns?: 2 | 3 | 4;
}

const icon = (node: ReactNode) => <span className="text-primary">{node}</span>;

const DEFAULT_FEATURES: Feature[] = [
  {
    icon: icon(<Route aria-hidden="true" />),
    title: "Plans that survive the morning",
    description: "Routes re-plan themselves when a truck is late or an order lands after cut-off.",
  },
  {
    icon: icon(<ScanSearch aria-hidden="true" />),
    title: "Every parcel, one search",
    description: "Scan, type or paste a reference and see where it is and who touched it last.",
  },
  {
    icon: icon(<Truck aria-hidden="true" />),
    title: "A driver app people keep",
    description: "Works offline in the yard, syncs on the road, and needs no training day.",
  },
  {
    icon: icon(<Workflow aria-hidden="true" />),
    title: "Customs without the binder",
    description: "Documents are checked before the vessel sails, not when it is held at the port.",
  },
  {
    icon: icon(<Gauge aria-hidden="true" />),
    title: "Promises you can measure",
    description: "On-time, cost per stop and claims per thousand, per lane and per carrier.",
  },
  {
    icon: icon(<LockKeyhole aria-hidden="true" />),
    title: "Yours to control",
    description: "Single sign-on, audit trails and data residency in the region you choose.",
  },
];

/** A feature section: what it is, in the visitor's words, then six reasons. */
export function MarketingFeatures({
  eyebrow = "Why teams switch",
  title = "Built for the day nothing goes to plan",
  description = "Logistics software is easy when every truck is on time. This is for the other days.",
  features = DEFAULT_FEATURES,
  columns = 3,
}: MarketingFeaturesProps) {
  return (
    <section
      className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-features"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} title={title} />
      <FeatureGrid columns={columns} features={features} />
    </section>
  );
}
