import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The dialog embeds a MarkdownWorkspace (Monaco/Milkdown — can't mount in jsdom).
// Mock it with a plain textarea so these tests exercise the DIALOG's save/cancel +
// provider LOGIC (not the editor — that has its own tests + the Storybook render).
vi.mock("../markdown-workspace", () => ({
  MarkdownWorkspace: ({
    value,
    onChange,
    ["aria-label"]: ariaLabel,
  }: {
    value: string;
    onChange: (v: string) => void;
    "aria-label"?: string;
  }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { IterationEditContext } from "./edit-context";
import { IterationTemplateDialog, IterationTemplateProvider } from "./template-dialog";

afterEach(cleanup);

describe("IterationTemplateDialog", () => {
  it("seeds the editor with the template and saves edits", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <IterationTemplateDialog
        open
        onOpenChange={onOpenChange}
        template="**{{item.name}}**"
        onSave={onSave}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Iteration template editor" });
    expect(editor).toHaveValue("**{{item.name}}**");

    await user.clear(editor);
    // (avoid `{{` in user.type — it's the userEvent escape for a literal brace)
    await user.type(editor, "# Edited heading");
    await user.click(screen.getByRole("button", { name: "Save template" }));

    expect(onSave).toHaveBeenCalledWith("# Edited heading");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancel closes without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <IterationTemplateDialog open onOpenChange={onOpenChange} template="t" onSave={onSave} />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("titles + helper copy adapt to the pivot kind", () => {
    render(
      <IterationTemplateDialog
        open
        onOpenChange={() => {}}
        template=""
        onSave={() => {}}
        kind="pivot"
      />,
    );
    expect(screen.getByText(/Edit pivot template/i)).toBeInTheDocument();
  });
});

/** A tiny consumer that fires an edit request through the context. */
function EditTrigger({ onSave }: { onSave: (t: string) => void }) {
  const onEdit = useContext(IterationEditContext);
  return (
    <button onClick={() => onEdit?.({ kind: "iterate", template: "seed", onSave })}>open</button>
  );
}

describe("IterationTemplateProvider", () => {
  it("opens the dialog on an edit request and routes the save back", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <IterationTemplateProvider>
        <EditTrigger onSave={onSave} />
      </IterationTemplateProvider>,
    );

    await user.click(screen.getByRole("button", { name: "open" }));
    const editor = await screen.findByRole("textbox", { name: "Iteration template editor" });
    expect(editor).toHaveValue("seed");

    await user.click(screen.getByRole("button", { name: "Save template" }));
    expect(onSave).toHaveBeenCalledWith("seed");
  });
});
