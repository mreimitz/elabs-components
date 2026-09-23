import { entriesOf } from "./catalog";
import type { CatalogEntry } from "./catalog-index";
import { templatePitch, tourCopy } from "../content/copy";
import {
  TEMPLATE_DOMAINS,
  TEMPLATE_DOMAIN_LEADS,
  TEMPLATE_DOMAIN_ORDER,
  templateDomainOf,
  type TemplateDomain,
} from "../content/template-tours";

/**
 * Template entries as their cards read: what you would build with the template — its one-line
 * pitch, or for a starter the tour's use case. The generated summary (the wiring) is on the
 * template's own page.
 */
export function templateEntries(): CatalogEntry[] {
  const useCases = tourCopy.tabs as Record<string, { useCase: string } | undefined>;
  return entriesOf("templates").map((entry) => ({
    ...entry,
    summary: templatePitch[entry.slug] || useCases[entry.slug]?.useCase || entry.summary || "",
  }));
}

export interface TemplateWorld {
  domain: TemplateDomain;
  label: string;
  lead: string;
  entries: CatalogEntry[];
}

/** The anchor a domain answers to on `/templates` (`/templates#agents`). */
export const domainAnchor = (domain: TemplateDomain) => domain;

/**
 * The templates by world (RM-153), in `TEMPLATE_DOMAIN_ORDER`, empty worlds left out. Within a
 * world the featured templates lead, in their featured order, then the rest by name.
 */
export function templateWorlds(entries: CatalogEntry[] = templateEntries()): TemplateWorld[] {
  const byDomain = new Map<TemplateDomain, CatalogEntry[]>();
  for (const entry of entries) {
    const domain = templateDomainOf(entry.slug, entry.group);
    if (!domain) continue;
    const list = byDomain.get(domain) ?? [];
    list.push(entry);
    byDomain.set(domain, list);
  }
  const rank = (e: CatalogEntry) => (e.featured > 0 ? e.featured : Number.MAX_SAFE_INTEGER);
  return TEMPLATE_DOMAIN_ORDER.flatMap((domain) => {
    const list = byDomain.get(domain);
    if (!list?.length) return [];
    list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    return [
      {
        domain,
        label: TEMPLATE_DOMAINS[domain],
        lead: TEMPLATE_DOMAIN_LEADS[domain],
        entries: list,
      },
    ];
  });
}
