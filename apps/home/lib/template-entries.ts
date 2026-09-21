import { entriesOf } from "./catalog";
import type { CatalogEntry } from "./catalog-index";
import { templatePitch, tourCopy } from "../content/copy";

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
