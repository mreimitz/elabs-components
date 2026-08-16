import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./markdown-preview";

afterEach(cleanup);

/*
 * Wikilinks + renderLinkPreview. Kept out of markdown-preview.test.tsx (whose
 * mermaid/Shiki async tests perturb later remark-transform renders in the same
 * jsdom module). The wikilink resolved case (a remark-plugin-inserted link) is
 * asserted FIRST in this clean module. Features verified here; cross-theme pixel
 * sweep owed. (Transclusion has its own file — its nested Streamdown is even more
 * env-sensitive.)
 */

describe("MarkdownPreview — wikilinks (resolveWikilink)", () => {
  it("rewrites [[target#anchor|alias]] to a resolved <a>, passing the anchor", async () => {
    const calls: Array<{ target: string; anchor?: string }> = [];
    render(
      <MarkdownPreview
        resolveWikilink={(target, opts) => {
          calls.push({ target, anchor: opts.anchor });
          // Absolute URL: relative hrefs are stripped by Streamdown's harden
          // sanitizer (the same constraint resolveUrl documents).
          return target === "Page" ? `https://wiki.test/${target}` : null;
        }}
      >{`See [[Page#intro|the page]] for more.`}</MarkdownPreview>,
    );
    const link = await screen.findByRole("link", {}, { timeout: 5000 });
    expect(link).toHaveAttribute("href", "https://wiki.test/Page");
    expect(link).toHaveTextContent("the page");
    expect(calls).toContainEqual({ target: "Page", anchor: "intro" });
  });

  it("leaves an UNresolvable wikilink as literal text (never a broken link)", async () => {
    render(
      <MarkdownPreview resolveWikilink={() => null}>{`A [[Ghost]] reference.`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText(/A/)).toBeInTheDocument());
    expect(screen.getByText(/\[\[Ghost\]\]/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("MarkdownPreview — renderLinkPreview", () => {
  it("wraps each rendered anchor via the consumer hook", async () => {
    render(
      <MarkdownPreview
        renderLinkPreview={(href, children) => (
          <span data-testid="lp" data-href={href}>
            {children}
          </span>
        )}
      >{`A [link](https://example.com/page) here.`}</MarkdownPreview>,
    );
    const wrap = await screen.findByTestId("lp");
    expect(wrap).toHaveAttribute("data-href", "https://example.com/page");
    expect(wrap.querySelector("a")).not.toBeNull();
  });
});
