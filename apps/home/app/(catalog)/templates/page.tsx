import type { Metadata } from "next";
import { EntryGrid, IndexHeader } from "../../../components/catalog/entry-grid";
import { entriesOf } from "../../../lib/catalog";
import { catalogCopy } from "../../../content/copy";

export const metadata: Metadata = {
  title: catalogCopy.sections.templates,
  description: catalogCopy.sectionLead.templates,
  alternates: { canonical: "/templates" },
};

export default function TemplatesPage() {
  const all = entriesOf("templates");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <IndexHeader
        title={catalogCopy.sections.templates}
        lead={catalogCopy.sectionLead.templates}
        count={all.length}
      />
      <EntryGrid entries={all} columns="wide" thumbWidth={1440} />
    </div>
  );
}
