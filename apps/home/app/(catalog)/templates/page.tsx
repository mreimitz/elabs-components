import type { Metadata } from "next";
import { BranchIndex } from "../../../components/catalog/listing";
import { templateEntries } from "../../../lib/template-entries";
import { catalogCopy, templateFamilyCopy } from "../../../content/copy";

export const metadata: Metadata = {
  title: catalogCopy.sections.templates,
  description: catalogCopy.sectionLead.templates,
  alternates: { canonical: "/templates" },
};

export default function TemplatesPage() {
  return (
    <BranchIndex
      section="templates"
      title={catalogCopy.sections.templates}
      lead={catalogCopy.sectionLead.templates}
      art="templates"
      entries={templateEntries()}
      familyCopy={templateFamilyCopy}
      columns="wide"
      thumbWidth={1440}
    />
  );
}
