// @vitest-environment jsdom
/**
 * agent-loop-prompt.test.tsx — locks #566: typing a custom prompt into the textarea and
 * pressing Run must not silently revert the visible text back to the selected prompt.
 *
 * `Harness` mirrors `AgentLoop`'s own state (`agent-loop.tsx` `run()`): `runCount` bumps by
 * one on every `onRun`, exactly the prop change that used to trigger `SyncText`'s discard.
 * The real `@elabs-ai/components-ai` `PromptInput*` primitives are used un-mocked — the bug
 * lived in the interaction between this file's `SyncText` and `PromptInput`'s own
 * clear-on-submit behaviour, so a mock would test nothing.
 */
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentLoopPrompt, type AgentLoopPromptLabels } from "./agent-loop-prompt";
import type { AgentLoopPromptEntry } from "./prompt-map";

const labels: AgentLoopPromptLabels = {
  promptLabel: "Example prompt",
  promptPlaceholder: "Pick an example prompt above",
  selectLabel: "Choose an example prompt",
  onlyListedHint: "Only the listed prompts run.",
  onlyListedTrigger: "Why only the listed prompts?",
  run: "Run",
};

const prompts: AgentLoopPromptEntry[] = [
  { id: "cohort", text: "What chart fits monthly retention by cohort?", calls: [], blocks: [] },
  { id: "dau", text: "Show me the daily active users trend", calls: [], blocks: [] },
];

/** Mirrors `agent-loop.tsx`'s `run()`: `runCount` bumps by one on every `onRun`. */
function Harness() {
  const [selectedId, setSelectedId] = useState(prompts[0]!.id);
  const [runCount, setRunCount] = useState(0);
  return (
    <AgentLoopPrompt
      prompts={prompts}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onRun={() => setRunCount((n) => n + 1)}
      running={false}
      runCount={runCount}
      labels={labels}
    />
  );
}

/** Sets a controlled textarea's value the way a real keystroke does (bypasses React's value
 *  tracker via the native setter, then fires the `input` event React's `onChange` listens for). */
function typeInto(textarea: HTMLTextAreaElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setValue.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("AgentLoopPrompt (issue 566)", () => {
  it("keeps a typed edit visible after Run instead of reverting to the selected prompt", async () => {
    act(() => {
      root.render(<Harness />);
    });
    const textarea = container.querySelector("textarea")!;
    expect(textarea.value).toBe(prompts[0]!.text);

    typeInto(textarea, "Build me a login page with a password reset flow");
    expect(textarea.value).toBe("Build me a login page with a password reset flow");

    // `PromptInput`'s submit handling is async (it awaits an attachment-conversion step even
    // with none to convert) before it clears the provider text and `onRun` bumps `runCount` —
    // the async `act` overload drains that microtask chain so the assertion below observes the
    // settled DOM, the same state a visitor would see.
    const runButton = container.querySelector<HTMLButtonElement>('button[aria-label="Run"]')!;
    await act(async () => {
      runButton.click();
    });

    expect(textarea.value).toBe("Build me a login page with a password reset flow");
  });

  it("still resets the textarea when the visitor picks a different prompt", () => {
    // `AgentLoopPrompt` is prop-driven (D5): the actual Select UI (Radix) is exercised by its
    // own component tests, not re-implemented here. What `SyncText` owns, and this test locks,
    // is its reaction to the resulting `selectedId`/`text` prop change — re-rendering the SAME
    // root with a new `selectedId`, exactly as `AgentLoop` does when `onSelect` fires.
    const render = (selectedId: string) =>
      act(() => {
        root.render(
          <AgentLoopPrompt
            prompts={prompts}
            selectedId={selectedId}
            onSelect={() => {}}
            onRun={() => {}}
            running={false}
            runCount={0}
            labels={labels}
          />,
        );
      });

    render(prompts[0]!.id);
    const textarea = container.querySelector("textarea")!;
    typeInto(textarea, "some half-typed idea");
    expect(textarea.value).toBe("some half-typed idea");

    render(prompts[1]!.id);
    expect(textarea.value).toBe(prompts[1]!.text);
  });
});
