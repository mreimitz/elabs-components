import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyValueEditor, type KeyValueRow } from "./key-value-editor";

describe("KeyValueEditor", () => {
  it("renders one key/value input pair per row", () => {
    render(
      <KeyValueEditor
        defaultValue={[
          { key: "A", value: "1" },
          { key: "B", value: "2" },
        ]}
      />,
    );
    expect(screen.getByLabelText("Key 1")).toHaveValue("A");
    expect(screen.getByLabelText("Value 1")).toHaveValue("1");
    expect(screen.getByLabelText("Key 2")).toHaveValue("B");
    expect(screen.getByLabelText("Value 2")).toHaveValue("2");
  });

  it("renders a real empty state for zero rows", () => {
    render(<KeyValueEditor defaultValue={[]} />);
    expect(screen.getByText("No entries yet.")).toBeInTheDocument();
  });

  it("adds a row via the Add row button", async () => {
    const onValueChange = vi.fn();
    render(<KeyValueEditor defaultValue={[]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add row/i }));
    expect(onValueChange).toHaveBeenCalledWith([{ key: "", value: "", secret: false }]);
  });

  it("edits a row's key and value", async () => {
    const onValueChange = vi.fn();
    render(
      <KeyValueEditor defaultValue={[{ key: "", value: "" }]} onValueChange={onValueChange} />,
    );
    await userEvent.type(screen.getByLabelText("Key 1"), "X");
    expect(onValueChange).toHaveBeenLastCalledWith([{ key: "X", value: "" }]);
  });

  it("removes a row via the remove button", async () => {
    const onValueChange = vi.fn();
    render(
      <KeyValueEditor
        defaultValue={[
          { key: "A", value: "1" },
          { key: "B", value: "2" },
        ]}
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove row 1" }));
    expect(onValueChange).toHaveBeenCalledWith([{ key: "B", value: "2" }]);
  });

  // ── Security: masking ─────────────────────────────────────────────────

  it("does not render a reveal toggle for a non-secret row", () => {
    render(<KeyValueEditor defaultValue={[{ key: "REGION", value: "us-east-1" }]} />);
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "text");
    expect(screen.queryByRole("button", { name: /reveal/i })).not.toBeInTheDocument();
  });

  it("masks a secret row's value via type=password until revealed", () => {
    render(
      <KeyValueEditor
        defaultValue={[{ key: "API_KEY", value: "sk-super-secret", secret: true }]}
      />,
    );
    const valueInput = screen.getByLabelText("Value 1");
    expect(valueInput).toHaveAttribute("type", "password");
  });

  it("reveals the value on toggle click, then hides it again", async () => {
    render(<KeyValueEditor defaultValue={[{ key: "API_KEY", value: "sk-1234", secret: true }]} />);
    const valueInput = screen.getByLabelText("Value 1");
    await userEvent.click(screen.getByRole("button", { name: "Reveal value 1" }));
    expect(valueInput).toHaveAttribute("type", "text");
    expect(valueInput).toHaveValue("sk-1234");

    await userEvent.click(screen.getByRole("button", { name: "Hide value 1" }));
    expect(valueInput).toHaveAttribute("type", "password");
  });

  it("never exposes the raw secret via title/aria-label/aria-valuetext while masked", () => {
    const secret = "sk-super-secret-value";
    const { container } = render(
      <KeyValueEditor defaultValue={[{ key: "API_KEY", value: secret, secret: true }]} />,
    );
    const html = container.innerHTML;
    expect(html).not.toContain(`title="${secret}"`);
    expect(html).not.toContain(`aria-label="${secret}"`);
    expect(html).not.toContain(`aria-valuetext="${secret}"`);
    // The reveal button's own accessible name never carries the secret text.
    const revealBtn = screen.getByRole("button", { name: "Reveal value 1" });
    expect(revealBtn).not.toHaveAccessibleName(secret);
  });

  it("preserves a row's own reveal state when an earlier row is removed", async () => {
    render(
      <KeyValueEditor
        defaultValue={[
          { key: "A", value: "one", secret: true },
          { key: "B", value: "two", secret: true },
        ]}
      />,
    );
    // Reveal row 2's ("B") value.
    await userEvent.click(screen.getByRole("button", { name: "Reveal value 2" }));
    expect(screen.getByLabelText("Value 2")).toHaveAttribute("type", "text");

    // Remove row 1 ("A") — row 2 ("B") shifts down to index 0 (label "Value 1").
    await userEvent.click(screen.getByRole("button", { name: "Remove row 1" }));

    // "B" is the SAME row the user explicitly revealed — its reveal state
    // must follow it, not reset just because an earlier row was removed.
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "text");
  });

  it("never leaves a NEW row at a shifted position incorrectly revealed", async () => {
    render(
      <KeyValueEditor
        defaultValue={[
          { key: "A", value: "one", secret: true },
          { key: "B", value: "two", secret: true },
        ]}
      />,
    );
    // Reveal row 1's ("A") value, then remove row 1 itself.
    await userEvent.click(screen.getByRole("button", { name: "Reveal value 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove row 1" }));

    // "B" now occupies position 1 but was NEVER revealed by the user — it
    // must render masked, not inherit the removed row's reveal state.
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "password");
  });

  // The reveal stamp fails CLOSED for any row-list change this component did
  // not itself perform — an index alone would unmask a DIFFERENT row's secret.

  it("re-masks when a controlled parent PREPENDS a row under a revealed one", async () => {
    function Harness() {
      const [rows, setRows] = useState<KeyValueRow[]>([
        { key: "A", value: "revealed-me", secret: true },
        { key: "B", value: "sk-TOP-SECRET", secret: true },
      ]);
      return (
        <>
          <button onClick={() => setRows((r) => [{ key: "Z", value: "zzz", secret: true }, ...r])}>
            prepend
          </button>
          <KeyValueEditor value={rows} onValueChange={setRows} />
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Reveal value 1" }));
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByRole("button", { name: "prepend" }));
    // Index 1 is now "Z", a row the user never revealed.
    expect(screen.getByLabelText("Key 1")).toHaveValue("Z");
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "password");
  });

  it("re-masks when a controlled parent REORDERS the rows", async () => {
    function Harness() {
      const [rows, setRows] = useState<KeyValueRow[]>([
        { key: "A", value: "aaa", secret: true },
        { key: "B", value: "sk-TOP-SECRET", secret: true },
      ]);
      return (
        <>
          <button onClick={() => setRows((r) => [...r].reverse())}>reverse</button>
          <KeyValueEditor value={rows} onValueChange={setRows} />
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Reveal value 1" }));
    await userEvent.click(screen.getByRole("button", { name: "reverse" }));
    expect(screen.getByLabelText("Key 1")).toHaveValue("B");
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "password");
  });

  it("never unmasks a row when a controlled parent REJECTS a removal", async () => {
    const rows: KeyValueRow[] = [
      { key: "A", value: "aaa", secret: true },
      { key: "B", value: "sk-TOP-SECRET", secret: true },
    ];
    render(<KeyValueEditor value={rows} onValueChange={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Reveal value 2" }));
    // The parent ignores the change, so the rows do NOT shift — the re-indexed
    // reveal must not land on row 1.
    await userEvent.click(screen.getByRole("button", { name: "Remove row 1" }));
    expect(screen.getByLabelText("Key 1")).toHaveValue("A");
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Value 2")).toHaveAttribute("type", "password");
  });

  it("keeps a revealed secret revealed while the user edits it", async () => {
    render(<KeyValueEditor defaultValue={[{ key: "API_KEY", value: "sk-1", secret: true }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Reveal value 1" }));
    await userEvent.type(screen.getByLabelText("Value 1"), "23");
    expect(screen.getByLabelText("Value 1")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Value 1")).toHaveValue("sk-123");
  });

  it("supports the controlled mode via value/onValueChange", async () => {
    const onValueChange = vi.fn();
    render(<KeyValueEditor value={[]} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("button", { name: /add row/i }));
    expect(onValueChange).toHaveBeenCalledWith([{ key: "", value: "", secret: false }]);
  });

  it("is disabled when disabled prop is set", () => {
    render(<KeyValueEditor defaultValue={[{ key: "A", value: "1" }]} disabled />);
    expect(screen.getByLabelText("Key 1")).toBeDisabled();
    expect(screen.getByLabelText("Value 1")).toBeDisabled();
    expect(screen.getByRole("button", { name: /add row/i })).toBeDisabled();
  });

  it("never blocks paste into the value field", async () => {
    render(<KeyValueEditor defaultValue={[{ key: "A", value: "" }]} />);
    const valueInput = screen.getByLabelText("Value 1") as HTMLInputElement;
    expect(valueInput.onpaste).toBeNull();
  });
});
