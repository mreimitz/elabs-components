/**
 * The catalogue's navigation tree, derived from the generated index: section → (package →)
 * group → page. Plain data, shared by the sidebar (client) and the index pages (server).
 */
import {
  CATALOG_INDEX,
  hrefOf,
  type CatalogEntry,
  type CatalogSection,
} from "../../lib/catalog-index";

export interface NavLeaf {
  href: string;
  name: string;
  summary: string;
}
export interface NavGroup {
  id: string;
  label: string;
  leaves: NavLeaf[];
}
export interface NavBranch {
  id: string;
  label: string;
  href: string;
  groups: NavGroup[];
  count: number;
}

export const SECTION_ORDER: CatalogSection[] = ["templates", "blocks", "charts", "components"];

/** Package order in the sidebar: app UI first, then the surfaces built on it. */
export const PACKAGE_ORDER = [
  "ui",
  "data",
  "charts",
  "ai",
  "flow",
  "maps",
  "editor",
  "viewer",
  "terminal",
  "process",
  "marketing",
  "icons",
  "tokens",
  "patterns",
];

/**
 * Block families in reading order — numbers, the arguments built on them, then the surfaces
 * they sit in. Mirrors the `Patterns/Blocks` order in Storybook's `storySort`.
 */
export const BLOCK_FAMILY_ORDER = [
  "KPI Cards",
  "Stat Cards",
  "Infographics",
  "Editorial Charts",
  "Command Centers",
  "Maps and Geo",
  "Process and Flow",
  "Data Surfaces",
  "Agent Ops",
  "AI and Terminal",
  "Application",
  "Forms and Setup",
  "Authentication",
  "Account and Settings",
  "Commerce",
  "Marketing",
];

/** Template families: use-case templates by who builds them, then the archetype starters. */
export const TEMPLATE_FAMILY_ORDER = [
  "Analytics",
  "Operations",
  "Customers",
  "Product Teams",
  "AI Products",
  "Starters",
];

/** Sort by a known reading order first, alphabetically after it. */
export const byOrder = (order: readonly string[]) => (a: string, b: string) =>
  (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b);

const leaf = (entry: CatalogEntry): NavLeaf => ({
  href: hrefOf(entry),
  name: entry.name,
  summary: entry.summary,
});

function groupsOf(entries: CatalogEntry[], order: readonly string[] = []): NavGroup[] {
  const groups = new Map<string, NavLeaf[]>();
  for (const entry of entries) {
    const list = groups.get(entry.group) ?? [];
    list.push(leaf(entry));
    groups.set(entry.group, list);
  }
  return Array.from(groups.entries())
    .sort((a, b) => byOrder(order)(a[0], b[0]))
    .map(([label, leaves]) => ({ id: label, label, leaves }));
}

/** One branch per section, except Components, which branches per package. */
export function buildNav(sectionLabels: Record<CatalogSection, string>): NavBranch[] {
  const branches: NavBranch[] = [];
  for (const section of SECTION_ORDER) {
    const entries = CATALOG_INDEX.filter((e) => e.section === section);
    if (section !== "components") {
      branches.push({
        id: section,
        label: sectionLabels[section],
        href: `/${section}`,
        groups: groupsOf(
          entries,
          section === "blocks"
            ? BLOCK_FAMILY_ORDER
            : section === "templates"
              ? TEMPLATE_FAMILY_ORDER
              : [],
        ),
        count: entries.length,
      });
      continue;
    }
    const packages = Array.from(new Set(entries.map((e) => e.package))).sort(
      (a, b) =>
        (PACKAGE_ORDER.indexOf(a) + 1 || 99) - (PACKAGE_ORDER.indexOf(b) + 1 || 99) ||
        a.localeCompare(b),
    );
    for (const pkg of packages) {
      const own = entries.filter((e) => e.package === pkg);
      branches.push({
        id: `components/${pkg}`,
        label: pkg,
        href: `/components/${pkg}`,
        groups: groupsOf(own),
        count: own.length,
      });
    }
  }
  return branches;
}
