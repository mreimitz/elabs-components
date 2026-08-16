import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  JSXPreview,
  JSXPreviewContent,
  JSXPreviewError,
  JSXPreviewSkeleton,
  type JSXPreviewProps,
} from "./jsx-preview";

afterEach(cleanup);

// Props are optional so the map is assignable to react-jsx-parser's
// `components` index signature (it renders against `FunctionComponent<{}>`).
function Stat({ label, value }: { label?: string; value?: string }) {
  return (
    <div>
      <span>{label}</span>
      {value ? <span>{value}</span> : null}
    </div>
  );
}

const allow = { Stat };

function renderPreview(props: Omit<JSXPreviewProps, "components">) {
  return render(
    <JSXPreview components={allow} {...props}>
      <JSXPreviewSkeleton />
      <JSXPreviewContent />
      <JSXPreviewError />
    </JSXPreview>,
  );
}

describe("JSXPreview — settled, valid input", () => {
  it("renders complete JSX with no skeleton and no error", () => {
    renderPreview({ jsx: '<Stat label="Revenue" value="$1.2M" />' });
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$1.2M")).toBeInTheDocument();
    // The skeleton's live region is always mounted but silent (no label) when ready.
    expect(screen.queryByText(/loading preview/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("JSXPreview — not-ready states never flash the error box (loading-states.md)", () => {
  it("shows the skeleton (not an error) for syntactically incomplete input", () => {
    // Ends mid-tag → incomplete, treated as pending, NOT invalid.
    renderPreview({ jsx: '<Stat label="Rev' });
    expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("builds up streamed/incomplete content without an error", () => {
    // Unclosed <div> with a complete child — completeJsxTag closes it.
    renderPreview({ jsx: '<div><Stat label="Revenue" />', isStreaming: true });
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the skeleton while `loading` and nothing has arrived", () => {
    renderPreview({ jsx: "", loading: true });
    expect(screen.getByText(/loading preview/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("JSXPreview — terminal errors", () => {
  it("surfaces the error slot only for settled, complete-but-invalid input", async () => {
    // Tag-complete (self-closing) but the `{)}` expression is a real parse error.
    renderPreview({ jsx: '<Stat label="Revenue" value={)} />' });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
