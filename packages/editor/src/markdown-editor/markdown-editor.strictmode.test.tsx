import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { MarkdownEditor } from "./markdown-editor";

afterEach(cleanup);

/**
 * THE SPIKE GATE — the #1 risk of vendoring Milkdown is ProseMirror's imperative
 * create/destroy under React 19 StrictMode (dev runs mount → cleanup → mount, so a
 * `destroy()` can fire mid-`create()`). `@milkdown/core` defers destroy until
 * creation settles (editor.ts), so the double-mount must CONVERGE to one editing
 * surface — not crash, leak, or leave two editors. This proves it for our vendored
 * integration before we build the full component on top of it.
 */
test("StrictMode double-mount converges to a single editor", async () => {
  const { container } = render(
    <StrictMode>
      <MarkdownEditor defaultValue="# Hello Workbench" />
    </StrictMode>,
  );

  // Milkdown mounts a real ProseMirror view in jsdom and renders the heading text.
  await waitFor(() => expect(screen.getByText("Hello Workbench")).toBeInTheDocument());

  // After the deferred destroy settles, exactly one editable surface remains.
  await waitFor(
    () => expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(1),
    { timeout: 3000 },
  );
});

test("renders a single editor without StrictMode too", async () => {
  const { container } = render(<MarkdownEditor defaultValue="# Plain mount" />);
  await waitFor(() => expect(screen.getByText("Plain mount")).toBeInTheDocument());
  expect(container.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
});
