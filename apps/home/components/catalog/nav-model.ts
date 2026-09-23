/**
 * The catalogue's navigation tree, derived from the generated index: section → (package →)
 * group → page. Plain data, shared by the sidebar (client) and the index pages (server).
 */
import {
  CATALOG_NAV,
  PACKAGE_FAMILY_ORDER,
  familyHref,
  hrefOf,
  type CatalogNavEntry,
  type CatalogSection,
} from "../../lib/catalog-nav";

/** A page in the rail. Its summary is not here: the rail filter loads the search text on
 *  demand (`loadCatalogIndex`) so the shell's first paint carries only names. */
export interface NavLeaf {
  href: string;
  name: string;
}
export interface NavGroup {
  id: string;
  label: string;
  /** The family's own listing page: every page of the family, nothing else. */
  href: string;
  leaves: NavLeaf[];
}
export interface NavBranch {
  id: string;
  label: string;
  href: string;
  groups: NavGroup[];
  count: number;
}

export const SECTION_ORDER: CatalogSection[] = [
  "templates",
  "blocks",
  "visualizations",
  "components",
];

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
];

/**
 * Visualization families in reading order — one number, the arguments built on numbers, then
 * the desks and sheets that hold them.
 */
export const VISUALIZATION_FAMILY_ORDER = [
  "KPI Cards",
  "Stat Cards",
  "Infographics",
  "Editorial Charts",
  "Command Centers",
  "Dashboard Recipes",
];

/** Block families in reading order: the surfaces of an application, outside in. */
export const BLOCK_FAMILY_ORDER = [
  "App Shells",
  "Application",
  "Maps and Geo",
  "Process and Flow",
  "Data Surfaces",
  "Documents",
  "Agent Ops",
  "Generative UI",
  "AI and Terminal",
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

const leaf = (entry: CatalogNavEntry): NavLeaf => ({
  href: hrefOf(entry),
  name: entry.name,
});

function groupsOf(entries: CatalogNavEntry[], order: readonly string[] = []): NavGroup[] {
  const groups = new Map<string, NavLeaf[]>();
  for (const entry of entries) {
    const list = groups.get(entry.group) ?? [];
    list.push(leaf(entry));
    groups.set(entry.group, list);
  }
  const sample = (label: string) => entries.find((e) => e.group === label) as CatalogNavEntry;
  return Array.from(groups.entries())
    .sort((a, b) => byOrder(order)(a[0], b[0]))
    .map(([label, leaves]) => ({ id: label, label, href: familyHref(sample(label)), leaves }));
}

/** The reading order of a branch's families. */
export function familyOrderOf(section: CatalogSection, pkg?: string): readonly string[] {
  if (section === "blocks") return BLOCK_FAMILY_ORDER;
  if (section === "visualizations") return VISUALIZATION_FAMILY_ORDER;
  if (section === "templates") return TEMPLATE_FAMILY_ORDER;
  return PACKAGE_FAMILY_ORDER[pkg ?? ""] ?? [];
}

/** One branch per section, except Components, which branches per package. */
export function buildNav(sectionLabels: Record<CatalogSection, string>): NavBranch[] {
  const branches: NavBranch[] = [];
  for (const section of SECTION_ORDER) {
    const entries = CATALOG_NAV.filter((e) => e.section === section);
    if (section !== "components") {
      branches.push({
        id: section,
        label: sectionLabels[section],
        href: `/${section}`,
        groups: groupsOf(entries, familyOrderOf(section)),
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
        groups: groupsOf(own, familyOrderOf("components", pkg)),
        count: own.length,
      });
    }
  }
  return branches;
}
