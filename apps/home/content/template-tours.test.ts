// RM-153 — every template belongs to a world. The templates index groups by domain and the home
// page's domain row counts them, so a template that resolves to no domain would silently drop
// off both. The catalogue is the generated one, never a typed list.
import { describe, expect, it } from "vitest";
import catalogIndex from "./generated/catalog-index.json";
import {
  TEMPLATE_DOMAINS,
  TEMPLATE_DOMAIN_LEADS,
  TEMPLATE_DOMAIN_ORDER,
  TEMPLATE_TOURS,
  templateDomainOf,
} from "./template-tours";

const templates = (catalogIndex as { section: string; slug: string; group: string }[]).filter(
  (entry) => entry.section === "templates",
);

describe("template domains", () => {
  it("resolves a domain for every template in the catalogue", () => {
    const missing = templates.filter((t) => templateDomainOf(t.slug, t.group) === undefined);
    expect(missing.map((t) => t.slug)).toEqual([]);
  });

  it("names every tour's template in the catalogue", () => {
    const slugs = new Set(templates.map((t) => t.slug));
    expect(Object.keys(TEMPLATE_TOURS).filter((slug) => !slugs.has(slug))).toEqual([]);
  });

  it("labels and leads every domain, starters last", () => {
    for (const domain of TEMPLATE_DOMAIN_ORDER) {
      expect(TEMPLATE_DOMAINS[domain]).toBeTruthy();
      expect(TEMPLATE_DOMAIN_LEADS[domain]).toBeTruthy();
    }
    expect(TEMPLATE_DOMAIN_ORDER.at(-1)).toBe("starters");
  });

  it("gives every business domain at least one template", () => {
    const counts = new Map<string, number>();
    for (const t of templates) {
      const domain = templateDomainOf(t.slug, t.group);
      if (domain) counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
    for (const domain of TEMPLATE_DOMAIN_ORDER)
      expect(counts.get(domain), domain).toBeGreaterThan(0);
  });
});
