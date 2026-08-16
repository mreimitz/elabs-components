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
