import type { Metadata } from "next";
import { EntryGrid, GroupHeading, IndexHeader } from "../../../components/catalog/entry-grid";
import { ChartGroup } from "../../../components/gallery/gallery-clients";
import {
  CHART_GROUP_IDS,
  CHART_TILE_COMPONENTS,
  CHART_TILE_META,
} from "../../../components/gallery/chart-tile-meta";
import { entriesOf } from "../../../lib/catalog";
import { chartDetailLinks } from "../../../lib/gallery-links";
import { catalogCopy } from "../../../content/copy";
import { PageBand } from "../../../components/page-band";
import { Band } from "../../../components/band";

const copy = catalogCopy.charts;

export const metadata: Metadata = {
  title: catalogCopy.sections.charts,
  description: catalogCopy.sectionLead.charts,
  alternates: { canonical: "/charts" },
};

// The chooser: chart types grouped by the question a reader is asking, each drawn live and
// linked to its own page. The parts charts are composed from follow as a second index.
export default function ChartsPage() {
  const all = entriesOf("charts");
  const links = chartDetailLinks(CHART_TILE_COMPONENTS);
  const typed = new Set(CHART_TILE_COMPONENTS);
  const parts = all.filter((e) => !e.component || !typed.has(e.component));
  return (
    <>
      <PageBand width="6xl">
        <IndexHeader
          title={copy.chooser}
          lead={`${catalogCopy.sectionLead.charts} ${copy.chooserLead}`}
          count={all.length}
        />
      </PageBand>
      <Band width="6xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-6 py-10">
          {CHART_GROUP_IDS.map((group) => (
            <section key={group} className="flex flex-col gap-5">
              <GroupHeading
                id={group}
                label={copy.questions[group]}
                count={CHART_TILE_META.filter((t) => t.group === group).length}
              />
              <ChartGroup group={group} links={links} />
            </section>
          ))}
          <section className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <GroupHeading id="parts" label={copy.building} count={parts.length} />
              <p className="max-w-prose text-body text-muted-foreground">{copy.buildingLead}</p>
            </div>
            <EntryGrid entries={parts} />
          </section>
        </div>
      </Band>
    </>
  );
}
