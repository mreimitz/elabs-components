import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { diagramNodeLabel, fitTransform, MermaidViewer } from "./mermaid-viewer";

afterEach(cleanup);

describe("fitTransform", () => {
  it("returns null while the container is unmeasured (pre-layout dialog)", () => {
    expect(fitTransform({ width: 0, height: 0 }, { width: 800, height: 600 })).toBeNull();
    expect(fitTransform({ width: 10, height: 10 }, { width: 800, height: 600 })).toBeNull();
  });

  it("returns null for an unmeasured diagram", () => {
    expect(fitTransform({ width: 1000, height: 800 }, { width: 0, height: 0 })).toBeNull();
  });

  it("NEVER upscales: a small diagram fits at 100%, centered", () => {
    const t = fitTransform({ width: 1024, height: 624 }, { width: 500, height: 300 });
    expect(t).not.toBeNull();
    // Contain-fit would be 2× — fit means "all visible", not "blown up".
    expect(t!.scale).toBe(1);
    expect(t!.tx).toBe((1024 - 500) / 2);
    expect(t!.ty).toBe((624 - 300) / 2);
  });

  it("downscales a large diagram to the contain-fit scale", () => {
    const t = fitTransform({ width: 1024, height: 624 }, { width: 2000, height: 600 });
    expect(t).not.toBeNull();
    // Limiting axis: width → (1024-24)/2000 = 0.5.
    expect(t!.scale).toBe(0.5);
    expect(t!.tx).toBe((1024 - 2000 * 0.5) / 2);
    expect(t!.ty).toBe((624 - 600 * 0.5) / 2);
  });

  it("clamps the scale into the zoom range", () => {
    const t = fitTransform({ width: 100, height: 100 }, { width: 10_000, height: 10_000 });
    expect(t!.scale).toBe(0.2);
  });
});

describe("diagramNodeLabel", () => {
  const parse = (markup: string): Element => {
    const host = document.createElement("div");
    host.innerHTML = markup;
    return host.firstElementChild!;
  };

  it("joins htmlLabels paragraph lines with a separator", () => {
    const node = parse(
      `<g class="node" id="a"><foreignObject><div><span class="nodeLabel"><p>Microsoft Graph API</p><p>Outlook / Calendar</p></span></div></foreignObject></g>`,
    );
    expect(diagramNodeLabel(node)).toBe("Microsoft Graph API · Outlook / Calendar");
  });

  it("joins tspan lines with a separator", () => {
    const node = parse(
      `<g class="node" id="b"><text><tspan>Line one</tspan><tspan>Line two</tspan></text></g>`,
    );
    expect(diagramNodeLabel(node)).toBe("Line one · Line two");
  });

  it("falls back to textContent when there are no segment elements", () => {
    const node = parse(`<g class="node" id="c"><text>Plain  label</text></g>`);
    expect(diagramNodeLabel(node)).toBe("Plain label");
  });
});

describe("MermaidViewer — node finder", () => {
  const SVG = `<svg viewBox="0 0 100 100"><g class="node" id="node-a"><foreignObject><div><span class="nodeLabel"><p>Microsoft Graph API</p><p>Outlook / Calendar</p></span></div></foreignObject></g></svg>`;

  it("lists nodes with separated label lines and persists the active highlight", async () => {
    const { container } = render(<MermaidViewer svg={SVG} label="diagram" />);
    const item = await screen.findByRole("button", {
      name: "Microsoft Graph API · Outlook / Calendar",
    });

    fireEvent.click(item);

    const node = container.querySelector("#node-a")!;
    await waitFor(() => expect(node.classList.contains("wb-dg-hit-active")).toBe(true));

    // The active mark persists even when a query no longer matches the node.
    fireEvent.change(screen.getByRole("searchbox", { name: "Find in diagram" }), {
      target: { value: "zz-no-match" },
    });
    await waitFor(() => expect(node.classList.contains("wb-dg-hit-active")).toBe(true));
  });
});
