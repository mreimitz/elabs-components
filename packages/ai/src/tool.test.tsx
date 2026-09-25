import axe from "axe-core";
import type { BundledLanguage } from "shiki";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tool, ToolContent, ToolDetails, ToolHeader, ToolInput, ToolOutput } from "./tool";

const renderTool = () =>
  render(
    <Tool defaultOpen>
      <ToolHeader type="tool-search_web" state="output-available" summary="3 results found" />
      <ToolContent>
        <ToolDetails>
          <ToolInput input={{ query: "platform status page" }} />
        </ToolDetails>
      </ToolContent>
    </Tool>,
  );

describe("Tool JSON-behind-disclosure (#192, research 10 §B.5)", () => {
  it("shows the business summary in the header and keeps ToolDetails COLLAPSED by default", () => {
    renderTool();
    expect(screen.getByText("3 results found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show technical details/i })).toBeInTheDocument();
    // The JSON payload is NOT the headline — hidden until opted in.
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });

  it("reveals the technical view on demand", async () => {
    const user = userEvent.setup();
    renderTool();
    await user.click(screen.getByRole("button", { name: /show technical details/i }));
    expect(screen.getByText("Parameters")).toBeInTheDocument();
  });
});

describe("ToolHeader layout in narrow containers (#598)", () => {
  it("StatusBadge element has shrink-0 class to prevent clipping in narrow flex containers", () => {
    const { container } = render(
      <Tool>
        <ToolHeader type="tool-search_web" state="output-available" summary="3 results found" />
      </Tool>,
    );
    // StatusBadge renders as a span with data-slot="status-badge"
    const statusBadgeSpan = container.querySelector('span[data-slot="status-badge"]');
    expect(statusBadgeSpan).not.toBeNull();
    expect(statusBadgeSpan).toHaveClass("shrink-0");
  });

  it("title span has min-w-0 and truncate classes to yield space to fixed-width siblings", () => {
    render(
      <Tool>
        <ToolHeader type="tool-search_web" state="output-available" title="Search Tool" />
      </Tool>,
    );
    // Find the title span (it contains the title text and comes after the wrench icon)
    const titleSpan = screen.getByText("Search Tool");
    expect(titleSpan).toHaveClass("min-w-0");
    expect(titleSpan).toHaveClass("truncate");
  });
});

describe("ToolOutput isStreaming (#269, loading-states.md)", () => {
  it("renders a skeleton (not null) while streaming with no output yet", () => {
    const { container } = render(
      <ToolOutput output={undefined} errorText={undefined} isStreaming />,
    );
    expect(screen.getByText("Result")).toBeInTheDocument();
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
  });

  it("never shows the error branch while streaming, even with a stale errorText", () => {
    render(<ToolOutput output={undefined} errorText="boom" isStreaming />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.queryByText("Error")).not.toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("shows the terminal error branch once settled (not streaming)", () => {
    render(<ToolOutput output={undefined} errorText="boom" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("still renders nothing when idle (no output, no error, not streaming)", () => {
    const { container } = render(<ToolOutput output={undefined} errorText={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// A tool that returns a count of 0, a boolean check of false, or an empty
// string is a REAL, defined result — only `undefined` means "no output yet".
// The old `!(output || errorText || isStreaming)` guard treated all three as
// "nothing to show" and rendered null outright.
describe("ToolOutput — defined-but-falsy output renders (review #1)", () => {
  it("renders a numeric 0 result instead of returning null", () => {
    render(<ToolOutput output={0} errorText={undefined} />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders a boolean false result instead of returning null", () => {
    const { container } = render(<ToolOutput output={false} errorText={undefined} />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(container.querySelector('[data-language="json"]')).not.toBeNull();
  });

  it("renders an empty-string result (not the pending skeleton, not null)", () => {
    const { container } = render(<ToolOutput output="" errorText={undefined} />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

describe("ToolOutput — string output renders as plain text, not forced JSON (review #1)", () => {
  it("renders a plain-text (non-JSON) string result without the JSON highlighter", () => {
    const { container } = render(
      <ToolOutput output="just a plain sentence, not json" errorText={undefined} />,
    );
    expect(screen.getByText("just a plain sentence, not json")).toBeInTheDocument();
    expect(container.querySelector('[data-language="text"]')).not.toBeNull();
    expect(container.querySelector('[data-language="json"]')).toBeNull();
  });

  it("still renders an object result through the JSON highlighter", () => {
    const { container } = render(<ToolOutput output={{ ok: true }} errorText={undefined} />);
    expect(container.querySelector('[data-language="json"]')).not.toBeNull();
  });
});

describe("ToolOutput/ToolInput — JSON.stringify never crashes the render (review #1)", () => {
  it("falls back gracefully for a circular output object instead of throwing", () => {
    const circular: Record<string, unknown> = { name: "circular" };
    circular.self = circular;

    expect(() => render(<ToolOutput output={circular} errorText={undefined} />)).not.toThrow();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  it("renders a BigInt field in the output instead of throwing", () => {
    expect(() =>
      render(<ToolOutput output={{ total: 10n }} errorText={undefined} />),
    ).not.toThrow();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText(/10n/)).toBeInTheDocument();
  });

  it("falls back gracefully for circular tool input instead of throwing", () => {
    const circular: Record<string, unknown> = { query: "x" };
    circular.self = circular;

    expect(() => render(<ToolInput input={circular} />)).not.toThrow();
  });
});

// #570 — ToolInput/ToolOutput used to render their internal CodeBlock with no
// `wrap`, so a long single-line payload overflowed into `code-block.tsx`'s
// `overflow-auto` container with no keyboard-focusable scroll target — axe's
// `scrollable-region-focusable` rule (serious impact).
//
// jsdom implements no layout at all: `Element#getBoundingClientRect` and
// `Range#getClientRects` always report a zero rect (a documented jsdom
// limitation, not a bug here), so real axe-core's `scrollable-region-focusable`
// rule — whose `matches` step compares a scroll container's own rect against
// its content's rects (`isNonEmptyElementOutsideViewableRect`) — could never
// fire in this environment without help. The mocks below ground exactly those
// two rect APIs, plus the `scrollWidth`/`clientWidth` pair the rule's other
// half (`getScroll`) reads, in the ONE content-independent CSS fact that
// actually matters: `white-space: pre-wrap` (the class `CodeBlock`'s `wrap`
// prop renders, `code-block.tsx`'s `CodeBlockBody`) means a line can never be
// wider than its own container. The mock decides "does this overflow?" by
// checking for that class on the REAL rendered markup, not by branching per
// test — so reverting `wrap` on any of `tool.tsx`'s `CodeBlock` calls makes
// the corresponding case here fail against real, unmodified axe-core.
describe("ToolInput/ToolOutput — long payload stays out of an unfocusable scroll region (#570)", () => {
  const CONTAINER_SIZE = 300;
  const fixedRect = (width: number): DOMRect =>
    ({
      top: 0,
      left: 0,
      right: width,
      bottom: 20,
      width,
      height: 20,
      x: 0,
      y: 0,
      toJSON() {
        return this;
      },
    }) as DOMRect;

  let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;
  let originalGetClientRects: typeof Range.prototype.getClientRects;

  beforeEach(() => {
    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    originalGetClientRects = Range.prototype.getClientRects;

    // Every element's own box: a fixed, realistic scroll-container viewport.
    Element.prototype.getBoundingClientRect = function () {
      return fixedRect(CONTAINER_SIZE);
    };

    // A leaf's CONTENT rect: only wider than the container when nothing on
    // its ancestor chain wraps it — the real CSS behavior `wrap` relies on.
    Range.prototype.getClientRects = function (this: Range) {
      const start = this.commonAncestorContainer;
      const el = start instanceof Element ? start : start.parentElement;
      const wraps = el?.closest(".whitespace-pre-wrap") != null;
      const rects = [fixedRect(wraps ? CONTAINER_SIZE : CONTAINER_SIZE * 4)];
      return Object.assign(rects, {
        item: (i: number) => rects[i] ?? null,
      }) as unknown as DOMRectList;
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    Range.prototype.getClientRects = originalGetClientRects;
  });

  /** A single unbroken "word" long enough to overflow a fixed-width region
   * unless it is wrapped — no whitespace to break on otherwise. */
  const LONG_UNBROKEN_LINE = "x".repeat(400);

  async function expectWrappedWithNoScrollableRegionViolation(container: HTMLElement) {
    // The direct pin: the rendered `<pre>` carries the class `wrap` produces,
    // so dropping `wrap` from a call site fails here with a plain message
    // before axe even runs.
    expect(container.querySelector("pre")).toHaveClass("whitespace-pre-wrap");

    const scrollRegion = container.querySelector<HTMLElement>(".overflow-auto");
    expect(scrollRegion).not.toBeNull();

    // `overflow-auto`'s real computed value — grounded directly because
    // jsdom never loads the Tailwind stylesheet, so `getComputedStyle` would
    // otherwise see no `overflow` declaration at all.
    scrollRegion!.style.overflowX = "auto";
    scrollRegion!.style.overflowY = "auto";
    Object.defineProperty(scrollRegion, "clientWidth", {
      configurable: true,
      value: CONTAINER_SIZE,
    });
    Object.defineProperty(scrollRegion, "scrollWidth", {
      configurable: true,
      value: scrollRegion!.querySelector(".whitespace-pre-wrap")
        ? CONTAINER_SIZE
        : CONTAINER_SIZE * 4,
    });

    const results = await axe.run(container, {
      runOnly: { type: "rule", values: ["scrollable-region-focusable"] },
    });
    expect(results.violations).toHaveLength(0);
  }

  it("ToolOutput soft-wraps a long single-line string result: no scrollable-region-focusable violation", async () => {
    const { container } = render(<ToolOutput output={LONG_UNBROKEN_LINE} errorText={undefined} />);
    await expectWrappedWithNoScrollableRegionViolation(container);
  });

  it("ToolOutput soft-wraps a long single-line JSON result: no scrollable-region-focusable violation", async () => {
    const { container } = render(
      <ToolOutput output={{ value: LONG_UNBROKEN_LINE }} errorText={undefined} />,
    );
    await expectWrappedWithNoScrollableRegionViolation(container);
  });

  it("ToolInput soft-wraps a long single-line parameter value: no scrollable-region-focusable violation", async () => {
    const { container } = render(<ToolInput input={{ value: LONG_UNBROKEN_LINE }} />);
    await expectWrappedWithNoScrollableRegionViolation(container);
  });

  it("locks the fix: WITHOUT `wrap`, the same long single-line result DOES trip the rule", async () => {
    // Proves the harness above can fail for the right reason — renders the
    // pre-#570 shape directly (CodeBlock with no `wrap`) rather than trusting
    // that a passing suite means the check is capable of failing at all.
    const { CodeBlock } = await import("./code-block");
    const { container } = render(
      <CodeBlock code={LONG_UNBROKEN_LINE} language={"text" as BundledLanguage} />,
    );
    const scrollRegion = container.querySelector<HTMLElement>(".overflow-auto")!;
    scrollRegion.style.overflowX = "auto";
    scrollRegion.style.overflowY = "auto";
    Object.defineProperty(scrollRegion, "clientWidth", {
      configurable: true,
      value: CONTAINER_SIZE,
    });
    Object.defineProperty(scrollRegion, "scrollWidth", {
      configurable: true,
      value: CONTAINER_SIZE * 4,
    });

    const results = await axe.run(container, {
      runOnly: { type: "rule", values: ["scrollable-region-focusable"] },
    });
    expect(results.violations.length).toBeGreaterThan(0);
  });
});
