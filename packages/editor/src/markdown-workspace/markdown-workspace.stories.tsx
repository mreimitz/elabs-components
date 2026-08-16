import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useRef, useState } from "react";
import { Button, ToggleGroup, ToggleGroupItem } from "@elabs/components-ui";
import type { EditorCompletionProvider } from "../lib/editor-completions";
import { BRAND_SLASH_COMMANDS, type SlashCommand } from "../markdown-editor/slash";
import { MarkdownWorkspace, type MarkdownWorkspaceHandle } from "./markdown-workspace";

const SAMPLE = `# Migration Plan

Author on the left, branded preview on the right.

:::callout{type="warning" title="Heads up"}
This block renders as an Alert in the preview.
:::

::metric{label="Scope" value="1,245" description="frozen report candidates"}
`;

const meta = {
  title: "Editor/MarkdownWorkspace",
  component: MarkdownWorkspace,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The hybrid markdown surface: one value, three modes (Source = Monaco, Split = " +
          "source + branded preview, Preview-edit = Milkdown WYSIWYG), switched via a " +
          "@elabs/components-ui ToggleGroup. The MarkdownToolbar is exercised in Source/Split modes.",
      },
    },
  },
} satisfies Meta<typeof MarkdownWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Split: Story = {
  render: function SplitStory() {
    const [value, setValue] = useState(SAMPLE);
    return (
      <div className="h-[520px] border-t border-border">
        <MarkdownWorkspace value={value} onChange={setValue} defaultMode="split" />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The mode switch (radiogroup) and formatting toolbar render immediately.
    await expect(canvas.getByRole("radio", { name: "Split" })).toBeInTheDocument();
    await expect(canvas.getByRole("toolbar", { name: "Markdown formatting" })).toBeInTheDocument();
  },
};

const LONG = `# Focus writing

${Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1} — keep typing and the caret stays in a vertical band while the page moves underneath; every paragraph except the active one dims.`).join("\n\n")}
`;

/**
 * Focus writing (Ulysses Phase A): typewriter scrolling + paragraph focus in
 * the WYSIWYG mode. The "Focus" toggle in the mode row turns it on; the
 * active paragraph stays at full opacity while the rest dim.
 */
export const FocusWriting: Story = {
  render: function FocusWritingStory() {
    const [value, setValue] = useState(LONG);
    return (
      <div className="h-[520px] border-t border-border">
        <MarkdownWorkspace
          value={value}
          onChange={setValue}
          defaultMode="wysiwyg"
          defaultFocusWriting
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = await canvas.findByRole("button", { name: "Focus writing" });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  },
};

/**
 * `focusWriting={false}` — the host opts out of the Focus writing toggle. The
 * toggle is completely hidden (no keyboard path), and focus-writing state is
 * forced off. The mode switch remains and WYSIWYG editing is unaffected. (#270)
 */
export const NoFocusToggle: Story = {
  tags: ["autodocs"],
  render: function NoFocusToggleStory() {
    const [value, setValue] = useState(LONG);
    return (
      <div className="h-[520px] border-t border-border">
        <MarkdownWorkspace
          value={value}
          onChange={setValue}
          defaultMode="wysiwyg"
          focusWriting={false}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The Focus toggle must NOT be present.
    await expect(canvas.queryByRole("button", { name: /focus writing/i })).toBeNull();
    // The mode switch is still rendered.
    await expect(canvas.getByRole("radio", { name: "Preview-edit" })).toBeInTheDocument();
  },
};

/**
 * `modeSwitch={false}` — the host supplies its own mode switch via
 * `toolbarActions`. The built-in Source / Split / Preview-edit toggle group is
 * hidden in both toolbar branches so the host owns the view switch. Controlled
 * `mode`/`onModeChange` still drive the panes. (#272)
 */
export const HostOwnedModeSwitch: Story = {
  tags: ["autodocs"],
  render: function HostOwnedModeSwitchStory() {
    const [value, setValue] = useState(SAMPLE);
    const [activeMode, setActiveMode] = useState<"source" | "split">("split");
    return (
      <div className="h-[520px] border-t border-border">
        <MarkdownWorkspace
          value={value}
          onChange={setValue}
          mode={activeMode}
          onModeChange={(m) => {
            if (m === "source" || m === "split") setActiveMode(m);
          }}
          modeSwitch={false}
          toolbarActions={
            <ToggleGroup
              type="single"
              value={activeMode}
              onValueChange={(m) => {
                if (m === "source" || m === "split") setActiveMode(m);
              }}
              variant="segmented"
              size="sm"
              className="rounded-md p-0.5"
            >
              <ToggleGroupItem value="source" aria-label="Source" className="h-6 px-2 text-caption">
                Source
              </ToggleGroupItem>
              <ToggleGroupItem value="split" aria-label="Split" className="h-6 px-2 text-caption">
                Split
              </ToggleGroupItem>
            </ToggleGroup>
          }
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Built-in mode items must NOT be present.
    await expect(canvas.queryByRole("radio", { name: "Preview-edit" })).toBeNull();
    // The host-supplied controls render in the trailing slot.
    await expect(canvas.getByRole("radio", { name: "Source" })).toBeInTheDocument();
    await expect(canvas.getByRole("radio", { name: "Split" })).toBeInTheDocument();
  },
};

// A multi-screen document for exercising revealLine / scrollToHeading.
const MULTI_SCREEN = `# Introduction

${Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} in the introduction section.`).join("\n\n")}

## Getting Started

${Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} in getting started.`).join("\n\n")}

## Configuration

${Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} in configuration.`).join("\n\n")}

## Advanced Usage

${Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} in advanced usage.`).join("\n\n")}

## Troubleshooting

${Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} in troubleshooting.`).join("\n\n")}
`;

/**
 * `MarkdownWorkspaceHandle` — imperative `revealLine` + `scrollToHeading` (#273).
 *
 * Use the buttons to call `ref.current.revealLine(N)` or
 * `ref.current.scrollToHeading(slug)` programmatically. In Source/Split mode
 * the Monaco editor scrolls to the exact line; in WYSIWYG (Preview-edit) mode
 * the nearest heading scrolls into view (best-effort, heading-anchored).
 *
 * `getElement()` returns the root `<div>` (the old `HTMLDivElement` ref
 * access); `getEditor()` returns the live Monaco instance (null in WYSIWYG).
 */
export const RevealLine: Story = {
  tags: ["autodocs"],
  render: function RevealLineStory() {
    const ref = useRef<MarkdownWorkspaceHandle>(null);
    const [value, setValue] = useState(MULTI_SCREEN);
    const [log, setLog] = useState("");

    const logAction = (msg: string) => setLog(msg);

    return (
      <div className="flex h-[600px] flex-col gap-2 border-t border-border p-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              ref.current?.revealLine(1);
              logAction("revealLine(1) — Introduction heading");
            }}
          >
            Line 1 (Introduction)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // "## Getting Started" is around line 12 in the stripped body
              ref.current?.scrollToHeading("getting-started");
              logAction('scrollToHeading("getting-started")');
            }}
          >
            Heading: Getting Started
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              ref.current?.scrollToHeading("advanced-usage");
              logAction('scrollToHeading("advanced-usage")');
            }}
          >
            Heading: Advanced Usage
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              ref.current?.scrollToHeading("troubleshooting");
              logAction('scrollToHeading("troubleshooting")');
            }}
          >
            Heading: Troubleshooting
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const el = ref.current?.getElement();
              logAction(`getElement() → ${el ? el.tagName + "#" + el.dataset.testid : "null"}`);
            }}
          >
            getElement()
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ed = ref.current?.getEditor();
              logAction(`getEditor() → ${ed ? "Monaco instance" : "null (WYSIWYG mode)"}`);
            }}
          >
            getEditor()
          </Button>
        </div>
        {log && (
          <p className="text-caption text-muted-foreground" data-testid="reveal-log">
            {log}
          </p>
        )}
        <div className="min-h-0 flex-1">
          <MarkdownWorkspace ref={ref} value={value} onChange={setValue} defaultMode="source" />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Buttons render immediately.
    await expect(
      canvas.getByRole("button", { name: "Heading: Getting Started" }),
    ).toBeInTheDocument();
    // Click scrollToHeading — the log updates (Monaco scrolls in the real browser).
    await userEvent.click(canvas.getByRole("button", { name: "Heading: Getting Started" }));
    await expect(canvas.getByTestId("reveal-log")).toHaveTextContent("getting-started");
    // getElement() resolves to the workspace root div.
    await userEvent.click(canvas.getByRole("button", { name: "getElement()" }));
    await expect(canvas.getByTestId("reveal-log")).toHaveTextContent("markdown-workspace");
  },
};

