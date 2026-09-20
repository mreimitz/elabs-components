"use client";
/**
 * SiteSearch — ⌘K over the whole catalogue, from the library's own search parts: the
 * `CommandTrigger` in the nav, a `CommandDialog` with grouped results, and `MatchHighlight`
 * marking the query inside each name. cmdk does the filtering; each item's `value` carries the
 * name, the package, the group and the purpose, so "date range" or "rank over time" finds a page
 * whose name says neither.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Blocks, Component, LayoutTemplate, type LucideIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandTrigger,
  MatchHighlight,
} from "@elabs-ai/components-ui";
import { CATALOG_INDEX, hrefOf, type CatalogSection } from "../../lib/catalog-index";
import { catalogCopy, galleryCopy } from "../../content/copy";
import { CHART_TILE_META } from "../gallery/chart-tile-meta";

const copy = catalogCopy.search;

const SECTIONS: { id: CatalogSection; icon: LucideIcon }[] = [
  { id: "templates", icon: LayoutTemplate },
  { id: "blocks", icon: Blocks },
  { id: "charts", icon: BarChart3 },
  { id: "components", icon: Component },
];

/** Chart types are searched by the question they answer too ("rank over time" → BumpChart). */
const CHART_KEYWORDS = new Map<string, string>();
for (const tile of CHART_TILE_META) {
  const words = `${galleryCopy.charts.tiles[tile.id].shape} ${catalogCopy.charts.questions[tile.group]}`;
  CHART_KEYWORDS.set(tile.component, `${CHART_KEYWORDS.get(tile.component) ?? ""} ${words}`);
}

const PAGES = [
  { href: "/", label: copy.pages.home },
  { href: "/agents", label: copy.pages.agents },
  { href: "/#themes", label: copy.pages.themes },
  { href: "/storybook/", label: copy.pages.storybook },
];

export function SiteSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // `CommandTrigger` reads the platform at render when `shortcut` is omitted, which the server
  // cannot know; render the server's value first and correct it after mount (its own docs' advice
  // for SSR consumers), so a Mac visitor gets ⌘ K without a hydration mismatch.
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    const platform =
      (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform ??
      "";
    if (/mac|iphone|ipad/i.test(platform)) setShortcut("⌘ K");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        entries: CATALOG_INDEX.filter((entry) => entry.section === section.id),
      })),
    [],
  );

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    if (href.startsWith("/storybook")) window.location.assign(href);
    else router.push(href);
  };

  return (
    <>
      <CommandTrigger
        label={copy.trigger}
        shortcut={shortcut}
        className={className}
        onClick={() => setOpen(true)}
      />
      <CommandDialog open={open} onOpenChange={setOpen} title={copy.title}>
        <CommandInput placeholder={copy.placeholder} value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{copy.empty}</CommandEmpty>
          {groups.map(({ id, icon: Icon, entries }) => (
            <CommandGroup key={id} heading={catalogCopy.sections[id]}>
              {entries.map((entry) => (
                <CommandItem
                  key={`${entry.section}/${entry.package}/${entry.slug}`}
                  value={`${entry.name} ${entry.package} ${entry.group} ${entry.question} ${entry.summary} ${
                    entry.section === "charts"
                      ? (CHART_KEYWORDS.get(entry.component ?? "") ?? "")
                      : ""
                  }`}
                  onSelect={() => go(hrefOf(entry))}
                >
                  <Icon aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <MatchHighlight text={entry.name} query={query.trim() || undefined} />
                    {entry.question || entry.summary ? (
                      <span className="truncate text-meta text-muted-foreground">
                        {entry.question || entry.summary}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-meta text-muted-foreground">
                    {id === "components" ? entry.package : entry.group}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandGroup heading={copy.goTo}>
            {PAGES.map((page) => (
              <CommandItem key={page.href} value={page.label} onSelect={() => go(page.href)}>
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
