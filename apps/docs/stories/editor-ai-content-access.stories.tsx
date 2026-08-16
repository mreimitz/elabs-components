// Editor / AI Content Access
// Cross-package composition story: @elabs/components-editor + @elabs/components-ui
// All "AI actions" are LOCAL stub transforms — no model call (D5).
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { useEffect, useRef, useState } from "react";
import {
  monacoContentAccess,
  CodeWorkspace,
  type CodeWorkspaceHandle,
  type EditorFile,
} from "@elabs/components-editor";
import { MarkdownWorkspace, type MarkdownWorkspaceHandle } from "@elabs/components-editor/markdown";
import { Button } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";

// The live handles, captured per render so each story's `play` can drive the
// editor (select text → the AI panel reacts). Refreshed every render so they
// point at the LATEST handle after the editor's async mount.
let codeHandle: CodeWorkspaceHandle | null = null;
let mdHandle: MarkdownWorkspaceHandle | null = null;

// ---------------------------------------------------------------------------
// Stub transforms (stand-ins for AI calls — no model/transport)
// ---------------------------------------------------------------------------

const STUBS = {
  uppercase: (text: string) => text.toUpperCase(),
  exclaim: (text: string) => text.trim() + "!",
  insertTodo: () => "\n\n- [ ] TODO: review this section\n",
  summarize: (text: string) =>
    text.length > 0 ? `[Summary of ${text.split(/\s+/).length} words]` : "(select some text first)",
};

// ---------------------------------------------------------------------------
// Shared AI Actions panel
// ---------------------------------------------------------------------------

interface AIActionsProps {
  hasSelection: boolean;
  summary: string;
  onAddAtCursor: () => void;
  onRewrite: () => void;
  onSummarize: () => void;
}

