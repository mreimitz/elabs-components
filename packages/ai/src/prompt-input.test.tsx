import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputStop,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "./prompt-input";

/** The canonical composer shape: textarea + a status-aware submit. */
function Harness({
  onSubmit = () => undefined,
  ...submitProps
}: {
  onSubmit?: (message: PromptInputMessage) => void;
} & React.ComponentProps<typeof PromptInputSubmit>) {
  return (
    <PromptInput onSubmit={onSubmit}>
      <PromptInputBody>
        <PromptInputTextarea placeholder="Ask…" />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputSubmit {...submitProps} />
      </PromptInputFooter>
    </PromptInput>
  );
}

describe("PromptInput — empty submissions are blocked", () => {
  it("does not fire onSubmit when Enter is pressed on an empty composer", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not fire onSubmit for whitespace-only text", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "   {Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("leaves the typed value intact when a submit is blocked", async () => {
    // The guard runs BEFORE form.reset() — a later guard would still have
    // wiped the composer while refusing to send.
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    const textarea = screen.getByPlaceholderText("Ask…") as HTMLTextAreaElement;
    await userEvent.type(textarea, "   ");
    await userEvent.type(textarea, "{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea.value).toBe("   ");
  });

  it("DOES submit an attachment with no text (the guard must not over-reach)", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Upload files"), file);

    // No text at all — an attachments-only message is legitimate.
    await userEvent.type(screen.getByPlaceholderText("Ask…"), "{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [expect.objectContaining({ filename: "notes.txt", type: "file" })],
        text: "",
      }),
      expect.anything(),
    );
  });

  it("clears aria-disabled on the send button for an attachment alone", async () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute("aria-disabled", "true");

    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Upload files"), file);

    expect(screen.getByRole("button", { name: "Submit" })).not.toHaveAttribute("aria-disabled");
  });

  it("fires onSubmit with the untrimmed text once there is real content", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText("Ask…"), " hi {Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Only the guard trims — the payload keeps the user's exact text.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ files: [], text: " hi " }),
      expect.anything(),
    );
  });
});

