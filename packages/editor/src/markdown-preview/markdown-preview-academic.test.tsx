import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./markdown-preview";
import type { CitationData } from "../markdown-academic/citations";

afterEach(cleanup);

/*
 * The academic layer (footnotes / math / citations / TOC) — none of these nest a
 * MarkdownPreview, so they share one file. They each render a single Streamdown.
 */

describe("MarkdownPreview — footnotes", () => {
  const DOC = `A claim.[^1] Repeated.[^1] Another.[^big]\n\n[^1]: First note with [a link](https://x.com).\n[^big]: Second note.`;

  it("renders refs whose anchors resolve to the definitions (no broken ids)", async () => {
    const { container } = render(<MarkdownPreview footnotes>{DOC}</MarkdownPreview>);
    await waitFor(() => expect(container.querySelector("[data-footnote-ref]")).toBeInTheDocument());

    const firstRef = container.querySelector('a[id="fnref-1"]') as HTMLAnchorElement;
    expect(firstRef).toBeInTheDocument();
    expect(firstRef.getAttribute("href")).toBe("#fn-1");
    // The ref target exists.
    expect(container.querySelector('li[id="fn-1"]')).toBeInTheDocument();
    // In-page anchors must NOT open a new tab.
    expect(firstRef).not.toHaveAttribute("target");
  });

  it("gives a repeated reference a unique id but the same number", async () => {
    const { container } = render(<MarkdownPreview footnotes>{DOC}</MarkdownPreview>);
    await waitFor(() => expect(container.querySelector('a[id="fnref-1-2"]')).toBeInTheDocument());
    const second = container.querySelector('a[id="fnref-1-2"]') as HTMLAnchorElement;
    expect(second.getAttribute("href")).toBe("#fn-1");
    expect(second.textContent).toBe("1");
  });

  it("renders a labelled footnote section with a working back-reference", async () => {
    const { container } = render(<MarkdownPreview footnotes>{DOC}</MarkdownPreview>);
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Footnotes" })).toBeInTheDocument(),
    );
    const backref = container.querySelector('a[data-footnote-backref][href="#fnref-1"]');
    expect(backref).toBeInTheDocument();
    // The footnote is cited twice → one back-ref per mention (GFM behavior).
    expect(
      container.querySelector('a[data-footnote-backref][href="#fnref-1-2"]'),
    ).toBeInTheDocument();
    // The definition's link survived sanitization.
    expect(screen.getByRole("link", { name: "a link" })).toHaveAttribute("href", "https://x.com/");
  });

  // Regression guard for #317: a link inside a running block of text must carry a
  // non-color cue (a resting `underline`) or axe's `link-in-text-block` fires. The
  // footnote marker is one of the sites that regressed to color-only (`no-underline`
  // at rest, `hover:underline` only).
  it("keeps a resting underline on the footnote marker (#317 — link-in-text-block)", async () => {
    const { container } = render(<MarkdownPreview footnotes>{DOC}</MarkdownPreview>);
    await waitFor(() => expect(container.querySelector("[data-footnote-ref]")).toBeInTheDocument());
    const ref = container.querySelector("[data-footnote-ref]") as HTMLAnchorElement;
    expect(ref.className).toMatch(/(?:^|\s)underline(?:\s|$)/);
    expect(ref.className).not.toMatch(/(?:^|\s)no-underline(?:\s|$)/);
  });
});

