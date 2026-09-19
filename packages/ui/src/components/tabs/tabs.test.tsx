import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("Tabs", () => {
  // jsdom implements neither `Element.prototype.scrollIntoView` nor a real
  // layout, so a component that calls a scroll API unconditionally CRASHES
  // every jsdom consumer of @elabs-ai/components-ui (it did: 8/8
  // of @elabs-ai/components-editor's CodeWorkspace tests died on
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
  it("creates one shared observer pair per list, not one per trigger (#387)", () => {
    const originalMutationObserver = globalThis.MutationObserver;
    const originalResizeObserver = globalThis.ResizeObserver;
    let mutationObserverCount = 0;
    let resizeObserverCount = 0;

    class CountingMutationObserver extends originalMutationObserver {
      constructor(...args: ConstructorParameters<typeof MutationObserver>) {
        super(...args);
        mutationObserverCount += 1;
      }
    }
    class CountingResizeObserver extends originalResizeObserver {
      constructor(...args: ConstructorParameters<typeof ResizeObserver>) {
        super(...args);
        resizeObserverCount += 1;
      }
    }
    globalThis.MutationObserver = CountingMutationObserver as typeof MutationObserver;
    globalThis.ResizeObserver = CountingResizeObserver as typeof ResizeObserver;

    try {
      render(
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
            <TabsTrigger value="c">C</TabsTrigger>
            <TabsTrigger value="d">D</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel A</TabsContent>
        </Tabs>,
      );
      // 4 triggers in the strip. Before the fix, each trigger owned its own
      // MutationObserver AND ResizeObserver (4 of each here — the review's
      // "20 callbacks per resize" was measured on a 20-tab strip).
      const fourTriggerMutationCount = mutationObserverCount;
      const fourTriggerResizeCount = resizeObserverCount;
      expect(fourTriggerResizeCount).toBeGreaterThan(0);

      mutationObserverCount = 0;
      resizeObserverCount = 0;
      render(
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
            <TabsTrigger value="c">C</TabsTrigger>
            <TabsTrigger value="d">D</TabsTrigger>
            <TabsTrigger value="e">E</TabsTrigger>
            <TabsTrigger value="f">F</TabsTrigger>
            <TabsTrigger value="g">G</TabsTrigger>
            <TabsTrigger value="h">H</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel A</TabsContent>
        </Tabs>,
      );
      // The list owns a FIXED number of observers regardless of trigger
      // count — doubling the trigger count must not double it.
      expect(mutationObserverCount).toBe(fourTriggerMutationCount);
      expect(resizeObserverCount).toBe(fourTriggerResizeCount);
    } finally {
      globalThis.MutationObserver = originalMutationObserver;
      globalThis.ResizeObserver = originalResizeObserver;
    }
  });

  it("renders no data-variant on the list or its triggers when variant is unset (token-driven)", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList data-testid="list">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </Tabs>,
    );
    expect(screen.getByTestId("list")).not.toHaveAttribute("data-variant");
    expect(screen.getByRole("tab", { name: "A" })).not.toHaveAttribute("data-variant");
  });

  it("keeps data-variant on the list and its triggers when variant is explicit", () => {
    render(
      <Tabs defaultValue="a">
        <TabsList data-testid="list" variant="underline">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
      </Tabs>,
    );
    expect(screen.getByTestId("list")).toHaveAttribute("data-variant", "underline");
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("data-variant", "underline");
  });

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
