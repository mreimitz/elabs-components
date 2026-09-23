/**
 * The two listing pages every rail branch has.
 *
 *  - `BranchIndex` — the branch's front page (`/blocks`, `/components/ui`): its highlights, then
 *    a directory of its families. It never draws the whole branch: a live thumbnail is a
 *    Storybook frame, and a hundred of them on one page is what made the catalogue slow.
 *  - `FamilyIndex` — one family (`/components/ui/group/forms`): every page in it.
 *
 * A branch small enough to read at a glance (or with a single family) skips the directory and
 * lists everything, so a visitor never clicks through to a page holding three cards.
 */
import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import {
  familyHref,
  familySlug,
  type CatalogEntry,
  type CatalogSection,
} from "../../lib/catalog-index";
import { grouped } from "../../lib/catalog";
import { chartDetailLinks } from "../../lib/gallery-links";
import { catalogCopy } from "../../content/copy";
import { Band } from "../band";
import { PageBand } from "../page-band";
import type { CategoryArtName } from "../art/category-art";
import { ChartTiles } from "../gallery/gallery-clients";
import { CHART_TILE_META } from "../gallery/chart-tile-meta";
import { EntryGrid, GroupHeading, IndexHeader } from "./entry-grid";
import { StorybookUnreachable } from "./story-availability";
import { familyOrderOf } from "./nav-model";

const copy = catalogCopy.index;

/** A branch at or under this size is listed whole on its front page. */
export const WHOLE_BRANCH_LIMIT = 12;

/** Families of a branch in reading order, each with its entries. */
export function familiesOf(entries: CatalogEntry[], section: CatalogSection, pkg?: string) {
  return grouped(entries, familyOrderOf(section, pkg));
}

/** The family of `entries` whose slug is `slug`, or null. */
export function familyBySlug(entries: CatalogEntry[], slug: string) {
  const label = entries.find((e) => familySlug(e.group) === slug)?.group;
  return label ? { label, entries: entries.filter((e) => e.group === label) } : null;
}

interface GridOptions {
  thumbWidth?: number;
  columns?: "default" | "wide";
}

/**
 * Entries as cards. A chart type the site can draw itself (`chart-tiles.tsx`) is drawn natively
 * — a live SVG in this document, hover and tooltips included — and only the rest fall back to
 * Storybook frames.
 */
export function Entries({
  entries,
  thumbWidth,
  columns,
}: { entries: CatalogEntry[] } & GridOptions) {
  const drawn = new Set(CHART_TILE_META.map((t) => t.component));
  const isChart = (e: CatalogEntry) =>
    e.section === "components" &&
    e.package === "charts" &&
    e.component !== null &&
    drawn.has(e.component);
  const charts = entries.filter(isChart).map((e) => e.component as string);
  const others = entries.filter((e) => !isChart(e));
  return (
    <div className="flex flex-col gap-4">
      {charts.length > 0 ? (
        <ChartTiles components={charts} links={chartDetailLinks(charts)} />
      ) : null}
      {others.length > 0 ? (
        <EntryGrid entries={others} thumbWidth={thumbWidth} columns={columns} />
      ) : null}
    </div>
  );
}

function FamilyDirectory({
  families,
  familyCopy,
}: {
  families: [string, CatalogEntry[]][];
  familyCopy?: Record<string, string>;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {families.map(([family, list]) => (
        <li key={family}>
          <Card className="group relative h-full gap-0 p-0 transition-shadow duration-fast ease-standard hover:shadow-md">
            <CardHeader className="gap-2 p-4">
              <CardTitle className="flex items-baseline justify-between gap-3 text-subtitle">
                <a
                  href={familyHref(list[0] as CatalogEntry)}
                  className="rounded-sm after:absolute after:inset-0 focus-ring"
                >
                  {family}
                </a>
                <span className="text-meta font-normal text-muted-foreground tabular-nums">
                  {copy.count(list.length)}
                </span>
              </CardTitle>
              {familyCopy?.[family] ? (
                <CardDescription className="line-clamp-3">{familyCopy[family]}</CardDescription>
              ) : null}
              <p className="line-clamp-2 text-caption text-muted-foreground">
                {list.map((e) => e.name).join(" · ")}
              </p>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function BranchIndex({
  section,
  pkg,
  title,
  lead,
  art,
  entries,
  familyCopy,
  header,
  thumbWidth,
  columns,
}: {
  section: CatalogSection;
  pkg?: string;
  title: string;
  lead: string;
  art?: CategoryArtName;
  entries: CatalogEntry[];
  /** One line per family, shown in the directory and on the family's own page. */
  familyCopy?: Record<string, string>;
  /** Extra content under the title (a package's install command). */
  header?: ReactNode;
} & GridOptions) {
  const families = familiesOf(entries, section, pkg);
  const whole = entries.length <= WHOLE_BRANCH_LIMIT || families.length === 1;
  const highlights = entries.filter((e) => e.featured > 0).sort((a, b) => a.featured - b.featured);
  return (
    <>
      <PageBand width="6xl" art={art}>
        <IndexHeader title={title} lead={lead} count={entries.length} />
        <StorybookUnreachable />
      </PageBand>
      <Band width="6xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
          {header}
          {whole ? (
            families.map(([family, list]) => (
              <section key={family} className="flex flex-col gap-5">
                {families.length > 1 ? (
                  <GroupHeading id={familySlug(family)} label={family} count={list.length} />
                ) : null}
                <Entries entries={list} thumbWidth={thumbWidth} columns={columns} />
              </section>
            ))
          ) : (
            <>
              <section className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <GroupHeading id="highlights" label={copy.highlights} count={highlights.length} />
                  <p className="max-w-prose text-body text-muted-foreground">
                    {copy.highlightsLead(entries.length)}
                  </p>
                </div>
                <Entries entries={highlights} thumbWidth={thumbWidth} columns={columns} />
              </section>
              <section className="flex flex-col gap-5">
                <GroupHeading id="families" label={copy.families} count={families.length} />
                <FamilyDirectory families={families} familyCopy={familyCopy} />
              </section>
            </>
          )}
        </div>
      </Band>
    </>
  );
}

export function FamilyIndex({
  family,
  lead,
  art,
  entries,
  thumbWidth,
  columns,
}: {
  family: string;
  lead?: string;
  art?: CategoryArtName;
  entries: CatalogEntry[];
} & GridOptions) {
  return (
    <>
      <PageBand width="6xl" art={art}>
        <IndexHeader title={family} lead={lead ?? ""} count={entries.length} />
        <StorybookUnreachable />
      </PageBand>
      <Band width="6xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-10">
          <Entries entries={entries} thumbWidth={thumbWidth} columns={columns} />
        </div>
      </Band>
    </>
  );
}