function AIActionsPanel({
  hasSelection,
  summary,
  onAddAtCursor,
  onRewrite,
  onSummarize,
}: AIActionsProps) {
  return (
    <div className="flex w-52 shrink-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <p className="text-caption font-medium text-muted-foreground">AI Actions (stub)</p>

      <Button size="sm" variant="outline" onClick={onAddAtCursor} className="justify-start">
        Insert TODO at cursor
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={!hasSelection}
        onClick={onRewrite}
        className="justify-start"
      >
        UPPERCASE selection
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={!hasSelection}
        onClick={onSummarize}
        className="justify-start"
      >
        Summarize selection
      </Button>

      <div
        role="status"
        aria-live="polite"
        aria-label="Selection summary"
        className={cn(
          "min-h-[4rem] rounded-md border border-border bg-surface-muted p-2 text-caption text-muted-foreground",
          !hasSelection && "opacity-50",
        )}
      >
        {summary || "Select text to see a summary…"}
      </div>

      <p className="text-meta text-muted-foreground">
        AI buttons are disabled when nothing is selected (driven by{" "}
        <code className="font-mono">onSelectionChange</code>).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeWorkspace story component
// ---------------------------------------------------------------------------

const CODE_FILES: EditorFile[] = [
  {
    path: "src/hello.ts",
    value: `// Select any text, then try the AI actions on the right.
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("world"));
`,
  },
  {
    path: "src/math.ts",
    value: `export function add(a: number, b: number): number {
  return a + b;
}
`,
  },
];

function CodeWorkspaceDemo() {
  const ref = useRef<CodeWorkspaceHandle | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [summary, setSummary] = useState("");

  // Capture the handle via a CALLBACK ref: CodeWorkspace recreates its
  // imperative handle when the active editor mounts (getActiveEditor closes
  // over state), and React re-invokes a callback ref with each new handle. A
  // deps-less effect snapshot would keep a stale pre-mount handle whose
  // getActiveEditor() is null forever (the demo itself never re-renders).
  const captureRef = (h: CodeWorkspaceHandle | null) => {
    ref.current = h;
    codeHandle = h;
  };

  // Subscribe to selection changes via the handle.
  // Re-subscribe when the ref populates (effect runs after mount).
  useEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    const unsub = handle.onSelectionChange((sel) => {
      setHasSelection(!sel.empty);
      if (sel.empty) setSummary("");
    });
    return unsub;
  }, []); // ref.current is stable after mount

  const getAccess = () => {
    const active = ref.current?.getActiveEditor();
    return active ? monacoContentAccess(active) : ref.current;
  };

  return (
    <div className="flex gap-4">
      <div className="h-80 flex-1">
        <CodeWorkspace ref={captureRef} files={CODE_FILES} />
      </div>
      <AIActionsPanel
        hasSelection={hasSelection}
        summary={summary}
        onAddAtCursor={() => getAccess()?.insertAtCursor(STUBS.insertTodo())}
        onRewrite={() => {
          const access = getAccess();
          if (!access) return;
          const { text } = access.getSelection();
          if (text) access.replaceSelection(STUBS.uppercase(text));
        }}
        onSummarize={() => {
          const access = getAccess();
          if (!access) return;
          setSummary(STUBS.summarize(access.getSelection().text));
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MarkdownWorkspace story component
// ---------------------------------------------------------------------------

const MARKDOWN_INITIAL = `# AI Content Access Demo

Select any text in this editor, then click an AI action.

This sentence has **bold** and *italic* formatting — the selection serializes to markdown by default, so "UPPERCASE" of a bold selection yields \`**BOLD**\`.

## How it works

The \`EditorContentAccess\` interface is engine-agnostic: the same four methods work across Monaco (source mode) and Milkdown (WYSIWYG mode).
`;

function MarkdownWorkspaceDemo() {
  const ref = useRef<MarkdownWorkspaceHandle | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [summary, setSummary] = useState("");

  // Callback ref — same stale-handle hazard as CodeWorkspaceDemo above.
  const captureRef = (h: MarkdownWorkspaceHandle | null) => {
    ref.current = h;
    mdHandle = h;
  };

  // Subscribe to selection changes. MarkdownWorkspaceHandle extends EditorContentAccess
  // so we call onSelectionChange directly on the handle.
  useEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    const unsub = handle.onSelectionChange((sel) => {
      setHasSelection(!sel.empty);
      if (sel.empty) setSummary("");
    });
    return unsub;
  }, []);

  return (
    <div className="flex gap-4">
      <div className="h-80 flex-1">
        <MarkdownWorkspace ref={captureRef} defaultValue={MARKDOWN_INITIAL} />
      </div>
      <AIActionsPanel
        hasSelection={hasSelection}
        summary={summary}
        onAddAtCursor={() => ref.current?.insertAtCursor(STUBS.insertTodo())}
        onRewrite={() => {
          const handle = ref.current;
          if (!handle) return;
          const { text } = handle.getSelection();
          if (text) handle.replaceSelection(STUBS.exclaim(text));
        }}
        onSummarize={() => {
          const handle = ref.current;
          if (!handle) return;
          setSummary(STUBS.summarize(handle.getSelection().text));
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Storybook meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Editor/AI Content Access",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
Engine-agnostic \`EditorContentAccess\` interface for AI-driven editing in \`@elabs/components-editor\`.

### API

\`\`\`ts
interface EditorContentAccess {
  getText(): string;
  getSelection(): EditorSelection;      // { text, empty }
  replaceSelection(text: string): void; // rewrite-selection use case
  insertAtCursor(text: string): void;   // add-at-cursor use case
  focus(): void;
  onSelectionChange(listener): () => void; // enable/disable AI buttons
}
\`\`\`

### Adapters

- **\`monacoContentAccess(editor)\`** — wrap a \`MonacoCodeEditor\` ref (also returned by \`CodeWorkspaceHandle.getActiveEditor()\`). Exported from \`@elabs/components-editor\`.
- **\`proseMirrorContentAccess(deps)\`** — wrap a Milkdown view (markdown-fidelity by default: selection serialized to markdown; incoming text parsed as markdown fragment). Exported from \`@elabs/components-editor/markdown\`.

### Markdown fidelity note

In the WYSIWYG editor, \`getSelection().text\` returns the selection serialized to markdown (e.g. \`**bold**\`, not just \`bold\`). Milkdown's serializer may normalize formatting (e.g. \`*\` vs \`_\`) — this matches what the editor itself does on every keystroke. Use \`fidelity: "plainText"\` on the adapter for raw text.

### Mode-switch caveat

\`MarkdownWorkspace.onSelectionChange\` subscribes to the engine active at call time (Monaco in source/split, Milkdown in wysiwyg). Re-subscribe in an effect whose deps include the mode if you need to track across mode changes.

### CodeWorkspace breaking change

\`CodeWorkspace\`'s forwarded ref changed from \`HTMLDivElement\` to \`CodeWorkspaceHandle\`. Replace \`ref.current.scrollIntoView()\` with \`ref.current?.getElement()?.scrollIntoView()\`.
        `,
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCodeWorkspace: Story = {
  name: "CodeWorkspace (Monaco)",
  render: () => <CodeWorkspaceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Monaco's cold boot in the vitest browser (editor chunks + workers) takes
    // ~10s+, so the mount-dependent waits need budgets well past that; the
    // post-boot interaction waits below stay short.
    await waitFor(() => expect(canvasElement.querySelector(".monaco-editor")).toBeTruthy(), {
      timeout: 30000,
    });
    await waitFor(() => expect(codeHandle?.getActiveEditor()).toBeTruthy(), { timeout: 30000 });
    // No selection yet → the AI actions are disabled (onSelectionChange-driven).
    await expect(canvas.getByRole("button", { name: "Summarize selection" })).toBeDisabled();
    // Programmatically select a line — the binding effect forwards the change so
    // the panel reacts (this is the live demonstration of the API).
    codeHandle!
      .getActiveEditor()!
      .setSelection({ startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 30 });
    await waitFor(
      () => expect(canvas.getByRole("button", { name: "Summarize selection" })).toBeEnabled(),
      { timeout: 8000 },
    );
    // Summarize writes a result into the live region.
    await userEvent.click(canvas.getByRole("button", { name: "Summarize selection" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("Selection summary")).toHaveTextContent(/Summary of/),
    );
  },
};

export const WithMarkdownWorkspace: Story = {
  name: "MarkdownWorkspace (Milkdown / Monaco)",
  render: () => <MarkdownWorkspaceDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Default mode is Split → the Monaco source pane drives getEditor().
    // Monaco's cold boot in the vitest browser (editor chunks + workers) takes
    // ~10s+, so the mount-dependent waits need budgets well past that; the
    // post-boot interaction waits below stay short.
    await waitFor(() => expect(canvasElement.querySelector(".monaco-editor")).toBeTruthy(), {
      timeout: 30000,
    });
    await waitFor(() => expect(mdHandle?.getEditor()).toBeTruthy(), { timeout: 30000 });
    await expect(canvas.getByRole("button", { name: "Summarize selection" })).toBeDisabled();
    mdHandle!
      .getEditor()!
      .setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 10 });
    await waitFor(
      () => expect(canvas.getByRole("button", { name: "Summarize selection" })).toBeEnabled(),
      { timeout: 8000 },
    );
    await userEvent.click(canvas.getByRole("button", { name: "Summarize selection" }));
    await waitFor(() =>
      expect(canvas.getByLabelText("Selection summary")).toHaveTextContent(/Summary of/),
    );
  },
};
