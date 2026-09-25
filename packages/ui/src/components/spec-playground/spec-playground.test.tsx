import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lineOfParseError, locateJsonPath, parseJsonPath } from "./locate-json-path";
import { SpecPlayground, type SpecPlaygroundValidation } from "./spec-playground";

interface Spec {
  title: string;
}

const validate = (json: unknown): SpecPlaygroundValidation<Spec> =>
  typeof (json as Spec | null)?.title === "string"
    ? { ok: true, spec: json as Spec }
    : { ok: false, errors: [{ path: "$.title", code: "missing", message: "title is required" }] };

const renderSpec = (spec: Spec) => <p data-testid="rendered">{spec.title}</p>;

afterEach(() => vi.useRealTimers());

describe("SpecPlayground", () => {
  it("renders a valid spec with a valid status", () => {
    render(
      <SpecPlayground defaultValue='{"title":"Hello"}' validate={validate} render={renderSpec} />,
    );
    expect(screen.getByTestId("rendered")).toHaveTextContent("Hello");
    expect(screen.getByRole("status")).toHaveTextContent("Valid");
  });

  it("validates after the debounce, lists the error and keeps the last valid render", () => {
    vi.useFakeTimers();
    render(
      <SpecPlayground
        defaultValue='{"title":"Hello"}'
        validate={validate}
        render={renderSpec}
        debounceMs={250}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Spec (JSON)" });
    fireEvent.change(editor, { target: { value: '{\n  "name": "x"\n}' } });
    // Not yet: validation trails the edit.
    expect(screen.getByRole("status")).toHaveTextContent("Valid");
    act(() => void vi.advanceTimersByTime(250));
    expect(screen.getByRole("status")).toHaveTextContent("1 error");
    const error = screen.getByRole("button", { name: /\$\.title/ });
    expect(error).toHaveAttribute("data-code", "missing");
    expect(screen.getByText("Showing last valid")).toBeInTheDocument();
    expect(screen.getByTestId("rendered")).toHaveTextContent("Hello");
    expect(editor).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(editor, { target: { value: '{"title":"Fixed"}' } });
    act(() => void vi.advanceTimersByTime(250));
    expect(screen.getByRole("status")).toHaveTextContent("Valid");
    expect(screen.queryByText("Showing last valid")).toBeNull();
    expect(screen.getByTestId("rendered")).toHaveTextContent("Fixed");
  });

  it("reports a parse error and moves the caret to an error's line", () => {
    const onErrorSelect = vi.fn();
    render(
      <SpecPlayground
        defaultValue={'{\n  "other": 1\n}'}
        validate={validate}
        render={renderSpec}
        onErrorSelect={onErrorSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /\$\.title/ }));
    expect(onErrorSelect).toHaveBeenCalledWith(expect.objectContaining({ code: "missing" }), 1);
  });

  it("shows a parse-error status for text that is not JSON", () => {
    render(<SpecPlayground defaultValue="{ nope" validate={validate} render={renderSpec} />);
    expect(screen.getByRole("status")).toHaveTextContent("Parse error");
    expect(screen.getByText("Nothing valid to render yet.")).toBeInTheDocument();
  });

  it("uses the editor slot instead of the textarea when given", () => {
    render(
      <SpecPlayground
        defaultValue='{"title":"Hello"}'
        validate={validate}
        render={renderSpec}
        editor={<div data-testid="custom-editor" />}
      />,
    );
    expect(screen.getByTestId("custom-editor")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("gives two id-less instances distinct error-list ids", () => {
    const { container } = render(
      <>
        <SpecPlayground defaultValue="{ nope" validate={validate} render={renderSpec} />
        <SpecPlayground defaultValue="{ nope" validate={validate} render={renderSpec} />
      </>,
    );
    const [first, second] = screen.getAllByRole("textbox", { name: "Spec (JSON)" });
    const firstDescribedBy = first!.getAttribute("aria-describedby");
    const secondDescribedBy = second!.getAttribute("aria-describedby");
    expect(firstDescribedBy).toBeTruthy();
    expect(secondDescribedBy).toBeTruthy();
    expect(firstDescribedBy).not.toBe(secondDescribedBy);
    // Each textarea's own list actually exists and contains that list's errors — not the other
    // instance's.
    expect(container.querySelector(`#${firstDescribedBy}`)).not.toBeNull();
    expect(container.querySelector(`#${secondDescribedBy}`)).not.toBeNull();
    within(document.getElementById(firstDescribedBy!)!).getByRole("button");
    within(document.getElementById(secondDescribedBy!)!).getByRole("button");
  });
});

describe("locateJsonPath", () => {
  const text =
    '{\n  "root": {\n    "children": [\n      "a",\n      { "props": {} }\n    ]\n  }\n}';

  it("parses both path styles", () => {
    expect(parseJsonPath("$.tiles[3].layout.w")).toEqual(["tiles", 3, "layout", "w"]);
    expect(parseJsonPath("root.children[2].props")).toEqual(["root", "children", 2, "props"]);
  });

  it("finds the deepest existing prefix", () => {
    expect(locateJsonPath(text, "root.children[1].props.label")).toBe(5);
    expect(locateJsonPath(text, "root.children")).toBe(3);
    expect(locateJsonPath(text, "$.missing")).toBe(1);
    expect(locateJsonPath("{ nope", "$.a")).toBeUndefined();
  });
});

describe("lineOfParseError", () => {
  // A double comma, like V8's own `Unexpected token ','` example — no `line`/`position` at all.
  const doubleComma = '{\n  "root": {\n    "children": [,, "x"]\n  }\n}';

  it("reads an explicit line straight from a 'line N column M' message", () => {
    expect(
      lineOfParseError(doubleComma, "Unexpected token } in JSON at position 3 (line 2 column 1)"),
    ).toBe(2);
  });

  it("reads an explicit offset from a 'position N' message with no line", () => {
    expect(lineOfParseError(doubleComma, "Unexpected token } in JSON at position 14")).toBe(3);
  });

  it("locates a line for Chromium's position-free 'Unexpected token' shape", () => {
    // The exact shape from #560: no "line"/"position" anywhere in the message.
    const message = 'Unexpected token \',\', "{"root": {"childre"... is not valid JSON';
    expect(lineOfParseError(doubleComma, message)).toBe(3);
  });

  it("defaults to the last line for 'Unexpected end of JSON input'", () => {
    expect(lineOfParseError(doubleComma, "Unexpected end of JSON input")).toBe(5);
  });
});
