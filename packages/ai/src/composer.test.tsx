import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./composer";

describe("Composer", () => {
  it("renders the default status line, placeholder, and model pill", () => {
    render(<Composer />);

    expect(screen.getByText("Awaiting your input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask me anything…")).toBeInTheDocument();
    expect(screen.getByText("Claude Opus 4")).toBeInTheDocument();
  });

  it("accepts a custom status and placeholder, and hides the model pill when model is null", () => {
    render(<Composer status="Thinking…" placeholder="Ask the agent…" model={null} />);

    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask the agent…")).toBeInTheDocument();
    expect(screen.queryByText("Claude Opus 4")).not.toBeInTheDocument();
  });

  it("renders suggestion chips and fires onSuggestionClick with the chosen suggestion", async () => {
    const onSuggestionClick = vi.fn();
    render(<Composer suggestions={["Summary", "Code"]} onSuggestionClick={onSuggestionClick} />);

    const chip = screen.getByRole("button", { name: "Summary" });
    await userEvent.click(chip);
    expect(onSuggestionClick).toHaveBeenCalledWith("Summary");
  });
});

describe("Composer — tone prop (double-card arrangement, #254)", () => {
  // The outer frame is the `.rounded-xl` wrapper; `InputGroup` (the well) is
  // `.rounded-md` (data-slot="input-group") nested inside PromptInput's own
  // <form>, so the two are queried independently rather than via parentElement.
  it("defaults to the outer bg-card frame around the standard well — existing usages unaffected", () => {
    const { container } = render(<Composer />);
    const frame = container.querySelector(".rounded-xl") as HTMLElement;
    expect(frame.className.split(" ")).toContain("bg-card");
    expect(frame.className.split(" ")).toContain("border");

    const well = container.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(well.className.split(" ")).toContain("bg-surface-muted");
  });

  it("swaps to an outer bg-surface-muted frame around a bg-card well when tone='card'", () => {
    const { container } = render(<Composer tone="card" />);
    const frame = container.querySelector(".rounded-xl") as HTMLElement;
    expect(frame.className.split(" ")).toContain("bg-surface-muted");
    expect(frame.className.split(" ")).not.toContain("bg-card");
    // The frame keeps its border in BOTH tones: on qlik-bright it's redundant
    // (the fill already separates it from the page), but under `blueprint` the
    // decoration dial zeros the shadow — the border becomes the SOLE structural
    // cue there, so it must never be dropped for either tone (see #254 review).
    expect(frame.className.split(" ")).toContain("border");

    const well = container.querySelector('[data-slot="input-group"]') as HTMLElement;
    expect(well.className.split(" ")).toContain("bg-card");
    expect(well.className.split(" ")).not.toContain("bg-surface-muted");
  });
});

describe("Composer send button — status affordances", () => {
  const arrowUpIn = (el: HTMLElement) => el.querySelector("svg.lucide-arrow-up");

  it("shows the ArrowUp send glyph at rest", () => {
    render(<Composer />);
    expect(arrowUpIn(screen.getByRole("button", { name: "Submit" }))).not.toBeNull();
  });

  it("swaps to the Stop affordance while streaming and calls onStop", async () => {
    const onStop = vi.fn();
    render(<Composer sendStatus="streaming" onStop={onStop} />);

    const stop = screen.getByRole("button", { name: "Stop" });
    // The regression: Composer's ArrowUp used to override the square Stop glyph,
    // so the control was live (onStop fired) but looked like "send".
    expect(arrowUpIn(stop)).toBeNull();

    await userEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner, not the send arrow, while submitted", () => {
    render(<Composer sendStatus="submitted" />);
    expect(arrowUpIn(screen.getByRole("button", { name: "Stop" }))).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows the error glyph on error, and keeps the control clickable to retry", () => {
    render(<Composer sendStatus="error" />);
    const button = screen.getByRole("button", { name: "Submit" });
    expect(arrowUpIn(button)).toBeNull();
    expect(button).toBeEnabled();
  });

  it("marks send aria-disabled at rest, and clears it once text is typed", async () => {
    render(<Composer />);
    const send = screen.getByRole("button", { name: "Submit" });
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toBeEnabled(); // still a real tab stop — see PromptInputSubmit

    await userEvent.type(screen.getByPlaceholderText("Ask me anything…"), "hello");
    expect(send).not.toHaveAttribute("aria-disabled");
  });

  it("does not submit an empty message on Enter", async () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} />);

    await userEvent.type(screen.getByPlaceholderText("Ask me anything…"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the ArrowUp send glyph once the user types during a running turn (#351)", async () => {
    const onSubmit = vi.fn();
    render(<Composer sendStatus="streaming" onSubmit={onSubmit} onStop={() => undefined} />);

    await userEvent.type(screen.getByPlaceholderText("Ask me anything…"), "a follow-up");

    const control = screen.getByRole("button", { name: "Submit" });
    expect(arrowUpIn(control)).not.toBeNull();

    await userEvent.click(control);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("Composer — submitProps reaches the send button", () => {
  it("forwards disabled, closing BOTH the click and the Enter path", async () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} submitProps={{ disabled: true }} />);

    const send = screen.getByRole("button", { name: "Submit" });
    expect(send).toBeDisabled();

    // The data-loss path this exists to close: PromptInput.handleSubmit calls
    // form.reset() as soon as it ACCEPTS a submit, so refusing inside onSubmit
    // has already destroyed the user's text. Disabling must stop the submit
    // from being accepted at all — via Enter as well as via click, since
    // PromptInputTextarea's Enter handler is a separate route to requestSubmit().
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "a question worth not losing{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("a question worth not losing");
  });

  it("leaves disabled UNSET when submitProps omits it, so autoDisabled still governs", async () => {
    render(<Composer submitProps={{ id: "send" }} />);
    const send = document.getElementById("send")!;
    // Empty composer → the library's own guard must still refuse. It does so via
    // `aria-disabled`, NOT the native attribute, so the control stays a real
    // focusable tab stop (a natively-disabled button drops focus to <body> after
    // every keyboard send). A defaulted literal `false` for `disabled` would
    // still defeat the guard, which is why Composer leaves it undefined.
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toBeEnabled();

    await userEvent.type(screen.getByRole("textbox"), "hi");
    expect(send).not.toHaveAttribute("aria-disabled");
  });

  it("extends the round shape rather than replacing it when given className", () => {
    render(<Composer submitProps={{ className: "ring-2" }} />);
    const send = screen.getByRole("button", { name: "Submit" });
    expect(send).toHaveClass("rounded-full");
    expect(send).toHaveClass("ring-2");
  });
});

describe("Composer — icon-only buttons have an accessible name (#356)", () => {
  it("exposes 'Attach files' and 'Voice' as accessible names, derived from the tooltip alone", () => {
    render(<Composer />);

    // Both controls are icon-only (no visible text) — their ONLY name source
    // is `tooltip`. Before the fix these had no accessible name at all.
    expect(screen.getByRole("button", { name: "Attach files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voice" })).toBeInTheDocument();
  });
});
