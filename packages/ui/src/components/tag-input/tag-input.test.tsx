import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "./tag-input";

describe("TagInput", () => {
  it("renders existing tags", () => {
    render(<TagInput defaultValue={["react", "typescript"]} aria-label="Tags" />);
    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("adds a tag on Enter", async () => {
    const onValueChange = vi.fn();
    render(<TagInput aria-label="Tags" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Tags" });
    await userEvent.type(input, "newtag{Enter}");
    expect(onValueChange).toHaveBeenCalledWith(["newtag"]);
  });

  it("adds a tag on comma delimiter", async () => {
    const onValueChange = vi.fn();
    render(<TagInput aria-label="Tags" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Tags" });
    await userEvent.type(input, "alpha,");
    expect(onValueChange).toHaveBeenCalledWith(["alpha"]);
  });

  it("removes a tag via remove button", async () => {
    const onValueChange = vi.fn();
    render(<TagInput defaultValue={["foo", "bar"]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove foo" }));
    expect(onValueChange).toHaveBeenCalledWith(["bar"]);
  });

  it("removes last tag on Backspace when input is empty", async () => {
    const onValueChange = vi.fn();
    render(
      <TagInput defaultValue={["one", "two"]} aria-label="Tags" onValueChange={onValueChange} />,
    );
    const input = screen.getByRole("textbox", { name: "Tags" });
    await userEvent.click(input);
    await userEvent.keyboard("{Backspace}");
    expect(onValueChange).toHaveBeenCalledWith(["one"]);
  });

  it("does not add duplicate tags by default", async () => {
    const onValueChange = vi.fn();
    render(<TagInput defaultValue={["dup"]} aria-label="Tags" onValueChange={onValueChange} />);
    const input = screen.getByRole("textbox", { name: "Tags" });
    await userEvent.type(input, "dup{Enter}");
    // error should appear
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("allows duplicates when allowDuplicates=true", async () => {
    const onValueChange = vi.fn();
    render(
      <TagInput
        defaultValue={["dup"]}
        aria-label="Tags"
        allowDuplicates
        onValueChange={onValueChange}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Tags" });
    await userEvent.type(input, "dup{Enter}");
    expect(onValueChange).toHaveBeenCalledWith(["dup", "dup"]);
  });

  it("shows validation error message when validate returns a string", async () => {
    render(<TagInput aria-label="Tags" validate={(t) => (t.length < 3 ? "Too short." : true)} />);
    const input = screen.getByRole("textbox", { name: "Tags" });
    await userEvent.type(input, "ab{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Too short.");
  });

  it("enforces max tag count", async () => {
    render(<TagInput defaultValue={["a", "b"]} max={2} aria-label="Tags" />);
    // input should be disabled when at max
    expect(screen.getByRole("textbox", { name: "Tags" })).toBeDisabled();
  });

  it("prevents Enter from submitting a wrapping form", async () => {
    const onSubmit = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <TagInput aria-label="Tags" />
        <button type="submit">Submit</button>
      </form>,
    );
    const input = screen.getByRole("textbox", { name: "Tags" });
    await userEvent.type(input, "hello{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