describe("PromptInputSubmit — disabled affordance mirrors the guard", () => {
  it("marks itself aria-disabled at rest and clears it after typing", async () => {
    render(<Harness />);
    const send = screen.getByRole("button", { name: "Submit" });
    // aria-disabled, NOT the native attribute: a focused control that becomes
    // natively disabled is removed from the focus order, dropping focus to
    // <body> after every keyboard submit. It must stay a real tab stop.
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toBeEnabled();

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "hello");
    expect(send).not.toHaveAttribute("aria-disabled");
  });

  it("stays focusable and keeps focus when it becomes not-ready", async () => {
    render(<Harness />);
    const send = screen.getByRole("button", { name: "Submit" });
    send.focus();
    expect(document.activeElement).toBe(send);

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "hi");
    send.focus();
    await userEvent.click(send);

    // The composer clears, the button goes not-ready — and focus must survive.
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).not.toBe(document.body);
  });

  it("returns to aria-disabled after a successful submit clears the composer", async () => {
    render(<Harness />);
    const send = screen.getByRole("button", { name: "Submit" });

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "hello{Enter}");
    expect(send).toHaveAttribute("aria-disabled", "true");
  });

  it("honours an explicit disabled prop natively (consumer opts out of the tab order)", () => {
    render(<Harness disabled />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("does not fire onSubmit when clicked while not-ready", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    // aria-disabled does not block activation — the handler must.
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("stays enabled while generating — the button IS the Stop control", () => {
    render(<Harness status="streaming" onStop={() => undefined} />);
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
  });

  it("stays enabled on error so the user can retry", () => {
    render(<Harness status="error" />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("keeps working outside a PromptInput (no context to read)", () => {
    render(<PromptInputSubmit />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });
});

describe("PromptInput — Enter is blocked while generating (composer empty)", () => {
  it("does not submit on Enter mid-stream when the composer is empty", async () => {
    // Regression: PromptInputSubmit flips to type="button" while generating, so
    // the old `button[type="submit"]` lookup matched nothing and `null?.disabled`
    // (undefined → falsy) let Enter send a second message.
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} status="streaming" onStop={() => undefined} />);

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("marks the generating control with data-generating for that lookup", () => {
    render(<Harness status="streaming" onStop={() => undefined} />);
    expect(screen.getByRole("button", { name: "Stop" })).toHaveAttribute("data-generating", "true");
  });
});

describe("PromptInputSubmit — merged primary-action contract while running (#351)", () => {
  it("stays Stop while running with an empty composer — click calls onStop, never onSubmit", async () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    render(<Harness onSubmit={onSubmit} status="streaming" onStop={onStop} />);

    const control = screen.getByRole("button", { name: "Stop" });
    expect(control).toHaveAttribute("data-action", "stop");
    expect(control).toHaveAttribute("data-generating", "true");

    await userEvent.click(control);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("flips back to Send once the user types during a running turn — click submits, never stops", async () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    render(<Harness onSubmit={onSubmit} status="streaming" onStop={onStop} />);

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "a follow-up");

    const control = screen.getByRole("button", { name: "Submit" });
    expect(control).toHaveAttribute("data-action", "send");
    expect(control).not.toHaveAttribute("data-generating");

    await userEvent.click(control);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("submits on Enter once the user has typed during a running turn (the P0 fix)", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} status="streaming" onStop={() => undefined} />);

    await userEvent.type(screen.getByPlaceholderText("Ask…"), "another one{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ text: "another one" }),
      expect.anything(),
    );
  });

  it("honours an explicit disabled prop as the documented opt-out — Enter does not submit", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} status="streaming" onStop={() => undefined} disabled />);

    const control = screen.getByPlaceholderText("Ask…");
    await userEvent.type(control, "another one{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    // Query broadly: an explicit `disabled` still renders as Send once typed
    // (action flips), but stays disabled either way.
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button).toBeDisabled();
  });
});

describe("PromptInputStop — the composed 'separate' arrangement (#351)", () => {
  function SeparateHarness({
    onSubmit = () => undefined,
    onStop = () => undefined,
    status,
  }: {
    onSubmit?: (message: PromptInputMessage) => void;
    onStop?: () => void;
    status?: React.ComponentProps<typeof PromptInputSubmit>["status"];
  }) {
    return (
      <PromptInput onSubmit={onSubmit}>
        <PromptInputBody>
          <PromptInputTextarea placeholder="Ask…" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputStop status={status} onStop={onStop} />
          <PromptInputSubmit status={status} onStop={onStop} />
        </PromptInputFooter>
      </PromptInput>
    );
  }

  it("renders nothing at rest, and null once the turn finishes", () => {
    render(<SeparateHarness />);
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("keeps PromptInputSubmit as Send even while running with an empty composer, disabled with nothing to send; the Stop control owns stopping", async () => {
    const onStop = vi.fn();
    render(<SeparateHarness status="streaming" onStop={onStop} />);

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toHaveAttribute("data-action", "send");
    expect(submit).not.toHaveAttribute("data-generating");
    // Refused via `aria-disabled` so the control stays focusable — the native
    // attribute would drop focus to <body> after every keyboard send.
    expect(submit).toHaveAttribute("aria-disabled", "true");
    expect(submit).toBeEnabled();

    const stop = screen.getByRole("button", { name: "Stop" });
    await userEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe("PromptInput — tone prop (double-card composer, #254)", () => {
  it("defaults to the surface (muted) inner well — existing usages unaffected", () => {
    const { container } = render(<Harness />);
    const group = container.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(group.className.split(" ")).toContain("bg-surface-muted");
  });

  it("renders a bg-card inner well when tone='card', for the tinted-outer/white-inner look", () => {
    const { container } = render(
      <PromptInput onSubmit={() => undefined} tone="card">
        <PromptInputBody>
          <PromptInputTextarea placeholder="Ask…" />
        </PromptInputBody>
      </PromptInput>,
    );
    const group = container.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(group.className.split(" ")).toContain("bg-card");
    expect(group.className.split(" ")).not.toContain("bg-surface-muted");
  });
});

describe("PromptInputButton — tooltip derives aria-label (#356)", () => {
  it("uses a string tooltip as the accessible name when no aria-label is given", () => {
    render(
      <PromptInputButton tooltip="Voice">
        <svg aria-hidden="true" />
      </PromptInputButton>,
    );
    expect(screen.getByRole("button", { name: "Voice" })).toBeInTheDocument();
  });

  it("uses the tooltip object's `content` string as the accessible name", () => {
    render(
      <PromptInputButton tooltip={{ content: "Record a voice message", shortcut: "⌘R" }}>
        <svg aria-hidden="true" />
      </PromptInputButton>,
    );
    expect(screen.getByRole("button", { name: "Record a voice message" })).toBeInTheDocument();
  });

  it("lets an explicit aria-label win over the tooltip-derived default", () => {
    render(
      <PromptInputButton tooltip="Voice" aria-label="Start voice recording">
        <svg aria-hidden="true" />
      </PromptInputButton>,
    );
    expect(screen.getByRole("button", { name: "Start voice recording" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice" })).not.toBeInTheDocument();
  });

  it("leaves buttons with no tooltip and no explicit aria-label unaffected", () => {
    render(<PromptInputButton>Model</PromptInputButton>);
    expect(screen.getByRole("button", { name: "Model" })).toBeInTheDocument();
  });
});

describe("PromptInputButton — tooltip must not clobber a visible text label (WCAG 2.5.3)", () => {
  it("keeps the VISIBLE text as (or within) the accessible name when the button also has a tooltip", () => {
    render(<PromptInputButton tooltip="Change model">Claude Opus 4</PromptInputButton>);

    // The visible label must survive — a tooltip-derived aria-label may not
    // silently replace it (2.5.3 requires the visible label be contained in
    // the accessible name).
    expect(screen.getByRole("button", { name: "Claude Opus 4" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change model" })).not.toBeInTheDocument();
  });

  it("still derives the accessible name for a genuinely icon-only button (#356 regression)", () => {
    render(
      <PromptInputButton tooltip="Voice">
        <svg aria-hidden="true" />
      </PromptInputButton>,
    );
    expect(screen.getByRole("button", { name: "Voice" })).toBeInTheDocument();
  });

  it("does not let an explicitly-passed aria-label={undefined} clobber the derived name", () => {
    render(
      <PromptInputButton aria-label={undefined} tooltip="Voice">
        <svg aria-hidden="true" />
      </PromptInputButton>,
    );
    expect(screen.getByRole("button", { name: "Voice" })).toBeInTheDocument();
  });

  it("still lets an explicit, DEFINED aria-label win over the derived default", () => {
    render(
      <PromptInputButton aria-label="Start voice recording" tooltip="Voice">
        <svg aria-hidden="true" />
      </PromptInputButton>,
    );
    expect(screen.getByRole("button", { name: "Start voice recording" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice" })).not.toBeInTheDocument();
  });
});
