/**
 * DG-24 — the catalog page (`#catalog`, `#catalog/<vendor>`): vendor filter, search, and a
 * grid of every entry (icons and parts) with its product name and one-liner. Each tile links
 * to the entry page. Reads `useCatalog()`; writes nothing.
 */
import { useMemo, useState } from "react";
import { Badge, Button, Card, Heading, Input, StatePanel, Text } from "@elabs-ai/components-ui";
import { ArchMark } from "../nodes/arch-mark";
import { toHash } from "../routes/use-hash";
import { LUCIDE_VENDOR, useCatalog, type CatalogEntry } from "./catalog-service";

export const CATALOG_LABELS = {
  heading: "Catalog",
  intro: (entries: number, vendors: number) =>
    `${entries} icons and parts from ${vendors} vendors. Open one to see what it is and copy its YAML.`,
  loading: "Loading the catalog…",
  all: "All",
  vendorFilter: "Vendor",
  search: "Search the catalog",
  searchPlaceholder: "Search by product, alias or tag…",
  none: "Nothing matches.",
  noneHint: "Try another word, or All vendors.",
  noDescription: "No description yet",
  part: "Part",
  grid: (vendor: string) => `Catalog entries: ${vendor}`,
  problems: (n: number) =>
    `${n} catalog ${n === 1 ? "entry was" : "entries were"} skipped (see the dev server's /api/catalog/all).`,
} as const;

export interface CatalogViewProps {
  vendor?: string;
}

function matches(e: CatalogEntry, needle: string): boolean {
  if (needle === "") return true;
  return [e.name, e.label, ...e.aliases, ...e.tags].join(" ").toLowerCase().includes(needle);
}

export function CatalogView({ vendor }: CatalogViewProps) {
  const { entries, loaded, problems } = useCatalog();
  const [query, setQuery] = useState("");

  // Generic `lucide/*` glyphs stay in the icon sheet (`#dev/icons`); the catalog is products.
  const all = useMemo(
    () => [...entries.values()].filter((e) => e.vendor !== LUCIDE_VENDOR),
    [entries],
  );
  const vendors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of all) counts.set(e.vendor, (counts.get(e.vendor) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [all]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((e) => (vendor === undefined || e.vendor === vendor) && matches(e, needle))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [all, vendor, query]);

  if (!loaded) {
    return <StatePanel kind="loading" title={CATALOG_LABELS.loading} className="flex-1" />;
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6"
      data-slot="catalog-view"
    >
      <header className="flex flex-col gap-1">
        <Heading level={2} size="title">
          {CATALOG_LABELS.heading}
        </Heading>
        <Text variant="caption" tone="muted">
          {CATALOG_LABELS.intro(all.length, vendors.length)}
        </Text>
        {problems.length > 0 ? (
          <Text variant="caption" tone="muted">
            {CATALOG_LABELS.problems(problems.length)}
          </Text>
        ) : null}
      </header>

      <div className="flex flex-col gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={CATALOG_LABELS.search}
          placeholder={CATALOG_LABELS.searchPlaceholder}
          className="max-w-md"
        />
        {/* Links, not toggles: the vendor lives in the route, so Back and bookmarks work. */}
        <nav className="flex flex-wrap gap-2" aria-label={CATALOG_LABELS.vendorFilter}>
          <Button asChild size="sm" variant={vendor === undefined ? "default" : "outline"}>
            <a
              href={toHash({ kind: "catalog" })}
              aria-current={vendor === undefined ? "page" : undefined}
            >
              {CATALOG_LABELS.all}
            </a>
          </Button>
          {vendors.map(([v, count]) => (
            <Button key={v} asChild size="sm" variant={vendor === v ? "default" : "outline"}>
              <a
                href={toHash({ kind: "catalog", vendor: v })}
                aria-current={vendor === v ? "page" : undefined}
              >
                {v}
                <Badge variant="outline" className="ms-2 border-current tabular-nums text-current">
                  {count}
                </Badge>
              </a>
            </Button>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <StatePanel
          kind="empty"
          title={CATALOG_LABELS.none}
          description={CATALOG_LABELS.noneHint}
        />
      ) : (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3"
          aria-label={CATALOG_LABELS.grid(vendor ?? CATALOG_LABELS.all)}
        >
          {shown.map((e) => (
            <li key={e.name} className="min-w-0">
              <a
                href={toHash({ kind: "catalog", vendor: e.vendor, entry: e.slug })}
                className="focus-ring block h-full rounded-lg"
              >
                <Card className="flex h-full items-start gap-3 p-3 hover:bg-muted">
                  <ArchMark icon={e.icon} size={32} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Text as="span" variant="body" className="truncate font-medium">
                      {e.label}
                    </Text>
                    <Text as="span" variant="caption" tone="muted" className="line-clamp-2">
                      {e.description ?? CATALOG_LABELS.noDescription}
                    </Text>
                    {e.part ? (
                      <Badge variant="secondary" className="mt-1 self-start">
                        {CATALOG_LABELS.part}
                      </Badge>
                    ) : null}
                  </span>
                </Card>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
