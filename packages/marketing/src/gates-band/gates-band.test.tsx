import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GatesBand, type GatesBandGate } from "./gates-band";

const GATES: GatesBandGate[] = [
  { id: "a11y-baseline", doc: "Axe stays blocking.", category: "stories" },
  { id: "component-registration", doc: "Every component ships a story.", category: "components" },
  { id: "data-slot", doc: "Every root carries data-slot.", category: "components" },
  { id: "theme-parity", doc: "Every theme defines every token.", category: "themes" },
];

describe("GatesBand", () => {
  it("renders every gate's id, once each", () => {
    render(<GatesBand gates={GATES} count={GATES.length} />);
    for (const gate of GATES) {
      expect(screen.getByText(gate.id)).toBeInTheDocument();
    }
  });

  it("renders the header count from the count prop, not gates.length", () => {
    render(<GatesBand gates={GATES} count={88} />);
    expect(screen.getByText("(88)")).toBeInTheDocument();
  });

  it("groups rules under their own category field, in first-seen order", () => {
    const { container } = render(
      <GatesBand
        gates={GATES}
        count={GATES.length}
        categoryLabels={{ stories: "Stories", components: "Components", themes: "Themes" }}
      />,
    );
    const groupHeadings = Array.from(
      container.querySelectorAll('[data-slot="gates-band-group"] h4'),
    ).map((el) => el.textContent);
    expect(groupHeadings).toEqual(["Stories", "Components", "Themes"]);
  });

  it("an unlisted category falls back to its own slug, never a hand-typed label", () => {
    render(
      <GatesBand
        gates={[{ id: "external-check", doc: "Runs an external command.", category: "external" }]}
        count={1}
      />,
    );
    expect(screen.getByText("external")).toBeInTheDocument();
  });

  it("renders a host-supplied footer, and nothing when none is given", () => {
    const { rerender, container } = render(<GatesBand gates={GATES} count={GATES.length} />);
    expect(container.querySelector('[data-slot="gates-band-footer"]')).toBeNull();
    rerender(
      <GatesBand gates={GATES} count={GATES.length} footer="See docs/GATES.md on GitHub." />,
    );
    expect(screen.getByText("See docs/GATES.md on GitHub.")).toBeInTheDocument();
  });

  it("carries data-slot on the root and merges a caller className", () => {
    const { container } = render(
      <GatesBand gates={GATES} count={GATES.length} className="probe" />,
    );
    expect(container.querySelector('[data-slot="gates-band"].probe')).not.toBeNull();
  });
});
