/**
 * Fixture shapes for the chart definitions (ADR 0042 §5, RM-175). A fixture is data only:
 * props, and children named by their component's name, so the same fixture can feed a
 * render, a validation or a catalog example. The test that renders one maps each name to its
 * component.
 */

/** One child of a fixture chart: a part (or other chart child) named by its component. */
export interface FixtureChild {
  readonly component: string;
  readonly props: Readonly<Record<string, unknown>>;
}

/** Minimal valid props for one chart family, and the children it renders. */
export interface ChartFixture {
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly children: readonly FixtureChild[];
}

/**
 * Minimal valid props for one part, and a host chart to render it in. The host's children
 * hold the part itself: the child whose `props` is this fixture's `props` object.
 */
export interface PartFixture {
  readonly id: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly host: ChartFixture;
}
