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
      container.querySelectorAll('[data-slot="gates-band-label"]'),
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
    expect(groups).toHaveLength(3);
    // `some`, not `every`: a single open group must fail this, not just "all of them open".
    expect(groups.some((group) => (group as HTMLDetailsElement).open)).toBe(false);
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

  it("every summary carries a visible, hidden-from-AT chevron cue that turns on [open]", () => {
    // jsdom computes no Tailwind CSS, so this pins the markup the cue depends on; the
    // `DisclosureOpens` story asserts the real computed rotation in a browser, closed vs open.
    const { container } = render(<GatesBand gates={GATES} count={GATES.length} />);
    const groups = Array.from(
      container.querySelectorAll<HTMLDetailsElement>('[data-slot="gates-band-group"]'),
    );
    for (const details of groups) {
      expect(details).toHaveClass("group/gate");
      const summary = details.querySelector('[data-slot="gates-band-summary"]')!;
      // The native marker is gone under `flex`; the chevron replaces it, and the WebKit
      // pseudo-marker is hidden so Safari never draws a second one.
      expect(summary).toHaveClass("flex", "list-none", "[&::-webkit-details-marker]:hidden");
      expect(summary).toHaveClass("hover:text-foreground");
      const chevron = summary.querySelector('[data-slot="gates-band-chevron"]')!;
      expect(chevron).toHaveAttribute("aria-hidden", "true");
      expect(chevron.textContent).toBe("");
      expect(chevron).toHaveClass("-rotate-45", "group-open/gate:rotate-45");
      expect(chevron).toHaveClass("motion-reduce:transition-none");
    }
    // The chevron adds nothing to the summary's accessible text: label + count only.
    expect(groups[0]!.querySelector("summary")!.textContent).toBe("stories1 rule");
  });

  // Keyboard: jsdom (and user-event, whose Enter→click shim covers only button/input/a[href])
  // never runs <summary>'s native activation behaviour for a synthetic keydown, so Enter can't
  // be exercised here. The `DisclosureOpens` story presses a real, trusted Enter in Chromium.

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

  it("an odd trailing backtick renders literally instead of flipping the rest into code", () => {
    const { container } = render(
      <GatesBand
        gates={[
          {
            id: "stray-tick",
            doc: "Use `cn()` to merge, then a stray ` tick and more prose.",
            category: "components",
          },
        ]}
        count={1}
      />,
    );
    const item = container.querySelector('[data-slot="gates-band-item"]')!;
    const codeRuns = Array.from(item.querySelectorAll("code")).map((el) => el.textContent);
    expect(codeRuns).toEqual(["stray-tick", "cn()"]);
    expect(item.textContent).toBe(
      "stray-tick — Use cn() to merge, then a stray ` tick and more prose.",
    );
  });

  it("a lone backtick stays literal prose", () => {
    const { container } = render(
      <GatesBand gates={[{ id: "lone", doc: "One ` only.", category: "repo" }]} count={1} />,
    );
    const item = container.querySelector('[data-slot="gates-band-item"]')!;
    expect(item.querySelectorAll("code")).toHaveLength(1); // the id only
    expect(item.textContent).toBe("lone — One ` only.");
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

  // #591: the group label used to hand-roll `text-caption font-medium uppercase` instead of the
  // repo's own `text-eyebrow` role, and the band's own heading matched its host section's h2
  // (`text-title`) exactly, reading as flat. Locks both against regressing back to text-title or
  // a hand-rolled eyebrow.
  it("gives the group label the text-eyebrow role, not a hand-rolled caption/uppercase combo", () => {
    const { container } = render(
      <GatesBand gates={GATES} count={GATES.length} categoryLabels={{ stories: "Stories" }} />,
    );
    const label = container.querySelector('[data-slot="gates-band-label"]')!;
    expect(label).toHaveClass("text-eyebrow", "uppercase");
    expect(label).not.toHaveClass("text-caption");
  });

  it("steps its own heading down to text-subtitle, one rung below a hosting section's h2", () => {
    const { container } = render(<GatesBand gates={GATES} count={GATES.length} />);
    const heading = container.querySelector("h3")!;
    expect(heading).toHaveClass("text-subtitle");
    expect(heading).not.toHaveClass("text-title");
  });
});
