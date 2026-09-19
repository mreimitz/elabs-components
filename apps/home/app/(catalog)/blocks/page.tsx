import type { Metadata } from "next";
import { EntryGrid, GroupHeading, IndexHeader } from "../../../components/catalog/entry-grid";
import { entriesOf, grouped } from "../../../lib/catalog";
import { catalogCopy } from "../../../content/copy";

export const metadata: Metadata = {
  title: catalogCopy.sections.blocks,
  description: catalogCopy.sectionLead.blocks,
  alternates: { canonical: "/blocks" },
};

const ORDER = ["KPI Cards", "Infographics", "Agent Ops", "Compositions"];

export default function BlocksPage() {
  const all = entriesOf("blocks");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-10">
      <IndexHeader
        title={catalogCopy.sections.blocks}
        lead={catalogCopy.sectionLead.blocks}
        count={all.length}
      />
      {grouped(all, ORDER).map(([group, list]) => (
        <section key={group} className="flex flex-col gap-5">
          <GroupHeading
            id={group.toLowerCase().replace(/\s+/g, "-")}
            label={group}
            count={list.length}
          />
          <EntryGrid entries={list} thumbWidth={960} />
        </section>
      ))}
    </div>
  );
}
