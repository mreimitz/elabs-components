import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./composer";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputProps,
} from "./prompt-input";

describe("Composer", () => {
  it("renders the default status line and placeholder, and no model control at all", () => {
    render(<Composer />);

    expect(screen.getByText("Awaiting your input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask me anything…")).toBeInTheDocument();
    // The `model` prop and its hard-coded "Claude Opus 4" pill are GONE: a
    // composer must not show a model name it cannot change. The slot is
    // `modelPicker`, and it renders nothing unless you fill it.
    expect(screen.queryByText("Claude Opus 4")).not.toBeInTheDocument();
    // …and none of the four optional slots renders unless it is asked for.
    expect(document.querySelector('[data-slot="model-picker"]')).toBeNull();
    expect(document.querySelector('[data-slot="prompt-input-mode"]')).toBeNull();
    expect(document.querySelector('[data-slot="prompt-input-effort"]')).toBeNull();
    expect(document.querySelector('[data-slot="prompt-input-slash"]')).toBeNull();
  });

  it("accepts a custom status and placeholder", () => {
    render(<Composer status="Thinking…" placeholder="Ask the agent…" />);

    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask the agent…")).toBeInTheDocument();
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
    // The frame keeps its border in BOTH tones: on light it's redundant
    // (the fill already separates it from the page), but under high decoration the
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

describe("Composer — the four optional control slots (RM-006)", () => {
  const MODES = [
    { id: "auto", label: "Auto", description: "Acts without asking." },
    { id: "plan", label: "Plan first", description: "Proposes a plan first." },
  ];
  const LEVELS = [
    { id: "low", label: "Low" },
    { id: "high", label: "High" },
  ];
  const COMMANDS = [
    { name: "help", description: "Show available commands" },
    { name: "clear", description: "Clear the conversation" },
  ];

  // jsdom does not implement `Element.prototype.scrollIntoView`, and `cmdk`
  // (which renders the slash palette's list) calls it unconditionally whenever
  // the highlight moves. Same local no-op stub `prompt-input-slash.test.tsx`
  // uses — `vitest.setup.ts` deliberately does not stub it globally.
  let originalScrollIntoView: typeof Element.prototype.scrollIntoView;

  beforeEach(() => {
    originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("renders modelPicker in the tools cluster, before mode and effort", () => {
    render(
      <Composer
        modelPicker={<button type="button">Sonnet 4.5</button>}
        mode={{ modes: MODES }}
        effort={{ levels: LEVELS, "aria-label": "Reasoning effort" }}
      />,
    );

    // attach · modelPicker · mode · effort — the TerminalComposer arrangement,
    // asserted as real sibling order rather than "all four are somewhere".
    const attach = screen.getByRole("button", { name: "Attach files" });
    const cluster = attach.parentElement!;
    const children = Array.from(cluster.children);

    expect(children).toHaveLength(4);
    expect(children[0]).toBe(attach);
    expect(children[1]).toBe(screen.getByRole("button", { name: "Sonnet 4.5" }));
    expect(children[2]).toHaveAttribute("data-slot", "prompt-input-mode");
    expect(children[3]).toHaveAttribute("data-slot", "prompt-input-effort");
  });

  it("mode renders a PromptInputMode whose selection reaches onValueChange", async () => {
    const onValueChange = vi.fn();
    render(<Composer mode={{ modes: MODES, onValueChange }} />);

    await userEvent.click(screen.getByRole("button", { name: /Auto/ }));
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /Plan first/ }));

    expect(onValueChange).toHaveBeenCalledWith("plan");
  });

  it("effort renders a PromptInputEffort whose selection reaches onValueChange", async () => {
    const onValueChange = vi.fn();
    render(
      <Composer effort={{ levels: LEVELS, "aria-label": "Reasoning effort", onValueChange }} />,
    );

    // The scale is a real radiogroup, named by the consumer's own vocabulary.
    expect(screen.getByRole("radiogroup", { name: "Reasoning effort" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "High" }));

    expect(onValueChange).toHaveBeenCalledWith("high");
  });

  it("slashCommands swaps in the palette textarea and fires onSlashCommand on select", async () => {
    const onSlashCommand = vi.fn();
    render(<Composer slashCommands={COMMANDS} onSlashCommand={onSlashCommand} />);

    const field = screen.getByPlaceholderText("Ask me anything…");
    expect(field).toHaveAttribute("data-slot", "prompt-input-slash-textarea");

    await userEvent.click(field);
    await userEvent.keyboard("/he");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(onSlashCommand).toHaveBeenCalledWith(expect.objectContaining({ name: "help" }));
    expect(field).toHaveValue("/help ");
  });

  it("keeps the submitProps.disabled guard while a slash palette is open", async () => {
    const onSubmit = vi.fn();
    render(
      <Composer onSubmit={onSubmit} slashCommands={COMMANDS} submitProps={{ disabled: true }} />,
    );

    const field = screen.getByPlaceholderText("Ask me anything…");
    await userEvent.click(field);
    await userEvent.keyboard("/he");
    expect(await screen.findByRole("listbox")).toBeInTheDocument();

    // Enter with the palette open only ever INSERTS the command — it must never
    // reach the form, and the refused send must not destroy the text either.
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    // …and Enter once the palette has closed is still refused by the guard.
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field).toHaveValue("/help ");
  });

  it("clears its controlled slash text after an accepted submit", async () => {
    const onSubmit = vi.fn();
    render(<Composer onSubmit={onSubmit} slashCommands={COMMANDS} />);

    const field = screen.getByPlaceholderText("Ask me anything…");
    await userEvent.type(field, "ship it{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ text: "ship it" }),
      expect.anything(),
    );
    // PromptInput's form.reset() cannot reach React state — Composer clears its
    // own copy, or the sent text would render straight back into the field.
    expect(field).toHaveValue("");
  });

  it("renders the named slots alongside a `tools` override rather than swallowing them", () => {
    render(
      <Composer
        tools={<button type="button">Web search</button>}
        mode={{ modes: MODES }}
        effort={{ levels: LEVELS, "aria-label": "Reasoning effort" }}
      />,
    );

    expect(screen.getByRole("button", { name: "Web search" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Attach files" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="prompt-input-mode"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="prompt-input-effort"]')).not.toBeNull();
  });
});

// ── the port from a hand-rolled PromptInput footer (RM-007, #146) ────────────
// `registry/blocks/ai-chat-shell/ai-chat.tsx` used to assemble its own
// `PromptInput` + `PromptInputBody` + `PromptInputFooter` + `PromptInputSubmit`
// and now renders `<Composer>`. The claim that made the port safe is that
// `Composer` is a pure re-arrangement of the same primitive: the submit payload,
// the attachment surface and the stop affordance are unchanged. That is an A/B
// claim, so it gets an A/B test — the old arrangement is inlined here and driven
// identically to the new one.

describe("Composer — equivalence with a hand-rolled PromptInput footer", () => {
  const HandRolled = ({ onSubmit }: { onSubmit: PromptInputProps["onSubmit"] }) => (
    <PromptInput onSubmit={onSubmit}>
      <PromptInputBody>
        <PromptInputTextarea placeholder="Send a message…" />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools />
        <PromptInputSubmit />
      </PromptInputFooter>
    </PromptInput>
  );

  /** Type `text` into whichever arrangement is mounted, then submit with Enter. */
  const drive = async (text: string) => {
    const field = screen.getByPlaceholderText("Send a message…");
    await userEvent.type(field, `${text}{Enter}`);
    return field;
  };

  it("hands onSubmit the identical PromptInputMessage — text untrimmed, files empty", async () => {
    const before = vi.fn();
    const { unmount } = render(<HandRolled onSubmit={before} />);
    await drive("  what changed overnight?  ");
    unmount();

    const after = vi.fn();
    render(<Composer onSubmit={after} placeholder="Send a message…" />);
    await drive("  what changed overnight?  ");

    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    // Deep-equal on the payload, not just "it was called": the block trims the
    // text ITSELF, so an arrangement that silently trimmed (or dropped `files`)
    // would change what a consumer's `send()` receives.
    expect(after.mock.calls[0]![0]).toEqual(before.mock.calls[0]![0]);
    expect(after.mock.calls[0]![0]).toEqual({ text: "  what changed overnight?  ", files: [] });
  });

  it("submits nothing on an empty composer, exactly as the hand-rolled footer did", async () => {
    const before = vi.fn();
    const { unmount } = render(<HandRolled onSubmit={before} />);
    await drive("   ");
    unmount();

    const after = vi.fn();
    render(<Composer onSubmit={after} placeholder="Send a message…" />);
    await drive("   ");

    expect(before).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("offers no attachment or dictation affordance when the port switches both off", () => {
    render(<Composer onSubmit={vi.fn()} showAttach={false} showVoice={false} />);

    expect(screen.queryByRole("button", { name: "Attach files" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voice" })).not.toBeInTheDocument();
    // The hand-rolled footer rendered an empty `PromptInputTools`; the ported
    // one must be just as empty, or the block would show a dead control.
    expect(screen.getAllByRole("button")).toHaveLength(1); // the send button only
  });

  it("never presents a Stop while the block passes no onStop and a settled sendStatus", () => {
    render(<Composer onSubmit={vi.fn()} sendStatus="ready" showAttach={false} showVoice={false} />);

    const submit = screen.getByRole("button", { name: "Submit" });
    expect(submit).toHaveAttribute("data-action", "send");
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });
});

// ── shortcut hints change with a busy state (#107) ───────────────────────────
// The acceptance criterion, verbatim: "Composer shortcut hints change with a
// busy state." `shortcuts` is the always-shown row (opt-in — nothing renders
// unless it's supplied, matching every other Composer slot); `cancelShortcut`
// is a SECOND, busy-only hint that appears once the composer is actually
// generating AND there is a real Stop affordance to describe (`onStop`),
// mirroring `TerminalComposer`'s `canCancel = busy && Boolean(onStop)` shape.
describe("Composer — shortcut hints change with a busy state (#107)", () => {
  it("renders no shortcuts row at all when neither prop is supplied", () => {
    render(<Composer />);
    expect(document.querySelector('[data-slot="composer-shortcuts"]')).toBeNull();
  });

  it("renders the supplied shortcut hints as plain, non-interactive text", () => {
    render(
      <Composer
        shortcuts={[
          { keys: "Enter", label: "send" },
          { keys: "Shift+Enter", label: "newline" },
        ]}
      />,
    );

    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.getByText("send")).toBeInTheDocument();
    expect(screen.getByText("Shift+Enter")).toBeInTheDocument();
    expect(screen.getByText("newline")).toBeInTheDocument();
  });

  it("appends the cancel hint only once the composer goes busy, and drops it again at rest", () => {
    const { rerender } = render(
      <Composer
        cancelShortcut={{ keys: "Esc", label: "cancel" }}
        onStop={() => undefined}
        sendStatus="ready"
        shortcuts={[{ keys: "Enter", label: "send" }]}
      />,
    );
    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.queryByText("Esc")).not.toBeInTheDocument();
    expect(screen.queryByText("cancel")).not.toBeInTheDocument();

    rerender(
      <Composer
        cancelShortcut={{ keys: "Esc", label: "cancel" }}
        onStop={() => undefined}
        sendStatus="streaming"
        shortcuts={[{ keys: "Enter", label: "send" }]}
      />,
    );
    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();
    expect(screen.getByText("cancel")).toBeInTheDocument();

    rerender(
      <Composer
        cancelShortcut={{ keys: "Esc", label: "cancel" }}
        onStop={() => undefined}
        sendStatus="ready"
        shortcuts={[{ keys: "Enter", label: "send" }]}
      />,
    );
    expect(screen.queryByText("Esc")).not.toBeInTheDocument();
  });

  it("never shows the cancel hint while busy if there is no onStop to describe", () => {
    render(<Composer cancelShortcut={{ keys: "Esc", label: "cancel" }} sendStatus="streaming" />);
    expect(screen.queryByText("Esc")).not.toBeInTheDocument();
  });

  // The accessible-name trap (#153's failure mode, avoided here by construction):
  // the shortcut row renders as PLAIN SIBLINGS of PromptInputSubmit, never
  // nested inside it, so the Kbd chip cannot concatenate into the button's
  // name.
  //
  // `PromptInputSubmit` sets `aria-label` unconditionally
  // (`prompt-input.tsx`'s `action === "stop" ? t("ai.promptInput.stop") :
  // t("ai.promptInput.submit")`), so an accessible-name assertion alone is
  // VACUOUS here: an explicit `aria-label` wins the accname computation over
  // descendant content, so `toHaveAccessibleName("Stop")` would pass
  // identically whether the Kbd row sat beside the button or was nested
  // inside it (confirmed by mutation-testing this file — nesting a `<span>`
  // child in the button left this assertion green). The property actually
  // being relied on is DOM containment: the shortcut row must never be a
  // descendant of the submit button. Assert that directly.
  it("keeps the shortcut row OUT of the submit button's DOM subtree (#153-style trap)", () => {
    render(
      <Composer
        cancelShortcut={{ keys: "Esc", label: "cancel" }}
        onStop={() => undefined}
        sendStatus="streaming"
        shortcuts={[{ keys: "Enter", label: "send" }]}
      />,
    );

    const stopButton = screen.getByRole("button", { name: "Stop" });
    const shortcutRow = document.querySelector<HTMLElement>('[data-slot="composer-shortcuts"]');
    expect(shortcutRow).not.toBeNull();
    // The row renders at all (sanity check the fixture is exercising the
    // real thing, not an empty composer).
    expect(screen.getByText("Esc")).toBeInTheDocument();
    // The actual lock: the button never contains the row (would fail the
    // instant the row moved inside `PromptInputSubmit`), and the row never
    // contains the button (rules out the trap from the other direction).
    expect(stopButton).not.toContainElement(shortcutRow);
    expect(shortcutRow).not.toContainElement(stopButton);
  });
});
