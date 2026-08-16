import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AttributionPanel } from "./attribution-panel";
import type { Attribution } from "./attribution-types";

afterEach(cleanup);

const fixture: Attribution[] = [
  {
    id: "openstreetmap",
    category: "data",
    name: "OpenStreetMap",
    version: null,
    license: "ODbL-1.0",
    copyright: "© OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    usedBy: ["@qlik-coe-emea/qlabs-components-maps"],
    required: true,
    note: "Map data behind the default basemap.",
  },
  {
    id: "clsx",
    category: "dependency",
    name: "clsx",
    version: "2.1.1",
    license: "MIT",
    copyright: "Luke Edwards",
    url: "https://github.com/lukeed/clsx",
    usedBy: ["@qlik-coe-emea/qlabs-components-ui"],
    required: false,
    note: null,
  },
];

describe("AttributionPanel", () => {
  it("renders each attribution with its licence and copyright", () => {
    render(<AttributionPanel attributions={fixture} />);
    expect(screen.getByText("OpenStreetMap")).toBeInTheDocument();
    expect(screen.getByText("© OpenStreetMap contributors")).toBeInTheDocument();
    expect(screen.getByText("ODbL-1.0")).toBeInTheDocument();
    expect(screen.getByText("clsx")).toBeInTheDocument();
  });

  // The obligation this component exists to meet: a required notice must be
  // distinguishable by TEXT, not by colour alone (WCAG 1.4.1) — asserting the
  // word means a future restyle can't reduce it to a coloured dot.
  it("marks a licence-required notice with a word, not only a colour", () => {
    render(<AttributionPanel attributions={fixture} />);
    const osm = screen.getByText("OpenStreetMap").closest("li")!;
    expect(within(osm).getByText("Required")).toBeInTheDocument();
    const clsx = screen.getByText("clsx").closest("li")!;
    expect(within(clsx).queryByText("Required")).not.toBeInTheDocument();
  });

  it("groups by category under a heading", () => {
    render(<AttributionPanel attributions={fixture} />);
    expect(screen.getByRole("heading", { name: "Map data & tiles" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open-source dependencies" })).toBeInTheDocument();
  });

  it("filters to the licence-required notices with requiredOnly", () => {
    render(<AttributionPanel attributions={fixture} requiredOnly />);
    expect(screen.getByText("OpenStreetMap")).toBeInTheDocument();
    expect(screen.queryByText("clsx")).not.toBeInTheDocument();
  });

  it("filters by consuming package so an app credits only what it ships", () => {
    render(
      <AttributionPanel attributions={fixture} packages={["@qlik-coe-emea/qlabs-components-ui"]} />,
    );
    expect(screen.getByText("clsx")).toBeInTheDocument();
    expect(screen.queryByText("OpenStreetMap")).not.toBeInTheDocument();
  });

  // Two panels share a page in Storybook autodocs (every story renders together)
  // and in any app that mounts a scoped panel beside a full one. Heading ids must
  // stay unique or aria-labelledby points at the wrong node and axe flags it.
  it("scopes section heading ids per instance", () => {
    const { container } = render(
      <>
        <AttributionPanel attributions={fixture} />
        <AttributionPanel attributions={fixture} />
      </>,
    );
    const ids = [...container.querySelectorAll("h3[id]")].map((h) => h.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (const section of container.querySelectorAll('[data-slot="attribution-panel-section"]')) {
      const labelledBy = section.getAttribute("aria-labelledby")!;
      expect(section.querySelector(`#${CSS.escape(labelledBy)}`)).not.toBeNull();
    }
  });

  it("renders an empty state rather than a blank panel", () => {
    render(<AttributionPanel attributions={[]} />);
    expect(screen.getByText("No attributions match this filter.")).toBeInTheDocument();
  });

  it("opens external links safely", () => {
    render(<AttributionPanel attributions={fixture} />);
    const link = screen.getByRole("link", { name: "OpenStreetMap" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("merges className and spreads props onto the root", () => {
    const { container } = render(
      <AttributionPanel attributions={fixture} className="my-panel" id="attrib" />,
    );
    const root = container.querySelector('[data-slot="attribution-panel"]')!;
    expect(root).toHaveClass("my-panel");
    expect(root).toHaveAttribute("id", "attrib");
  });

  // The real dataset is generated; if the generator ever emits nothing, the panel
  // would render an innocuous empty state and the obligation would silently lapse.
  it("ships a non-empty generated dataset including the required map notices", async () => {
    const { ATTRIBUTIONS } = await import("./attributions.generated");
    expect(ATTRIBUTIONS.length).toBeGreaterThan(0);
    const required = ATTRIBUTIONS.filter((a) => a.required);
    expect(required.some((a) => a.id === "openstreetmap")).toBe(true);
    expect(required.some((a) => a.id === "carto")).toBe(true);
    for (const entry of required) expect(entry.copyright).toBeTruthy();
  });
});
