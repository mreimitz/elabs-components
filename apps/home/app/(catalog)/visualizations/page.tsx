import type { Metadata } from "next";
import { BranchIndex } from "../../../components/catalog/listing";
import { entriesOf } from "../../../lib/catalog";
import { blockFamilyCopy, catalogCopy } from "../../../content/copy";

export const metadata: Metadata = {
  title: catalogCopy.sections.visualizations,
  description: catalogCopy.sectionLead.visualizations,
  alternates: { canonical: "/visualizations" },
};

// Data-viz use cases: what the chart components add up to. The chart types themselves are
// components (`/components/charts`).
export default function VisualizationsPage() {
  return (
    <BranchIndex
      section="visualizations"
      title={catalogCopy.sections.visualizations}
      lead={catalogCopy.sectionLead.visualizations}
      art="charts"
      entries={entriesOf("visualizations")}
      familyCopy={blockFamilyCopy}
      thumbWidth={960}
    />
  );
}
