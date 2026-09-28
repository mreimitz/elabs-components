/**
 * DG-24 — the catalog entry shape, split out of catalog-service.ts (DG-26 1b.3) so the
 * bundled-catalog merge (catalog-merge.ts) and the live service can both import it without a
 * cycle. React-free.
 */
import type { ArchNodeType } from "../spec/dialect";

export interface CatalogPart {
  subtitle?: string;
  badges?: string[];
}

export interface CatalogEntry {
  /** "aws/lambda" (an icon) or "qlik/data-gateway-direct" (a part). */
  name: string;
  vendor: string;
  slug: string;
  /** Display name: the catalog's `name`, else the index label. */
  label: string;
  capability?: string;
  description?: string;
  docs?: string;
  /** The YAML `type:` a node of this entry defaults to (the dialect's own union). */
  kind?: ArchNodeType;
  tags: string[];
  aliases: string[];
  /** Set on a part: a preset node drawn with `icon`. */
  part?: CatalogPart;
  /** The icon name the entry draws with: `name` itself, or a part's `icon:`. */
  icon: string;
  /** false until the maintainer checks it (in the YAML); the MCP fill never overwrites true. */
  curated: boolean;
  /** Product without its own shipped icon; icon holds its resolved drawable fallback. */
  generic?: true;
  /** The server could not reach `docs` when it was written. */
  docsUnverified?: boolean;
  /** From index.json (icons only). */
  iconPath?: string;
}
