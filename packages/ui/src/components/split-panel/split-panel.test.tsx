import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SplitPanel } from "./split-panel";

describe("SplitPanel", () => {
  it("renders both panes", () => {
    const { getByText } = render(<SplitPanel start={<>List</>} end={<>Detail</>} />);
    expect(getByText("List")).toBeInTheDocument();
    expect(getByText("Detail")).toBeInTheDocument();
  });

  // The pane content is bare text, so getByText returns the pane <div> itself.
  it("defaults to plain tone (no ground offset) and a divider on the end pane", () => {
    const { getByText } = render(<SplitPanel start={<>List</>} end={<>Detail</>} />);
    const startPane = getByText("List");
    const endPane = getByText("Detail");
    expect(startPane.className).not.toMatch(/bg-surface-muted|bg-card/);
    expect(endPane.className).not.toMatch(/bg-surface-muted|bg-card/);
    expect(endPane.className).toMatch(/border-s/);
  });

  // Issue #163 — WCAG 1.4.11: with both tones "plain" (the shipped default),
  // the hairline is the ONLY cue between the two panes (no fill/elevation
  // difference), so it must be the strong, ≥3:1 rung — `border-strong ≥ 3:1
  // on --card/--background` is proven for every theme in
  // `@elabs-ai/components-tokens`'s `themes-contrast.test.ts`; this test locks
  // that `SplitPanel` actually reaches for that token in this configuration,
  // not just the bare `border-s`/`border-t` class the previous assertion
  // above already passed on the unfixed code.
  it("plain/plain divider uses the strong (≥3:1) border rung, not the subtle default", () => {
    const { getByText } = render(<SplitPanel start={<>List</>} end={<>Detail</>} />);
    expect(getByText("Detail").className).toMatch(/border-border-strong/);
  });

  it("muted/card tones keep the subtle divider rung — the fill difference already carries the boundary", () => {
    const { getByText } = render(
      <SplitPanel startTone="muted" endTone="card" start={<>List</>} end={<>Detail</>} />,
    );
    expect(getByText("Detail").className).not.toMatch(/border-border-strong/);
  });

  it("applies the ground-offset tones: muted well + raised card", () => {
    const { getByText } = render(
      <SplitPanel
        startTone="muted"
        endTone="card"
        divider={false}
        start={<>List</>}
        end={<>Detail</>}
      />,
    );
    expect(getByText("List").className).toMatch(/bg-surface-muted/);
    const endPane = getByText("Detail");
    expect(endPane.className).toMatch(/bg-card/);
    expect(endPane.className).toMatch(/shadow-sm/);
    expect(endPane.className).not.toMatch(/border-s/);
  });
});
