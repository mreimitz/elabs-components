import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("Tabs", () => {
  // jsdom implements neither `Element.prototype.scrollIntoView` nor a real
  // layout, so a component that calls a scroll API unconditionally CRASHES
  // every jsdom consumer of @qlik-coe-emea/qlabs-components-ui (it did: 8/8
  // of @qlik-coe-emea/qlabs-components-editor's CodeWorkspace tests died on
  // `node.scrollIntoView is not a function`). There is deliberately no stub in
  // `vitest.setup.ts` — this renders on bare jsdom, which is the assertion.
  it("mounts under jsdom without calling any scroll API", async () => {
    const scrollTo = vi.fn();
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollTo;
    try {
      // No stub in vitest.setup.ts — the guard has to live in the component.
      expect(Element.prototype.scrollIntoView).toBeUndefined();
      render(
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel A</TabsContent>
        </Tabs>,
      );
      // Mount is a state, not an activation transition: nothing scrolls. (The
      // observers are asynchronous — let a macrotask pass before asserting.)
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollTo = originalScrollTo;
    }
  });

  // The activation path itself is layout-dependent (jsdom reports every
  // scrollWidth/clientWidth as 0, so the overflow gate always short-circuits);
  // it is measured for real in the `ProgrammaticActivation` /
  // `OverflowScrollable` Storybook interaction tests.
  it("does not throw when a tab is activated under jsdom", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    await user.click(screen.getByRole("tab", { name: "B" }));
    expect(await screen.findByText("Panel B")).toBeInTheDocument();
  });

  it("switches the active panel", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("Panel A")).toBeInTheDocument();
  });

  // Cheap class-level regression guard for #344: TabsList must be a scroll
  // container (`overflow-x-auto`, bounded by `max-w-full`) with the
  // overflow-safe centering utility, not the plain `justify-center` that
  // strands the first tab off-screen once the strip overflows. The real
  // scroll-into-view/320px-container behavior is layout-dependent and is
  // covered by the `OverflowScrollable` Storybook interaction test instead
  // (jsdom doesn't lay out real scroll geometry).
  it("renders TabsList as a bounded scroll container with safe centering", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList data-testid="list">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </Tabs>,
    );
    const list = screen.getByTestId("list");
    expect(list.className).toContain("overflow-x-auto");
    expect(list.className).toContain("max-w-full");
    expect(list.className).toContain("justify-center-safe");
    expect(list.className).not.toMatch(/(?<!-)justify-center(?!-safe)/);
  });
});
