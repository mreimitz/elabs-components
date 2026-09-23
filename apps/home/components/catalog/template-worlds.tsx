/**
 * "Pick your world" (RM-153) — the templates by domain. `DomainRow` is the strip of domains, each
 * a link to that world's anchor (on `/` it points at `/templates#<domain>`, on `/templates` at
 * the section below); `TemplateWorlds` is the sections themselves: one heading per domain (its
 * id is the anchor), the domain's lead, and a compact card per template — name, pitch and the
 * views its navigation names. No live thumbnail here: the highlights above carry the frames, and
 * a front page never draws its whole branch (`.claude/rules/home.md`). Server components.
 */
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@elabs-ai/components-ui";
import { hrefOf, type CatalogEntry } from "../../lib/catalog-index";
import { domainAnchor, type TemplateWorld } from "../../lib/template-entries";
import { catalogCopy } from "../../content/copy";
import { tourOf } from "../../content/template-tours";
import { GroupHeading } from "./entry-grid";

const copy = catalogCopy.worlds;
const VIEWS_SHOWN = 4;

export function DomainRow({
  worlds,
  base = "",
  className,
}: {
  worlds: TemplateWorld[];
  /** The page the anchors live on: `""` here, `"/templates"` from the home page. */
  base?: string;
  className?: string;
}) {
  return (
    <nav aria-label={copy.jump} className={className} data-slot="domain-row">
      <ul className="flex flex-wrap gap-2">
        {worlds.map((world) => (
          <li key={world.domain}>
            <a
              href={`${base}#${domainAnchor(world.domain)}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-body text-foreground transition-colors duration-fast ease-standard hover:bg-accent focus-ring"
            >
              <span className="font-medium">{world.label}</span>
              <span className="text-meta text-muted-foreground tabular-nums">
                {world.entries.length}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function WorldCard({ entry }: { entry: CatalogEntry }) {
  const tour = tourOf(entry.slug);
  const views = tour?.views ?? [];
  const shown = views.slice(0, VIEWS_SHOWN);
  const rest = views.length - shown.length;
  return (
    <Card
      data-slot="world-card"
      className="group relative h-full gap-0 p-0 transition-shadow duration-fast ease-standard hover:shadow-md"
    >
      <CardHeader className="gap-2 p-4">
        {entry.question ? (
          <p className="text-caption font-medium text-muted-foreground">{entry.question}</p>
        ) : null}
        <CardTitle className="text-subtitle">
          <a href={hrefOf(entry)} className="rounded-sm after:absolute after:inset-0 focus-ring">
            {entry.name}
          </a>
        </CardTitle>
        {entry.summary ? (
          <CardDescription className="line-clamp-3">{entry.summary}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {shown.length > 0 ? (
          <dl className="flex flex-wrap items-center gap-1.5">
            <dt className="sr-only">{copy.views}</dt>
            {shown.map((view) => (
              <dd key={view.label}>
                <Badge variant="outline">{view.label}</Badge>
              </dd>
            ))}
            {rest > 0 ? (
              <dd className="text-meta text-muted-foreground tabular-nums">
                {copy.moreViews(rest)}
              </dd>
            ) : null}
          </dl>
        ) : (
          <p className="text-caption text-muted-foreground">
            {entry.group === "Starters" ? copy.starter : catalogCopy.index.examples(entry.stories)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TemplateWorlds({ worlds }: { worlds: TemplateWorld[] }) {
  return (
    <div className="flex flex-col gap-12" data-slot="template-worlds">
      {worlds.map((world) => (
        <section
          key={world.domain}
          aria-labelledby={domainAnchor(world.domain)}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1">
            {/* The heading carries the anchor; `aria-labelledby` names the section by it. */}
            <GroupHeading
              id={domainAnchor(world.domain)}
              label={world.label}
              count={world.entries.length}
            />
            <p className="max-w-prose text-body text-muted-foreground">{world.lead}</p>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {world.entries.map((entry) => (
              <li key={entry.slug}>
                <WorldCard entry={entry} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
