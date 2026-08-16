import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLazyMermaidPlugin, lazyMermaid, preloadMermaid } from "./_lazy-mermaid";

/**
 * The Mermaid engine is mocked so we can observe how the plugin drives it.
 *
 * NOTE this file tests the plugin's *behaviour*. That the engine is genuinely
 * lazy is a property of the BUILD, not of jsdom — `vi.mock` factories are
 * hoisted and cached, so a counter here would prove nothing. The static proof is
 * `pnpm heavy-deps:check`, which asserts no `packages/ai/src` module statically
 * imports mermaid, plus the built `packages/ai/dist/index.js` carrying
 * `import("mermaid")` and no `@streamdown/mermaid` edge.
 */
const initialize = vi.fn();
const render = vi.fn(async (id: string) => ({ svg: `<svg id="${id}"/>` }));

vi.mock("mermaid", () => ({ default: { initialize, render } }));

describe("lazy mermaid plugin", () => {
  beforeEach(() => {
    initialize.mockClear();
    render.mockClear();
  });

  it("exposes the DiagramPlugin contract Streamdown expects", () => {
    expect(lazyMermaid).toMatchObject({
      language: "mermaid",
      name: "mermaid",
      type: "diagram",
    });
    expect(typeof lazyMermaid.getMermaid).toBe("function");
  });

  it("touches the engine only on render, never on getMermaid", () => {
    // Streamdown calls getMermaid() immediately before awaiting render(); the
    // plugin object being present from the first frame is what avoids a
    // "raw source flashes, then becomes a diagram" transition.
    createLazyMermaidPlugin().getMermaid();
    expect(initialize).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it("delegates render to the engine and returns its svg", async () => {
    const result = await createLazyMermaidPlugin().getMermaid().render("d1", "graph TD; A-->B;");

    expect(render).toHaveBeenCalledWith("d1", "graph TD; A-->B;");
    expect(result.svg).toContain("d1");
  });

  it("initializes exactly once across repeated renders", async () => {
    const instance = createLazyMermaidPlugin().getMermaid();

    await instance.render("d1", "graph TD; A-->B;");
    await instance.render("d2", "graph TD; C-->D;");

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("applies the upstream brand defaults, including securityLevel: strict", async () => {
    await createLazyMermaidPlugin().getMermaid().render("d1", "graph TD; A-->B;");

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        fontFamily: "monospace",
        securityLevel: "strict",
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: "default",
      }),
    );
  });

  it("merges a per-plugin config over the defaults", async () => {
    await createLazyMermaidPlugin({ config: { theme: "dark" } })
      .getMermaid()
      .render("d1", "graph TD; A-->B;");

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: "strict", theme: "dark" }),
    );
  });

  it("lets getMermaid(config) override, and re-initializes for it", async () => {
    const plugin = createLazyMermaidPlugin();

    await plugin.getMermaid().render("d1", "graph TD; A-->B;");
    await plugin.getMermaid({ theme: "forest" }).render("d2", "graph TD; C-->D;");

    expect(initialize).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({ securityLevel: "strict", theme: "forest" }),
    );
  });

  it("preloadMermaid resolves without rendering anything", async () => {
    expect(() => preloadMermaid()).not.toThrow();
    expect(render).not.toHaveBeenCalled();
  });
});
