import { createRef } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";

afterEach(cleanup);

async function mount(doc: string) {
  const ref = createRef<MarkdownEditorHandle>();
  const { container } = render(<MarkdownEditor ref={ref} defaultValue={doc} />);
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")?.textContent).toContain("Hello"),
  );
  return ref;
}

test("insertAtCursor lands a one-line fragment INLINE, not as a new block", async () => {
  const ref = await mount("Hello\n");
  ref.current!.focus();
  ref.current!.insertAtCursor("${{variables.target}} **bold**");
  await waitFor(() =>
    expect(ref.current!.getMarkdown()).toContain("${{variables.target}} **bold**Hello"),
  );
  // One paragraph — the fragment joined the existing line.
  const md = ref.current!.getMarkdown().trim();
  expect(md.split(/\n\s*\n/)).toHaveLength(1);
  expect(md).toContain("Hello");
});

test("insertAtCursor keeps multi-block markdown as blocks", async () => {
  const ref = await mount("Hello\n");
  ref.current!.focus();
  ref.current!.insertAtCursor("# Title\n\nBody");
  await waitFor(() => expect(ref.current!.getMarkdown()).toContain("# Title"));
  expect(ref.current!.getMarkdown()).toContain("Body");
});
