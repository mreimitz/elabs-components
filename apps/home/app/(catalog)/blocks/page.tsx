import type { Metadata } from "next";
import { BranchIndex } from "../../../components/catalog/listing";
import { entriesOf } from "../../../lib/catalog";
import { blockFamilyCopy, catalogCopy } from "../../../content/copy";

export const metadata: Metadata = {
  title: catalogCopy.sections.blocks,
  description: catalogCopy.sectionLead.blocks,
  alternates: { canonical: "/blocks" },
};

export default function BlocksPage() {
  return (
    <BranchIndex
      section="blocks"
      title={catalogCopy.sections.blocks}
      lead={catalogCopy.sectionLead.blocks}
      art="blocks"
      entries={entriesOf("blocks")}
      familyCopy={blockFamilyCopy}
      thumbWidth={960}
    />
  );
}
