import { createRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";

afterEach(cleanup);

const DOC = `# Heading

:::card{title="Objective"}

card body text

:::

::metric{label="Scope" value="1,245" description="reports"}
`;

test("parses :::card + ::metric into branded editor chrome", async () => {
  const { container } = render(<MarkdownEditor defaultValue={DOC} />);
  await waitFor(() => {
    expect(container.querySelector(".brand-directive--card")).toBeTruthy();
    expect(container.querySelector(".brand-directive--metric")).toBeTruthy();
  });
});

test("round-trips directives back to markdown (parse → serialize)", async () => {
  const ref = createRef<MarkdownEditorHandle>();
  const { container } = render(<MarkdownEditor ref={ref} defaultValue={DOC} />);
  // Wait until the editor has mounted + rendered the directive node.
  await waitFor(() => expect(container.querySelector(".brand-directive--card")).toBeTruthy());

  const md = ref.current!.getMarkdown();
  expect(md).toContain(":::card");
  expect(md).toContain("card body text");
  expect(md).toContain("::metric");
  expect(md).toContain("Scope");
});

test("renders directives as live @brand components with inline-editable attributes", async () => {
  render(<MarkdownEditor defaultValue={DOC} />);
  // The node-views expose the directive title + metric label/value as editable
  // textboxes — an affordance the old toDOM chrome did not have.
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Card title" })).toBeTruthy());
  expect(screen.getByRole("textbox", { name: "Metric label" })).toBeTruthy();

  const value = screen.getByRole("textbox", { name: "Metric value" });
  expect(value).toBeTruthy();
  expect(value.textContent).toBe("1,245");
});

test("committing an inline edit writes through to the markdown attributes", async () => {
  const ref = createRef<MarkdownEditorHandle>();
  render(<MarkdownEditor ref={ref} defaultValue={DOC} />);

  const value = await screen.findByRole("textbox", { name: "Metric value" });

  // Edit the metric value inline, then commit on blur.
  value.focus();
  value.textContent = "9,999";
  fireEvent.blur(value);

  await waitFor(() => expect(ref.current!.getMarkdown()).toContain('value="9,999"'));
  // The untouched attributes survive the write-through.
  const md = ref.current!.getMarkdown();
  expect(md).toContain('label="Scope"');
  expect(md).not.toContain('value="1,245"');
});

test("#21 — the editable surface has an accessible name (default + override)", async () => {
  const { unmount } = render(<MarkdownEditor defaultValue={DOC} />);
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Markdown editor" })).toBeTruthy(),
  );
  unmount();

  render(<MarkdownEditor defaultValue={DOC} ariaLabel="Notes" />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Notes" })).toBeTruthy());
});

test("#37 — inline-edit textboxes declare single-line (aria-multiline=false)", async () => {
  render(<MarkdownEditor defaultValue={DOC} />);
  const label = await screen.findByRole("textbox", { name: "Metric label" });
  expect(label).toHaveAttribute("aria-multiline", "false");
});

test("#21/#37 — a :::callout title is NOT a heading inside the WYSIWYG flow", async () => {
  const { container } = render(
    <MarkdownEditor
      defaultValue={`# Doc\n\n:::callout{type="warning" title="Heads up"}\n\nbody\n\n:::`}
    />,
  );
  await waitFor(() => expect(container.querySelector(".brand-directive--callout")).toBeTruthy());
  // The callout title is present as an editable textbox, but not a heading.
  expect(screen.getByRole("textbox", { name: "Callout title" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Heads up" })).toBeNull();
});

test("#37 — an unknown container directive is role=note, not an assertive alert", async () => {
  render(<MarkdownEditor defaultValue={`:::mystery\n\nbody\n\n:::`} />);
  await waitFor(() => expect(screen.getByRole("note")).toBeTruthy());
  // It must NOT be an assertive live region (role=alert) that re-announces on re-parse.
  expect(screen.queryByRole("alert")).toBeNull();
});
