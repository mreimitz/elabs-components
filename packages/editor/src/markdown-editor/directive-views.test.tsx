/**
 * Regression tests for the iteration node-view's `⋯` / right-click menu
 * (directive-views.tsx, #223). Milkdown mounts fine in jsdom for these
 * interaction paths (the `markdown-editor.directives.test.tsx` precedent) —
 * only the canvas/Monaco-backed surfaces need a browser.
 */
import { createRef, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import {
  IterationEditContext,
  type IterationEditRequest,
} from "../markdown-iteration/edit-context";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";

afterEach(cleanup);

/** A no-op handler is enough to make the ⋯ / right-click menu render at all. */
function withEditHandler(children: ReactNode) {
  return <IterationEditContext.Provider value={() => {}}>{children}</IterationEditContext.Provider>;
}

const PIVOT_WITH_CONSUMER_ATTRS = `:::pivot{source="sales" region="EU" rows="Q1, Q2" cols="North, South"}
{{row}} · {{col}}
:::
`;

const ITERATE_CONSUMER_EVALUATED = `:::iterate{as="repo" source="repos" layout="grid"}
{{repo.name}}
:::
`;

const PIVOT_CONSUMER_EVALUATED = `:::pivot{source="sales" layout="matrix"}
{{row}} · {{col}}
:::
`;

async function openNodeMenu(): Promise<HTMLElement> {
  const user = userEvent.setup();
  const menuButton = await screen.findByRole("button", { name: "Iteration actions" });
  await user.click(menuButton);
  return screen.findByRole("menu");
}

describe("IterationDirectiveView — Edit iteration… merges instead of replacing attributes", () => {
  test("onSaveData merges the guided builder's write-back WITHOUT dropping unrelated consumer attributes", async () => {
    const user = userEvent.setup();
    const ref = createRef<MarkdownEditorHandle>();
    let captured: IterationEditRequest | null = null;
    render(
      <IterationEditContext.Provider
        value={(request) => {
          captured = request;
        }}
      >
        <MarkdownEditor ref={ref} defaultValue={PIVOT_WITH_CONSUMER_ATTRS} />
      </IterationEditContext.Provider>,
    );

    const menu = await openNodeMenu();
    await user.click(within(menu).getByText("Edit iteration…"));
    await waitFor(() => expect(captured).not.toBeNull());

    // Simulate the guided builder dialog saving — its model only knows
    // `layout`/`rows`/`cols`, so its write-back must NOT drop `source`/`region`.
    captured!.onSaveData!({
      attributes: { layout: "matrix", rows: "Q1, Q2, Q3", cols: "North, South" },
      template: "{{row}} · {{col}}",
    });

    await waitFor(() => {
      const md = ref.current!.getMarkdown();
      expect(md).toContain('rows="Q1, Q2, Q3"');
      expect(md).toContain('cols="North, South"');
      // The consumer's own attributes (its `evaluate`'s data-source reference)
      // must survive the save — they are NOT part of the builder's model.
      expect(md).toContain('source="sales"');
      expect(md).toContain('region="EU"');
    });
  });
});

describe("IterationDirectiveView — Transpose merges instead of replacing attributes", () => {
  test("Transpose swaps rows/cols WITHOUT dropping unrelated consumer attributes", async () => {
    const user = userEvent.setup();
    const ref = createRef<MarkdownEditorHandle>();
    render(withEditHandler(<MarkdownEditor ref={ref} defaultValue={PIVOT_WITH_CONSUMER_ATTRS} />));

    const menu = await openNodeMenu();
    await user.click(within(menu).getByText("Transpose"));

    await waitFor(() => {
      const md = ref.current!.getMarkdown();
      expect(md).toContain('rows="North, South"');
      expect(md).toContain('cols="Q1, Q2"');
      // The consumer's own attributes (its `evaluate`'s data-source reference)
      // must survive the transpose — they are NOT part of the transpose model.
      expect(md).toContain('source="sales"');
      expect(md).toContain('region="EU"');
    });
  });
});

describe("IterationDirectiveView — Transpose is disabled with no embedded pivot axes", () => {
  test("a pivot with embedded rows/cols is NOT disabled", async () => {
    render(withEditHandler(<MarkdownEditor defaultValue={PIVOT_WITH_CONSUMER_ATTRS} />));
    const menu = await openNodeMenu();
    const item = within(menu).getByText("Transpose").closest('[role="menuitem"]')!;
    expect(item).not.toHaveAttribute("aria-disabled", "true");
  });

  test("a pivot resolved by the consumer's evaluate (no rows/cols) is disabled, its reason is VISIBLE, and it's inert", async () => {
    const user = userEvent.setup();
    const ref = createRef<MarkdownEditorHandle>();
    render(withEditHandler(<MarkdownEditor ref={ref} defaultValue={PIVOT_CONSUMER_EVALUATED} />));

    const menu = await openNodeMenu();
    // The disabled reason is folded into the item's own visible label (NOT a
    // `title` attribute — a disabled Radix item is `pointer-events-none`, so a
    // hover tooltip could never fire, and it's skipped by keyboard focus).
    const label = within(menu).getByText("Transpose — needs embedded values");
    const item = label.closest('[role="menuitem"]')!;
    expect(item).toHaveAttribute("aria-disabled", "true");

    const before = ref.current!.getMarkdown();
    await user.click(label);
    // A disabled Radix item never fires `onSelect` — the block is byte-identical
    // afterwards (previously Transpose silently wrote bare `rows`/`cols` FLAGS —
    // `mdast-util-directive`'s serialization of an empty-string attribute value —
    // as a visual no-op that still dirtied the document).
    expect(ref.current!.getMarkdown()).toBe(before);
  });
});

describe("IterationDirectiveView — Convert to static is disabled with no embedded data", () => {
  test("a block with embedded values is NOT disabled", async () => {
    render(withEditHandler(<MarkdownEditor defaultValue={PIVOT_WITH_CONSUMER_ATTRS} />));
    const menu = await openNodeMenu();
    const item = within(menu).getByText("Convert to static").closest('[role="menuitem"]')!;
    expect(item).not.toHaveAttribute("aria-disabled", "true");
  });

  test("a block resolved by the consumer's evaluate (no embedded values) is disabled, its reason is VISIBLE, and it's inert", async () => {
    const user = userEvent.setup();
    const ref = createRef<MarkdownEditorHandle>();
    render(withEditHandler(<MarkdownEditor ref={ref} defaultValue={ITERATE_CONSUMER_EVALUATED} />));

    const menu = await openNodeMenu();
    // Same rationale as Transpose above: the reason lives in the visible label,
    // not an unreachable `title`.
    const label = within(menu).getByText("Convert to static — needs embedded values");
    const item = label.closest('[role="menuitem"]')!;
    expect(item).toHaveAttribute("aria-disabled", "true");

    const before = ref.current!.getMarkdown();
    await user.click(label);
    // A disabled Radix item never fires `onSelect` — the document is untouched
    // (previously this silently replaced the block with an empty string / no-op
    // with zero user feedback).
    expect(ref.current!.getMarkdown()).toBe(before);
  });
});

describe("IterationDirectiveView — context menu is scoped to the header chrome", () => {
  test("right-click on the header row opens the node menu", async () => {
    render(withEditHandler(<MarkdownEditor defaultValue={PIVOT_WITH_CONSUMER_ATTRS} />));
    const label = await screen.findByText("Pivot");
    fireEvent.contextMenu(label);
    expect(await screen.findByRole("menu")).toBeInTheDocument();
  });

  test("right-click INSIDE the editable template body does not open it (native menu stays reachable)", async () => {
    render(withEditHandler(<MarkdownEditor defaultValue={PIVOT_WITH_CONSUMER_ATTRS} />));
    // Wait for the frame to mount before querying its body.
    await screen.findByText("Pivot");
    const body = document.querySelector(".brand-directive__body");
    expect(body).toBeTruthy();

    fireEvent.contextMenu(body!);
    // Let any (non-)handling settle, then confirm no Radix menu opened — a
    // right-click that hits the ProseMirror content must fall through to the
    // browser's native context menu (spellcheck, Paste, Look Up, Emoji), which
    // jsdom doesn't render but which our own menu must not have hijacked.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
