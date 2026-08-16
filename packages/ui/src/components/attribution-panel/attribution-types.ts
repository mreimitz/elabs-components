/**
 * The shape of one third-party notice rendered by `AttributionPanel`.
 *
 * Hand-written (the DATA is generated, the type is not) so the generated module
 * type-checks against a real contract and a malformed entry fails `typecheck`
 * rather than rendering blank.
 */

/**
 * What is being credited — also the panel's grouping and render order.
 *
 * - `data`       — content served at runtime (basemap tiles, map data). Usually
 *                  the notices a licence actually OBLIGES us to display.
 * - `source`     — code adapted or vendored into brand-ui (shadcn/ui, mapcn, …).
 * - `font`       — a self-hosted webfont shipped in the tokens package.
 * - `dependency` — an npm runtime dependency of a distributable package.
 */
export type AttributionCategory = "data" | "source" | "font" | "dependency";

export interface Attribution {
  /** Stable key — the npm name, `font:<face>`, or the curated source's id. */
  id: string;
  category: AttributionCategory;
  /** Display name. */
  name: string;
  /** Resolved npm version, when the entry is a package. */
  version: string | null;
  /** SPDX identifier where one exists, else the terms' name. */
  license: string;
  /** The copyright line to display verbatim, when the source provides one. */
  copyright: string | null;
  /** Canonical link (homepage, repository, or licence page). */
  url: string | null;
  /** The `@qlik-coe-emea/qlabs-components-*` packages this reaches a consumer through. */
  usedBy: readonly string[];
  /**
   * True when a licence or provider terms OBLIGE the notice to be displayed
   * (ODbL, the OFL, provider terms) — as opposed to a courtesy credit. Required
   * notices render first and are visually marked.
   */
  required: boolean;
  /** Short human explanation of what it is used for. */
  note: string | null;
}