describe("MarkdownPreview — math (KaTeX)", () => {
  it("renders inline math with MathML for assistive tech", async () => {
    const { container } = render(
      <MarkdownPreview math>{`Mass-energy: $E = mc^2$.`}</MarkdownPreview>,
    );
    await waitFor(() => expect(container.querySelector('[role="math"]')).toBeInTheDocument());
    // KaTeX emits MathML (read by AT) + an aria-hidden visual layer.
    const mathml = container.querySelector(".katex-mathml");
    expect(mathml).toBeInTheDocument();
    expect(mathml?.textContent).toContain("E = mc^2"); // the TeX annotation, for AT
    expect(container.querySelector('.katex-html[aria-hidden="true"]')).toBeInTheDocument();
    // A raw-TeX fallback name for AT that can't process MathML.
    expect(container.querySelector('[role="math"]')).toHaveAttribute("aria-label", "E = mc^2");
  });

  it("renders block math ($$ on its own lines)", async () => {
    const { container } = render(
      <MarkdownPreview
        math
      >{`Result:\n\n$$\n\\int_0^1 x\\,dx = \\frac{1}{2}\n$$`}</MarkdownPreview>,
    );
    await waitFor(() => expect(container.querySelector('div[role="math"]')).toBeInTheDocument());
    expect(container.querySelector('div[role="math"] .katex')).toBeInTheDocument();
  });

  it("does not parse $…$ when math is off", async () => {
    const { container } = render(<MarkdownPreview>{`Price is $5 and $10.`}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByTestId("markdown-preview")).toBeInTheDocument());
    expect(container.querySelector('[role="math"]')).toBeNull();
  });

  it("degrades a malformed expression to a contained fallback (no crash)", async () => {
    render(<MarkdownPreview math>{`Bad: $\\frac{1}{$`}</MarkdownPreview>);
    // Either a KaTeX error node or our code fallback — the page still renders.
    await waitFor(() => expect(screen.getByTestId("markdown-preview")).toBeInTheDocument());
  });
});

describe("MarkdownPreview — citations + bibliography", () => {
  const DB: Record<string, CitationData> = {
    smith2020: { author: "Smith", year: 2020, title: "On Things", url: "https://ex.com/s" },
    jones2019: { author: "Jones", year: 2019, title: "More Things", doi: "10.1/x" },
  };
  const resolveCitation = (k: string) => DB[k] ?? null;

  it("numbers inline cites and the bibliography consistently", async () => {
    const { container } = render(
      <MarkdownPreview resolveCitation={resolveCitation}>
        {`See [@smith2020] and [@jones2019].\n\n::bibliography`}
      </MarkdownPreview>,
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "References" })).toBeInTheDocument(),
    );
    // Inline cite 1 → smith, links to its bib entry id.
    const cite = container.querySelector('a[href="#ref-smith2020"]') as HTMLAnchorElement;
    expect(cite.textContent).toBe("1");
    // The bare "1" carries a real accessible name (the title isn't announced by AT).
    expect(cite.getAttribute("aria-label")).toMatch(/^Citation: /);
    // Bibliography entry id matches the inline href.
    expect(container.querySelector('li[id="ref-smith2020"]')).toBeInTheDocument();
    expect(container.querySelector('li[id="ref-jones2019"]')).toBeInTheDocument();
  });

  it("renders a locator and multiple keys in one bracket", async () => {
    const { container } = render(
      <MarkdownPreview resolveCitation={resolveCitation}>
        {`Per [@jones2019, p. 5; @smith2020].`}
      </MarkdownPreview>,
    );
    await waitFor(() =>
      expect(container.querySelector('a[href="#ref-jones2019"]')).toBeInTheDocument(),
    );
    expect(container.querySelector('a[href="#ref-jones2019"]')?.textContent).toBe("1, p. 5");
    expect(container.querySelector('a[href="#ref-smith2020"]')?.textContent).toBe("2");
  });

  it("renders the author-year style", async () => {
    const { container } = render(
      <MarkdownPreview resolveCitation={resolveCitation} citationStyle="author-year">
        {`See [@smith2020].`}
      </MarkdownPreview>,
    );
    await waitFor(() =>
      expect(container.querySelector('a[href="#ref-smith2020"]')).toBeInTheDocument(),
    );
    expect(container.querySelector('a[href="#ref-smith2020"]')?.textContent).toBe("Smith 2020");
  });

  it("keeps an unresolved citation as a graceful literal", async () => {
    render(
      <MarkdownPreview
        resolveCitation={resolveCitation}
      >{`Unknown [@ghost1999].`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("[@ghost1999]")).toBeInTheDocument());
  });

  it("does not parse [@key] when no resolver is supplied", async () => {
    render(<MarkdownPreview>{`Text [@smith2020] here.`}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByText(/\[@smith2020\]/)).toBeInTheDocument());
  });

  // Regression guard for #317: the inline citation ref and the bibliography's
  // external DOI/URL link both live inside a running block of body text, so axe's
  // `link-in-text-block` requires a non-color cue (a resting `underline`) — color
  // alone (`text-primary` + `hover:underline`) is not enough.
  it("keeps a resting underline on the inline cite and bibliography links (#317 — link-in-text-block)", async () => {
    // (see also the `-text` rung guard below — #317 had two halves and the
    // underline only closed the 1.4.1 one.)
    const { container } = render(
      <MarkdownPreview resolveCitation={resolveCitation}>
        {`See [@smith2020] and [@jones2019].\n\n::bibliography`}
      </MarkdownPreview>,
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "References" })).toBeInTheDocument(),
    );
    const inlineCite = container.querySelector('a[href="#ref-smith2020"]') as HTMLAnchorElement;
    expect(inlineCite.className).toMatch(/(?:^|\s)underline(?:\s|$)/);
    expect(inlineCite.className).not.toMatch(/(?:^|\s)no-underline(?:\s|$)/);

    // jones2019 has a `doi` (no `url`) → renders the bibliography's external link.
    const bibLink = container.querySelector(
      'li[id="ref-jones2019"] a[href^="https://doi.org/"]',
    ) as HTMLAnchorElement;
    expect(bibLink).toBeInTheDocument();
    expect(bibLink.className).toMatch(/(?:^|\s)underline(?:\s|$)/);
    expect(bibLink.className).not.toMatch(/(?:^|\s)no-underline(?:\s|$)/);
  });

  // Regression guard for the OTHER half of #317 — `color-contrast`. Both links
  // used the `--primary` FILL rung as body text, which measured 4.29-4.31:1 in
  // light (sub-AA for normal text). #399 minted `--primary-text`, gated
  // ≥4.5:1 on every content surface in every theme by
  // `packages/tokens/src/themes-contrast.test.ts`; this row is the CLASS-NAME
  // lock that keeps these two call sites pointed at it. It is not a contrast
  // proof on its own — the token test is.
  it("uses the on-surface text rung (text-primary-text), not the --primary fill (#317/#399 — color-contrast)", async () => {
    const { container } = render(
      <MarkdownPreview resolveCitation={resolveCitation}>
        {`See [@smith2020] and [@jones2019].\n\n::bibliography`}
      </MarkdownPreview>,
    );
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "References" })).toBeInTheDocument(),
    );

    const inlineCite = container.querySelector('a[href="#ref-smith2020"]') as HTMLAnchorElement;
    expect(inlineCite.className.split(/\s+/)).toContain("text-primary-text");
    expect(inlineCite.className.split(/\s+/)).not.toContain("text-primary");

    const bibLink = container.querySelector(
      'li[id="ref-jones2019"] a[href^="https://doi.org/"]',
    ) as HTMLAnchorElement;
    expect(bibLink.className.split(/\s+/)).toContain("text-primary-text");
    expect(bibLink.className.split(/\s+/)).not.toContain("text-primary");
  });
});

