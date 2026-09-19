import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
    const groupLabels = Array.from(
      container.querySelectorAll('[data-slot="gates-band-summary"] span:first-child'),
    ).map((el) => el.textContent);
    expect(groupLabels).toEqual(["Stories", "Components", "Themes"]);
  });

  it("each group is a disclosure, closed by default, showing its own rule count", () => {
    const { container } = render(
      <GatesBand
        gates={GATES}
        count={GATES.length}
        categoryLabels={{ stories: "Stories", components: "Components", themes: "Themes" }}
      />,
    );
    const groups = Array.from(container.querySelectorAll('[data-slot="gates-band-group"]'));
    expect(groups.every((group) => (group as HTMLDetailsElement).open)).toBe(false);
    expect(screen.getAllByText("1 rule")).toHaveLength(2); // stories + themes: one rule each
    expect(screen.getByText("2 rules")).toBeInTheDocument(); // components: two rules
  });

  it("opens on click, closes again on a second click (keyboard-operable via native <summary>)", () => {
    const { container } = render(<GatesBand gates={GATES} count={GATES.length} />);
    const details = container.querySelector('[data-slot="gates-band-group"]') as HTMLDetailsElement;
    const summary = details.querySelector('[data-slot="gates-band-summary"]')!;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    fireEvent.click(summary);
    expect(details.open).toBe(false);
  });

  it("splits a doc's backtick runs into real <code>, leaving no literal backtick in the text", () => {
    const { container } = render(
      <GatesBand
        gates={[
          {
            id: "raw-palette",
            doc: "Use `text-info-text`, never `text-yellow-600`.",
            category: "components",
          },
        ]}
        count={1}
      />,
    );
    const item = container.querySelector('[data-slot="gates-band-item"]')!;
    expect(item.textContent).not.toContain("`");
    const codeRuns = Array.from(item.querySelectorAll("code")).map((el) => el.textContent);
    expect(codeRuns).toEqual(["raw-palette", "text-info-text", "text-yellow-600"]);
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
