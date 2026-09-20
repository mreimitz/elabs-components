import type { Metadata } from "next";
import { Button } from "@elabs-ai/components-ui";
import { EntryGrid, GroupHeading, IndexHeader } from "../../../components/catalog/entry-grid";
import { PACKAGE_ORDER } from "../../../components/catalog/nav-model";
import { entriesOf } from "../../../lib/catalog";
import { packages } from "../../../lib/content";
import { catalogCopy, galleryCopy } from "../../../content/copy";

export const metadata: Metadata = {
  title: catalogCopy.sections.components,
  description: catalogCopy.sectionLead.components,
  alternates: { canonical: "/components" },
};

const PREVIEW = 6;

export default function ComponentsPage() {
  const all = entriesOf("components");
  const names = Array.from(new Set(all.map((e) => e.package))).sort(
    (a, b) => (PACKAGE_ORDER.indexOf(a) + 1 || 99) - (PACKAGE_ORDER.indexOf(b) + 1 || 99),
  );
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-10">
      <IndexHeader
        title={catalogCopy.sections.components}
        lead={catalogCopy.sectionLead.components}
        count={all.length}
      />
      {names.map((name) => {
        const entries = all.filter((e) => e.package === name);
        const pkg = packages.find((p) => p.shortName === name);
        return (
          <section key={name} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <GroupHeading id={name} label={pkg?.name ?? name} count={entries.length} />
                {pkg ? (
                  <p className="max-w-prose text-body text-muted-foreground">
                    {pkg.description}{" "}
                    <span className="tabular-nums">
                      {galleryCopy.components.exports(pkg.exportCount)}.
                    </span>
                  </p>
                ) : null}
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`/components/${name}`}>{catalogCopy.index.allIn(name)}</a>
              </Button>
            </div>
            <EntryGrid entries={entries.slice(0, PREVIEW)} />
          </section>
        );
      })}
    </div>
  );
}
