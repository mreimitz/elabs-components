import type { Metadata } from "next";
import { Badge } from "@elabs-ai/components-ui";
import { EntryGrid, GroupHeading, IndexHeader } from "../../../components/catalog/entry-grid";
import { BLOCK_FAMILY_ORDER } from "../../../components/catalog/nav-model";
import { entriesOf, grouped } from "../../../lib/catalog";
import { blockFamilyCopy, catalogCopy } from "../../../content/copy";
import { PageBand } from "../../../components/page-band";
import { Band } from "../../../components/band";

export const metadata: Metadata = {
  title: catalogCopy.sections.blocks,
  description: catalogCopy.sectionLead.blocks,
  alternates: { canonical: "/blocks" },
};

const anchorOf = (family: string) => family.toLowerCase().replace(/\s+/g, "-");

export default function BlocksPage() {
  const all = entriesOf("blocks");
  const families = grouped(all, BLOCK_FAMILY_ORDER);
  return (
    <>
      <PageBand width="6xl">
        <div className="flex flex-col gap-6">
          <IndexHeader
            title={catalogCopy.sections.blocks}
            lead={catalogCopy.sectionLead.blocks}
            count={all.length}
          />
          <nav aria-label={catalogCopy.sections.blocks}>
            <ul className="flex flex-wrap gap-2">
              {families.map(([family, list]) => (
                <li key={family}>
                  <a
                    href={`#${anchorOf(family)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-meta font-medium text-card-foreground hover:bg-accent focus-ring"
                  >
                    {family}
                    <Badge variant="secondary">{list.length}</Badge>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </PageBand>
      <Band width="6xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-10">
          {families.map(([family, list]) => (
            <section key={family} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <GroupHeading id={anchorOf(family)} label={family} count={list.length} />
                {blockFamilyCopy[family] ? (
                  <p className="max-w-prose text-body text-muted-foreground">
                    {blockFamilyCopy[family]}
                  </p>
                ) : null}
              </div>
              <EntryGrid entries={list} thumbWidth={960} />
            </section>
          ))}
        </div>
      </Band>
    </>
  );
}
