/**
 * Locks the fence-collision fix: a nested CONTAINER directive (`:::card`) inside an
 * `:::iterate` / `:::pivot` cell must render as the REAL component AND keep the
 * content AFTER it, instead of being truncated. Before the fix the builder
 * serialized a 3-colon `:::iterate`, so the nested `:::card`'s closing `:::` closed
 * the OUTER block early — the card rendered as plain text and everything after it
 * (incl. `{{tokens}}`) was dropped. `serializeIterationDirective` now escalates the
 * outer fence past any nested fence (`outerDirectiveFence`).
 *
 * Nested previews are jsdom-sensitive (Streamdown), so this lives in its OWN file
 * with generous waits — per the markdown-preview-iteration suite convention.
 */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./markdown-preview";
import {
  evaluateEmbedded,
  serializeIterationDirective,
} from "../markdown-iteration/iteration-builder";

afterEach(cleanup);

// Cards compose the `bg-card` surface — count them to prove the directive rendered
// as a real <Card>, not as truncated plain text.
const cardCount = (root: HTMLElement) => root.querySelectorAll(".bg-card").length;

describe("nested directive inside an iteration cell (fence-collision fix)", () => {
  it("iterate: a :::card with trailing content renders a real Card AND the trailing text, per item", async () => {
    const md = serializeIterationDirective({
      kind: "iterate",
      as: "item",
      layout: "stacked",
      values: ["Ada", "Bo"],
      template: [
        `:::card{title="{{item.name}}"}`,
        `body for {{item.name}}`,
        `:::`,
        ``,
        `tail {{item.name}}`,
      ].join("\n"),
    });
    // The serializer escalates the outer fence past the nested `:::card` (3 colons).
    expect(md.startsWith("::::iterate")).toBe(true);

    const { container } = render(
      <MarkdownPreview evaluateIteration={evaluateEmbedded}>{md}</MarkdownPreview>,
    );

    // One real Card per item (2) — was 0 before the fix (rendered as plain text).
    await waitFor(() => expect(cardCount(container)).toBe(2), { timeout: 8000 });
    expect(container.textContent).toContain("body for Ada");
    expect(container.textContent).toContain("body for Bo");
    // The content AFTER the nested card survives — it was dropped before the fix.
    expect(container.textContent).toContain("tail Ada");
    expect(container.textContent).toContain("tail Bo");
  });
});
