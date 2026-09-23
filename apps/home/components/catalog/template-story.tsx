/**
 * TemplateStory — what a template page says under its live screen, in the order a visitor
 * asks: how do I get it (the hand-off, above the fold) → what does each view show (the tour)
 * → what is it made of (the blocks and packages, GENERATED from the registry item's own
 * dependencies, each linking to its page). Server component; the authored prose comes from
 * `content/template-tours.ts`, everything else from the generated catalogue.
 */
import type { ReactNode } from "react";
import { ArrowUpRight, MousePointerClick } from "lucide-react";
import { CATALOG_INDEX, type CatalogEntry } from "../../lib/catalog-index";
import type { CatalogPage } from "../../lib/catalog";
import { catalogCopy, shellCopy } from "../../content/copy";
import type { TemplateTour } from "../../content/template-tours";
import { EntryCard } from "./entry-grid";

const copy = catalogCopy.template;
const PKG_PREFIX = "@elabs-ai/components-";

/** The catalogue entry a registry item renders as, or null for a frame-only item. */
export const entryForBlock = (name: string): CatalogEntry | null =>
  CATALOG_INDEX.find((e) => e.block === name) ?? null;

/** A template's parts, resolved once for the page, the prompt and the text route. */
export function templateParts(page: Pick<CatalogPage, "block">) {
  const registry = page.block?.registryDependencies ?? [];
  const blocks = registry.map((name) => ({ name, entry: entryForBlock(name) }));
  const packages = (page.block?.dependencies ?? [])
    .filter((dep) => dep.startsWith(PKG_PREFIX))
    .map((dep) => ({ name: dep, short: dep.slice(PKG_PREFIX.length) }));
  return { blocks, packages };
}

export function TemplateStory({
  page,
  tour,
  handoff,
}: {
  page: CatalogPage;
  tour: TemplateTour | undefined;
  /** The command and the prompt — rendered first, so they sit above the fold. */
  handoff: ReactNode | null;
}) {
  const { blocks, packages } = templateParts(page);
  const repoBlock = (name: string) => `${shellCopy.links.github}/tree/main/registry/blocks/${name}`;
  return (
    <div className="flex flex-col gap-12" data-slot="template-story">
      {handoff ? (
        <section aria-labelledby="handoff" className="flex flex-col gap-4">
          <h2 id="handoff" className="scroll-mt-24 text-title">
            {copy.handoff}
          </h2>
          {handoff}
        </section>
      ) : null}

      {tour ? (
        <section aria-labelledby="views" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="views" className="scroll-mt-24 text-title">
              {copy.views}
            </h2>
            <p className="max-w-prose text-body text-muted-foreground">{copy.viewsLead}</p>
          </div>
          <dl className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {tour.views.map((view) => (
              <div key={view.label} className="flex flex-col gap-0.5 border-s-2 border-border ps-3">
                <dt className="text-body font-semibold">{view.label}</dt>
                <dd className="text-body text-muted-foreground">{view.shows}</dd>
              </div>
            ))}
          </dl>
          <p className="flex max-w-prose gap-2 rounded-md bg-surface-muted p-4 text-body">
            <MousePointerClick aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="font-semibold">{copy.interaction} </span>
              {tour.interaction}
            </span>
          </p>
        </section>
      ) : null}

      {blocks.length > 0 || packages.length > 0 ? (
        <section aria-labelledby="made-of" className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 id="made-of" className="scroll-mt-24 text-title">
              {copy.madeOf}
            </h2>
            <p className="max-w-prose text-body text-muted-foreground">{copy.madeOfLead}</p>
          </div>
          {blocks.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-subtitle font-semibold">{copy.blocks(blocks.length)}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {blocks.map(({ name, entry }) =>
                  entry ? (
                    <EntryCard key={name} entry={entry} thumbWidth={1180} ratio={0.5} />
                  ) : (
                    <a
                      key={name}
                      href={repoBlock(name)}
                      className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-5 focus-ring transition-shadow duration-fast ease-standard hover:shadow-md"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-code font-medium">{name}</span>
                        <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" />
                      </span>
                      <span className="text-caption text-muted-foreground">{copy.frameItem}</span>
                    </a>
                  ),
                )}
              </div>
            </div>
          ) : null}
          {packages.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-subtitle font-semibold">{copy.packages(packages.length)}</h3>
              <ul className="flex flex-wrap gap-2">
                {packages.map((pkg) => (
                  <li key={pkg.name}>
                    <a
                      href={`/components/${pkg.short}`}
                      className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-code text-foreground focus-ring hover:bg-accent"
                    >
                      {pkg.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
