import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  EvidenceChip,
  InlineCitationCard,
  InlineCitationCardTrigger,
  inlineCitationSourceLabel,
  type InlineCitationSourceRef,
} from "./inline-citation";

/**
 * `InlineCitationCardTrigger` renders a `HoverCardTrigger`, which Radix throws
 * on outside a `HoverCard` — every case must be wrapped.
 */
const renderTrigger = (sources: InlineCitationSourceRef[]) =>
  render(
    <InlineCitationCard>
      <InlineCitationCardTrigger sources={sources} />
    </InlineCitationCard>,
  );

describe("InlineCitationCardTrigger — source labels", () => {
  it("shows the hostname for a URL source", () => {
    renderTrigger(["https://ci.acme.com/run/42"]);
    expect(screen.getByText(/ci\.acme\.com/)).toBeInTheDocument();
  });

  it("renders a NON-URL source verbatim instead of throwing", () => {
    // The P0: `new URL("Q3 filing, FY25")` throws TypeError, and with no error
    // boundary in @elabs/components-ai that took down the entire message subtree. An agent
    // citing a document id or a table name must not have to fake a URL.
    expect(() => renderTrigger(["Q3 filing, FY25"])).not.toThrow();
    expect(screen.getByText(/Q3 filing, FY25/)).toBeInTheDocument();
  });

  it.each([
    ["a bare document id", "doc-4821"],
    ["a scheme-less host", "ci.acme.com/run/42"],
    ["a root-relative path", "/reports/q3.pdf"],
    ["a human title with punctuation", "Internal Wiki › Pricing"],
    ["a filename", "Q3 Revenue Report.pdf"],
  ])("does not throw on %s", (_label, source) => {
    expect(() => renderTrigger([source])).not.toThrow();
  });

  it("prefers an explicit label over the URL hostname", () => {
    renderTrigger([{ label: "Q3 Revenue Report", url: "https://docs.acme.com/q3" }]);
    expect(screen.getByText(/Q3 Revenue Report/)).toBeInTheDocument();
    expect(screen.queryByText(/docs\.acme\.com/)).not.toBeInTheDocument();
  });

  it("falls back to the hostname when an object has only a url", () => {
    renderTrigger([{ url: "https://docs.acme.com/q3" }]);
    expect(screen.getByText(/docs\.acme\.com/)).toBeInTheDocument();
  });

  it("falls back to the opaque id when an object has neither label nor url", () => {
    renderTrigger([{ id: "warehouse.public.orders" }]);
    expect(screen.getByText(/warehouse\.public\.orders/)).toBeInTheDocument();
  });

  it("counts the remaining sources", () => {
    renderTrigger(["https://a.example.com", "doc-2", { id: "doc-3" }]);
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });

  it("renders 'unknown' for an empty source list", () => {
    renderTrigger([]);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("EvidenceChip inherits the same tolerance (it is an alias)", () => {
    expect(() =>
      render(
        <InlineCitationCard>
          <EvidenceChip sources={["qlik-doc-4821"]} />
        </InlineCitationCard>,
      ),
    ).not.toThrow();
    expect(screen.getByText(/qlik-doc-4821/)).toBeInTheDocument();
  });
});

describe("inlineCitationSourceLabel", () => {
  it.each<[InlineCitationSourceRef, string]>([
    ["https://ci.acme.com/run/42", "ci.acme.com"],
    ["doc-4821", "doc-4821"],
    [{ label: "Pricing wiki", url: "https://w.acme.com" }, "Pricing wiki"],
    [{ url: "https://w.acme.com/x" }, "w.acme.com"],
    [{ id: "orders" }, "orders"],
    [{}, "unknown"],
  ])("%o → %s", (source, expected) => {
    expect(inlineCitationSourceLabel(source)).toBe(expected);
  });
});