// Source doc with a trailing blank line to type the slash on.
const SLASH_SAMPLE = `# Block menu in the source editor

Put the caret on the blank line below and type \`/\`, or use the button.

`;

/**
 * **Type \`/\` to open the block menu in the Monaco SOURCE pane** — the
 * conflict-free trigger (no keybinding), mirroring the WYSIWYG \`/\` menu. A \`/\`
 * at a line start (or after whitespace) opens the branded listbox at the caret;
 * the \`/\` is replaced by the block you pick (Esc removes it, leaving the doc
 * untouched). The story's play step inserts a \`/\` to open it on load — you can
 * also just type \`/\` in the editor.
 */
export const SourceTypedSlash: Story = {
  name: "Source: type / to insert a block",
  tags: ["autodocs"],
  render: function SourceTypedSlashStory() {
    const ref = useRef<MarkdownWorkspaceHandle>(null);
    const [value, setValue] = useState(SLASH_SAMPLE);
    return (
      <div className="flex h-[560px] flex-col gap-2 border-t border-border p-2">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ed = ref.current?.getEditor();
              const model = ed?.getModel();
              if (!ed || !model) return; // no-op until Monaco has mounted
              const line = model.getLineCount();
              ed.focus();
              ed.setPosition({ lineNumber: line, column: 1 });
              ed.executeEdits("demo", [
                {
                  range: {
                    startLineNumber: line,
                    startColumn: 1,
                    endLineNumber: line,
                    endColumn: 1,
                  },
                  text: "/",
                },
              ]);
            }}
          >
            Type / (insert a slash)
          </Button>
          <p className="text-caption text-muted-foreground">
            Or click into the editor and type / at the start of a line. Type to filter, ↑/↓ + Enter
            to insert, Esc to dismiss.
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <MarkdownWorkspace ref={ref} value={value} onChange={setValue} defaultMode="source" />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector(".monaco-editor")).toBeTruthy(), {
      timeout: 8000,
    });
    const trigger = canvas.getByRole("button", { name: "Type / (insert a slash)" });
    // Click until the menu opens. Before Monaco is ready the click is a no-op (no
    // stray `/`); once open, the guard stops further clicks.
    await waitFor(
      async () => {
        if (!canvas.queryByRole("listbox", { name: "Insert block" })) {
          await userEvent.click(trigger);
        }
        expect(canvas.getByRole("listbox", { name: "Insert block" })).toBeInTheDocument();
      },
      { timeout: 8000 },
    );
    await expect(
      within(canvas.getByRole("listbox", { name: "Insert block" })).getByText("Card"),
    ).toBeInTheDocument();
  },
};

/**
 * **Hotkey** path (#271): \`slashMenu.shortcut\` opens the SAME menu. The default is
 * **⌘⇧O** (free in Chrome/macOS) — NOT \`Mod-/\`, which Monaco binds to "Toggle Line
 * Comment". ⚠️ ⌘⇧O / Ctrl-Shift-O is the bookmarks shortcut in Firefox and on
 * Windows/Linux Chrome, so override \`slashMenu.shortcut\` (or rely on typing \`/\`)
 * for cross-browser apps. The play fires the bound command to open it on load.
 */
export const SourceSlashHotkey: Story = {
  name: "Source: ⌘⇧O hotkey",
  tags: ["autodocs"],
  render: function SourceSlashHotkeyStory() {
    const ref = useRef<MarkdownWorkspaceHandle>(null);
    const [value, setValue] = useState(SLASH_SAMPLE);
    return (
      <div className="flex h-[560px] flex-col gap-2 border-t border-border p-2">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ed = ref.current?.getEditor();
              ed?.focus();
              ed?.getAction("brand.openSlashMenu")?.run();
            }}
          >
            Open block menu (⌘⇧O)
          </Button>
          <p className="text-caption text-muted-foreground">
            Press ⌘⇧O with the editor focused (Chrome/macOS) or click the button. Override
            slashMenu.shortcut for Firefox / Windows.
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <MarkdownWorkspace ref={ref} value={value} onChange={setValue} defaultMode="source" />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector(".monaco-editor")).toBeTruthy(), {
      timeout: 8000,
    });
    const trigger = canvas.getByRole("button", { name: "Open block menu (⌘⇧O)" });
    await waitFor(
      async () => {
        if (!canvas.queryByRole("listbox", { name: "Insert block" })) {
          await userEvent.click(trigger);
        }
        expect(canvas.getByRole("listbox", { name: "Insert block" })).toBeInTheDocument();
      },
      { timeout: 8000 },
    );
  },
};

