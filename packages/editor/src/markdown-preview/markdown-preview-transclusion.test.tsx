import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./markdown-preview";

afterEach(cleanup);

/*
 * Transclusion is the most jsdom-sensitive render in the suite: the resolved path
 * mounts a NESTED Streamdown inside the outer one. In a multi-render file the
 * nested mount is perturbed by prior Streamdown renders (an env-only gremlin — the
 * feature renders correctly in the browser and in isolation). So transclusion gets
 * its OWN file with the resolved (nested-render) case asserted FIRST in a clean
 * module context. Six-theme pixel sweep still owed.
 */
describe("MarkdownPreview — transclusion (resolveTransclusion)", () => {
  it("embeds resolved markdown in a labelled figure", async () => {
    render(
      <MarkdownPreview
        resolveTransclusion={(target) => (target === "Note" ? "Embedded **fact**." : null)}
      >{`![[Note#section]]`}</MarkdownPreview>,
    );
    const fig = await screen.findByTestId("transclusion-block", undefined, { timeout: 5000 });
    expect(fig).toHaveAttribute("aria-label", "Embedded: Note#section");
    expect(fig).toHaveTextContent("fact");
  });

  it("renders an unresolvable transclusion as literal text", async () => {
    render(<MarkdownPreview resolveTransclusion={() => null}>{`![[Gone]]`}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByText(/!\[\[Gone\]\]/)).toBeInTheDocument());
    expect(screen.queryByTestId("transclusion-block")).toBeNull();
  });
});
