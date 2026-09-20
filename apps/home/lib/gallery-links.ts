/**
 * Storybook hrefs for the galleries, resolved on the server from `story-ids.json` so the client
 * bundles never carry the id map. A component without a docs page resolves to `null` and its
 * tile renders the name as plain text — a gallery link never 404s.
 */
import { CATALOG_INDEX, hrefOf } from "./catalog-index";
import { storyIdFor, storyIds } from "./content";

export function storybookDocsHref(component: string): string | null {
  const id = storyIdFor(component);
  return id ? `/storybook/?path=/docs/${id}` : null;
}

export function linksFor(components: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(components.map((name) => [name, storybookDocsHref(name)]));
}

export interface ComponentIndexGroup {
  /** Storybook's own top-level category, read from the docs id's first segment. */
  id: string;
  label: string;
  items: { name: string; href: string }[];
}

const titleCase = (slug: string) =>
  slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Every component with a docs page, grouped by its Storybook category, names sorted. */
export function componentIndex(): ComponentIndexGroup[] {
  const groups = new Map<string, ComponentIndexGroup>();
  for (const [name, id] of Object.entries(storyIds)) {
    const category = id.split("-")[0] ?? "other";
    const group = groups.get(category) ?? { id: category, label: titleCase(category), items: [] };
    group.items.push({ name, href: `/storybook/?path=/docs/${id}` });
    groups.set(category, group);
  }
  return Array.from(groups.values())
    .map((group) => ({ ...group, items: group.items.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => b.items.length - a.items.length);
}

export { titleCase };

/** Detail-page hrefs for chart containers (`/charts/<slug>`), from the catalogue. */
export function chartDetailLinks(components: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(
    components.map((name) => {
      const entry = CATALOG_INDEX.find((e) => e.section === "charts" && e.component === name);
      return [name, entry ? hrefOf(entry) : null];
    }),
  );
}