describe("MarkdownPreview — generated TOC", () => {
  it("renders a nav whose links resolve to heading ids", async () => {
    const { container } = render(
      <MarkdownPreview toc>{`::toc\n\n# Intro\n\nbody\n\n## Details`}</MarkdownPreview>,
    );
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["#intro", "#details"]);
    expect(container.querySelector('h1[id="intro"]')).toBeInTheDocument();
    expect(container.querySelector('h2[id="details"]')).toBeInTheDocument();
  });

  it("does not stamp heading ids when toc is off", async () => {
    const { container } = render(<MarkdownPreview>{`# Intro`}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Intro" })).toBeInTheDocument());
    expect(container.querySelector("h1")?.getAttribute("id")).toBeNull();
  });

  // Regression guard for #317: TOC entries share the same color-only-link pattern
  // (kept consistent with citations/footnotes even though axe didn't flag this site
  // in the original scan).
  it("keeps a resting underline on TOC entries (#317 — link-in-text-block)", async () => {
    render(<MarkdownPreview toc>{`::toc\n\n# Intro\n\nbody\n\n## Details`}</MarkdownPreview>);
    const nav = await screen.findByRole("navigation", { name: "Contents" });
    const links = within(nav).getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.className).toMatch(/(?:^|\s)underline(?:\s|$)/);
      expect(link.className).not.toMatch(/(?:^|\s)no-underline(?:\s|$)/);
    }
  });
});