// ---------------------------------------------------------------------------
// #283 — declarative completion-provider API (`completions`)
// ---------------------------------------------------------------------------

const COMPLETIONS_SAMPLE = `# Completions: [[wikilink]] autocomplete (#283)

Click the button to type the [[ trigger at the end of this line, or place the
caret here yourself and type it — no monaco-editor import in this story.

`;

// A tiny in-memory "note index" the provider searches — entirely consumer-owned
// (candidates, filtering, and insertText are the app's job; the library only
// registers the provider and renders/inserts the result). Zero `monaco-editor`
// imports appear anywhere in this story.
const NOTE_TITLES = ["Onboarding guide", "Release notes", "Roadmap", "Testing notes"];

/** Pure matcher — a real consumer would use a shared, tested helper like this. */
function matchWikilinks(lineText: string, column: number): string[] {
  const before = lineText.slice(0, column - 1);
  const match = /\[\[([^[\]]*)$/.exec(before);
  if (!match) return [];
  const query = (match[1] ?? "").toLowerCase();
  return NOTE_TITLES.filter((title) => title.toLowerCase().includes(query));
}

/**
 * **`completions` prop (#283)** — a declarative `[[wikilink]]` autocomplete
 * provider, wired with ZERO `monaco-editor` imports in this story. The library
 * owns the Monaco `registerCompletionItemProvider` registration (registered
 * once, refcounted across mounted workspaces, disposed with the last one) and
 * renders Monaco's OWN themed suggest widget — no custom popup on this path.
 * Works in both Source and Split (the pane rendering Monaco either way).
 *
 * The play step verifies the part that is THIS library's responsibility end to
 * end in a real browser: typing `[[` reaches the registered provider with the
 * correct live context, which resolves the right candidates (logged below the
 * editor). Whether Monaco's OWN native suggest popup paints itself in any given
 * host is Monaco's own long-tested internal behavior, not new code — open this
 * story in the Storybook UI to see it render live.
 */
export const CompletionsWikilink: Story = {
  name: "Completions: [[wikilink]] autocomplete",
  tags: ["autodocs"],
  render: function CompletionsWikilinkStory() {
    const ref = useRef<MarkdownWorkspaceHandle>(null);
    const [value, setValue] = useState(COMPLETIONS_SAMPLE);
    const [log, setLog] = useState("(not triggered yet)");

    const provider: EditorCompletionProvider = {
      id: "wikilink",
      triggerCharacters: ["["],
      provide: ({ lineText, column }) => {
        const matches = matchWikilinks(lineText, column);
        setLog(matches.length > 0 ? matches.join(", ") : "(no match at this caret)");
        return matches.map((title) => ({ label: title, insertText: `${title}]]` }));
      },
    };

    const insertTrigger = async () => {
      const ed = ref.current?.getEditor();
      const model = ed?.getModel();
      if (!ed || !model) return; // no-op until Monaco has mounted
      const line = model.getLineCount();
      ed.focus();
      // Two SEPARATE single-character edits (not one 2-char insert), a tick
      // apart — mirrors real typing: the library's force-open listener only
      // recognizes a genuine single-char insert as "the trigger character was
      // just typed", and a stray simultaneous pair doesn't give the FIRST
      // (empty-result) request time to settle before the second.
      for (const char of ["[", "["]) {
        const column = model.getLineContent(line).length + 1;
        ed.setPosition({ lineNumber: line, column });
        ed.executeEdits("demo", [
          {
            range: {
              startLineNumber: line,
              startColumn: column,
              endLineNumber: line,
              endColumn: column,
            },
            text: char,
          },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    };
    return (
      <div className="flex h-[560px] flex-col gap-2 border-t border-border p-2">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={insertTrigger}>
            Type [[ (trigger suggestions)
          </Button>
          <p className="text-caption text-muted-foreground">
            Or click into the editor and type [[ yourself. ↑/↓ + Enter to insert.
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <MarkdownWorkspace
            ref={ref}
            value={value}
            onChange={setValue}
            defaultMode="split"
            completions={[provider]}
          />
        </div>
        {/* Proves the end-to-end wiring (trigger detected → provider called with
            the live caret context → candidates resolved) independent of
            whether Monaco's own suggest popup happens to be visible when this
            runs headless. */}
        <p data-testid="wikilink-log" className="text-caption text-muted-foreground">
          Candidates: {log}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector(".monaco-editor")).toBeTruthy(), {
      timeout: 8000,
    });
    const trigger = canvas.getByRole("button", { name: "Type [[ (trigger suggestions)" });
    await userEvent.click(trigger);
    await waitFor(
      () =>
        expect(canvas.getByTestId("wikilink-log")).toHaveTextContent(
          "Onboarding guide, Release notes, Roadmap, Testing notes",
        ),
      { timeout: 8000 },
    );
  },
};

// ---------------------------------------------------------------------------
// #299 — run-only slash commands (runInSource) in the source pane
// ---------------------------------------------------------------------------

const RUN_ONLY_SAMPLE = `# Run-only slash commands (#299)

Put the caret on the blank line below and type \`/\`, then choose "Ask AI".

`;

const askAiCommand: SlashCommand = {
  id: "ask-ai",
  label: "Ask AI",
  group: "Demo",
  description: "No snippet — runs directly via runInSource",
  keywords: ["ai", "ask"],
  // WYSIWYG (Milkdown) — this story only exercises the source pane, but every
  // SlashCommand still needs `run` (unchanged by #299).
  run: () => {},
  // Source pane (#299): strips the typed `/query`, then this fires with the
  // live editor + the engine-agnostic content access.
  runInSource: ({ content }) => {
    content.insertAtCursor("_(AI answer would go here)_");
  },
};

/**
 * **`runInSource` (#299)** — a run-only command (no `snippet`) that used to be
 * WYSIWYG-only now works in the Monaco SOURCE pane too. Selecting "Ask AI"
 * strips the typed `/query`, then calls `runInSource` with the live editor +
 * engine-agnostic content access — the 12 default (snippet-bearing) commands
 * are unchanged and still insert their snippet.
 */
export const SourceRunOnlyCommand: Story = {
  name: "Source: run-only command (runInSource)",
  tags: ["autodocs"],
  render: function SourceRunOnlyCommandStory() {
    const ref = useRef<MarkdownWorkspaceHandle>(null);
    const [value, setValue] = useState(RUN_ONLY_SAMPLE);
    return (
      <div className="flex h-[560px] flex-col gap-2 border-t border-border p-2">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const ed = ref.current?.getEditor();
              const model = ed?.getModel();
              if (!ed || !model) return; // no-op until Monaco has mounted
              const line = model.getLineCount();
              ed.focus();
              ed.setPosition({ lineNumber: line, column: 1 });
              ed.executeEdits("demo", [
                {
                  range: {
                    startLineNumber: line,
                    startColumn: 1,
                    endLineNumber: line,
                    endColumn: 1,
                  },
                  text: "/",
                },
              ]);
            }}
          >
            Type / (insert a slash)
          </Button>
          <p className="text-caption text-muted-foreground">
            "Ask AI" has no snippet — only runInSource — yet still appears + runs here.
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <MarkdownWorkspace
            ref={ref}
            value={value}
            onChange={setValue}
            defaultMode="source"
            slashMenu={{ commands: [askAiCommand, ...BRAND_SLASH_COMMANDS] }}
          />
        </div>
        {/* The document's live text, for a robust play-step assertion — scanning
            Monaco's own rendered `.view-line` spans directly is fragile
            (syntax-highlighting can split a run across sibling nodes). */}
        <p data-testid="run-only-log" className="sr-only">
          {value}
        </p>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector(".monaco-editor")).toBeTruthy(), {
      timeout: 8000,
    });
    const trigger = canvas.getByRole("button", { name: "Type / (insert a slash)" });
    await waitFor(
      async () => {
        if (!canvas.queryByRole("listbox", { name: "Insert block" })) {
          await userEvent.click(trigger);
        }
        expect(canvas.getByRole("listbox", { name: "Insert block" })).toBeInTheDocument();
      },
      { timeout: 8000 },
    );
    const listbox = canvas.getByRole("listbox", { name: "Insert block" });
    await expect(within(listbox).getByText("Ask AI")).toBeInTheDocument();
    await userEvent.click(within(listbox).getByText("Ask AI"));
    await waitFor(
      () => expect(canvas.getByTestId("run-only-log")).toHaveTextContent("AI answer would go here"),
      { timeout: 8000 },
    );
  },
};
