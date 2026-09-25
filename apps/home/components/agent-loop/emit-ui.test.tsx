// @vitest-environment jsdom
/**
 * emit-ui.test.tsx — locks #557: the `#emit-ui` section heading renders as an `<h2>` (level
 * 2), a peer of `#agents`/`#works-with`/route-cards, not nested a level below as the leftover
 * `<h3>` from before wave-3 ruling 19(a) promoted it to a top-level section. `AgentLoopTrace`'s
 * own "Tool calls" subsection heading is untouched and correctly stays `h3` — not this file's
 * concern, since it renders inside `agent-loop-trace.tsx`, not `emit-ui.tsx`.
 *
 * The A2UI module and Monaco are mocked to trivial stubs: this test only cares about the
 * header markup rendered unconditionally by `EmitUiSection`, never about the loaded
 * playground, so there's no reason to pull in the real (heavy) dynamic imports.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitUiCopy as copy } from "../../content/copy";

vi.mock("@elabs-ai/components-ai", () => ({
  A2UI_CATALOG_SCHEMA: {},
  A2uiSurface: () => null,
  validateA2uiSurface: () => ({ ok: true, spec: {} }),
}));
vi.mock("@elabs-ai/components-editor", () => ({ CodeEditor: () => null }));
vi.mock("@elabs-ai/components-editor/monaco", () => ({}));

const { EmitUiSection } = await import("./emit-ui");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe("EmitUiSection heading (issue 557)", () => {
  it("renders the section heading as an h2, a peer of the site's other top-level sections", () => {
    act(() => {
      root.render(<EmitUiSection />);
    });
    const heading = container.querySelector("#emit-ui-heading");
    expect(heading?.tagName).toBe("H2");
    expect(heading?.textContent).toBe(copy.heading);
  });
});
