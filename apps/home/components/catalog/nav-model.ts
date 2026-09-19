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

const leaf = (entry: CatalogEntry): NavLeaf => ({
  href: hrefOf(entry),
  name: entry.name,
  summary: entry.summary,
});

function groupsOf(entries: CatalogEntry[]): NavGroup[] {
  const groups = new Map<string, NavLeaf[]>();
  for (const entry of entries) {
    const list = groups.get(entry.group) ?? [];
    list.push(leaf(entry));
    groups.set(entry.group, list);
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
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
        groups: groupsOf(entries),
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
