/**
 * sources.test.tsx — smoke + link-safety lock for the grounding footer (#59).
 *
 * `Sources` is how an answer shows what it was grounded in, so the assertions
 * that matter are about the LINKS: every source is a real `<a href>` (not a
 * div-as-link), and every one carries `rel="noopener noreferrer"` alongside
 * `target="_blank"` — these open model-supplied URLs, so a missing `noopener`
 * is a reverse-tabnabbing hole, not a lint nit.
 *
 * The collapsible starts closed, so each test opens it the way a user would.
 */
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Source, SourceList, Sources, SourcesContent, SourcesTrigger } from "./sources";

const sources = [
  { href: "https://example.com/a", title: "Deploy log" },
  { href: "https://example.com/b", title: "Incident report" },
];

/** Open the collapsible the way a user does. */
function open(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("Sources — trigger", () => {
  it("summarises the count on the trigger", () => {
    render(
      <Sources>
        <SourcesTrigger count={2} />
        <SourcesContent>
          <Source href="https://example.com/a" title="Deploy log" />
        </SourcesContent>
      </Sources>,
    );
    expect(screen.getByRole("button", { name: /Used 2 sources/ })).toBeInTheDocument();
  });

  it("keeps the list collapsed until the trigger is used", () => {
    render(
      <Sources>
        <SourcesTrigger count={1} />
        <SourcesContent>
          <Source href="https://example.com/a" title="Deploy log" />
        </SourcesContent>
      </Sources>,
    );
    expect(screen.queryByRole("link", { name: "Deploy log" })).toBeNull();
    open(/Used 1 sources/);
    expect(screen.getByRole("link", { name: "Deploy log" })).toBeInTheDocument();
  });
});

describe("Source — link safety", () => {
  it("renders a real anchor carrying the href", () => {
    render(<Source href="https://example.com/a" title="Deploy log" />);
    expect(screen.getByRole("link", { name: "Deploy log" })).toHaveAttribute(
      "href",
      "https://example.com/a",
    );
  });

  it("opens in a new tab WITH noopener noreferrer (these are model-supplied URLs)", () => {
    render(<Source href="https://example.com/a" title="Deploy log" />);
    const link = screen.getByRole("link", { name: "Deploy log" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("lets children replace the default icon + title anatomy", () => {
    render(
      <Source href="https://example.com/a">
        <span>Custom label</span>
      </Source>,
    );
    expect(screen.getByRole("link", { name: "Custom label" })).toBeInTheDocument();
  });
});

describe("Sources — semantic token", () => {
  it("uses text-success-text for grounded concept and does NOT use text-primary", () => {
    const { container } = render(
      <Sources>
        <SourcesTrigger count={1} />
        <SourcesContent>
          <Source href="https://example.com/a" title="Deploy log" />
        </SourcesContent>
      </Sources>,
    );
    const root =
      container.querySelector('[data-slot="sources"]') ||
      (container.firstElementChild as HTMLElement);
    expect(root.className).toContain("text-success-text");
    expect(root.className).not.toMatch(/text-primary/);
  });
});

describe("SourceList — the per-answer grounding footer", () => {
  it("pluralises the count in the trigger", () => {
    const { unmount } = render(<SourceList sources={sources} />);
    expect(screen.getByRole("button", { name: /Grounded in 2 sources/ })).toBeInTheDocument();
    unmount();
    render(<SourceList sources={[sources[0]!]} />);
    expect(screen.getByRole("button", { name: /Grounded in 1 source$/ })).toBeInTheDocument();
  });

  it("renders one accessible link per source once expanded", () => {
    render(<SourceList sources={sources} />);
    open(/Grounded in 2 sources/);
    expect(screen.getByRole("link", { name: "Deploy log" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Incident report" })).toBeInTheDocument();
  });

  it("appends extra children after the named list (the escape hatch)", () => {
    render(
      <SourceList sources={sources}>
        <span>and 3 internal documents</span>
      </SourceList>,
    );
    open(/Grounded in 2 sources/);
    expect(screen.getByText("and 3 internal documents")).toBeInTheDocument();
  });

  it("still renders a usable trigger with zero sources (no broken UI for [])", () => {
    render(<SourceList sources={[]} />);
    expect(screen.getByRole("button", { name: /Grounded in 0 sources/ })).toBeInTheDocument();
  });
});
