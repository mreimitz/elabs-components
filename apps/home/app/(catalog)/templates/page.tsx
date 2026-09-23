/**
 * `/templates` (RM-153): the highlights live, then every template by the world it belongs to —
 * a visitor from a domain finds theirs without knowing a product name. The Storybook families
 * (who builds it) keep their own pages under `/templates/group/<family>`, reached from the rail.
 */
import type { Metadata } from "next";
import { Band } from "../../../components/band";
import { PageBand } from "../../../components/page-band";
import { Entries } from "../../../components/catalog/listing";
import { GroupHeading, IndexHeader } from "../../../components/catalog/entry-grid";
import { DomainRow, TemplateWorlds } from "../../../components/catalog/template-worlds";
import { templateEntries, templateWorlds } from "../../../lib/template-entries";
import { catalogCopy } from "../../../content/copy";

export const metadata: Metadata = {
  title: catalogCopy.sections.templates,
  description: catalogCopy.sectionLead.templates,
  alternates: { canonical: "/templates" },
};

const copy = catalogCopy.index;

export default function TemplatesPage() {
  const entries = templateEntries();
  const worlds = templateWorlds(entries);
  const highlights = entries.filter((e) => e.featured > 0).sort((a, b) => a.featured - b.featured);
  return (
    <>
      <PageBand width="6xl" art="templates">
        <div className="flex flex-col gap-6">
          <IndexHeader
            title={catalogCopy.sections.templates}
            lead={catalogCopy.sectionLead.templates}
            count={entries.length}
          />
          <DomainRow worlds={worlds} />
        </div>
      </PageBand>
      <Band width="6xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
          <section className="flex flex-col gap-5" aria-labelledby="highlights">
            <div className="flex flex-col gap-1">
              <GroupHeading id="highlights" label={copy.highlights} count={highlights.length} />
              <p className="max-w-prose text-body text-muted-foreground">
                {catalogCopy.worlds.highlightsLead(entries.length)}
              </p>
            </div>
            <Entries entries={highlights} thumbWidth={1440} columns="wide" />
          </section>
          <section className="flex flex-col gap-6" aria-labelledby="worlds">
            <div className="flex flex-col gap-1">
              <h2 id="worlds" className="scroll-mt-24 text-title">
                {catalogCopy.worlds.title}
              </h2>
              <p className="max-w-prose text-body text-muted-foreground">
                {catalogCopy.worlds.lead}
              </p>
            </div>
            <TemplateWorlds worlds={worlds} />
          </section>
        </div>
      </Band>
    </>
  );
}
