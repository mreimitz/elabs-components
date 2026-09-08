"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import { CodeEditor, type MonacoCodeEditor } from "../code-editor";
import { CopyButton } from "../copy-button";
import {
  monacoContentAccess,
  type EditorContentAccess,
  type EditorSelection,
} from "../lib/editor-content-access";

export interface EditorFile {
  /** Unique path/name; shown (basename) on the tab and used as the model path. */
  path: string;
  /** Monaco language id. Inferred from the extension when omitted. */
  language?: string;
  /** File content. */
  value: string;
}

export interface CodeWorkspaceProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Open files, one tab each. */
  files: EditorFile[];
  /** Controlled active file path. */
  activePath?: string;
  /** Initial active path for uncontrolled use. Defaults to the first file. */
  defaultActivePath?: string;
  /** Called when the active tab changes. */
  onActivePathChange?: (path: string) => void;
  /** Called on every edit with the file path + new content. */
  onFileChange?: (path: string, value: string) => void;
  /** Render all files read-only. */
  readOnly?: boolean;
  /** Workspace height. Number → px. Defaults to "100%". */
  height?: number | string;
}

const EXT_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  md: "markdown",
  py: "python",
  sql: "sql",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  sh: "shell",
};

const basename = (path: string) => path.split("/").pop() || path;

/**
 * Radix composes each `TabsContent`'s DOM id from the `Tabs`/`TabsTrigger`
 * `value` (see #154): a raw `file.path` leaks `/`, `.`, spaces and non-ASCII
 * characters straight into that id, which is what a screen reader gets back
 * via `aria-controls`. `path` stays the display label and the lookup key in
 * component state (`active`); this is only ever a DOM-id-safe Tabs value.
 *
 * The encoding is INJECTIVE and depends only on the path — never on the
 * file's position in `files`. Every character outside `[A-Za-z0-9-]` becomes
 * `_<hex code point>_`, and `_` itself is never emitted literally, so the
 * mapping is reversible and two distinct paths can never produce the same
 * value ("a/b" → `tab-a_2f_b`, "a.b" → `tab-a_2e_b`). An index-derived value
 * would have been collision-safe too, but it changes when the list is
 * reordered or a file is inserted, which re-keys the active `TabsContent` and
 * throws away Monaco's selection, scroll position and undo history on an
 * otherwise harmless `files` update.
 */
function tabIdForFile(path: string): string {
  let out = "";
  for (const char of path) {
    out += /[A-Za-z0-9-]/.test(char) ? char : `_${char.codePointAt(0)!.toString(16)}_`;
  }
  return `tab-${out}`;
}

function inferLanguage(file: EditorFile): string {
  if (file.language) return file.language;
  const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANGUAGE[ext] ?? "plaintext";
}

/**
 * Imperative handle exposed via `CodeWorkspace`'s `ref`.
 *
 * **Migration note:** the forwarded `ref` type changed from `HTMLDivElement` to
 * `CodeWorkspaceHandle` (mirrors the #273 `MarkdownWorkspaceHandle` precedent).
 * Replace any `ref.current` / `ref.current.scrollIntoView()` DOM access with
 * `ref.current?.getElement()`. This is the only breaking change in this work.
 */
export interface CodeWorkspaceHandle extends EditorContentAccess {
  /**
   * The live Monaco editor for the currently active tab, or `null` while booting
   * or when no files are open. Consumers needing the full Monaco API can use this
   * and pass it to `monacoContentAccess(handle.getActiveEditor()!)`.
   */
  getActiveEditor(): MonacoCodeEditor | null;
  /**
   * The workspace root DOM element. Preserves the old `HTMLDivElement` ref access
   * that existed before the ref-type change (#273 `MarkdownWorkspace` playbook).
   */
  getElement(): HTMLDivElement | null;
}

/** No-op EditorContentAccess returned when no Monaco editor is mounted. */
const NULL_ACCESS: EditorContentAccess = {
  getText: () => "",
  getSelection: () => ({ text: "", empty: true }),
  replaceSelection: () => undefined,
  insertAtCursor: () => undefined,
  focus: () => undefined,
  onSelectionChange: () => () => undefined,
};

/**
 * Multi-file editor shell: brand-ui `Tabs` for the file bar above a single
 * {@link CodeEditor} that swaps to the active file. This is the "reuse our
 * components for the chrome" surface — Tabs/Button are ours; the editing surface
 * is Monaco. Edits bubble through `onFileChange`.
 *
 * The forwarded `ref` exposes a {@link CodeWorkspaceHandle} (not `HTMLDivElement`).
 * Use `ref.current?.getElement()` to access the root DOM node.
 */
export const CodeWorkspace = forwardRef<CodeWorkspaceHandle, CodeWorkspaceProps>(
  function CodeWorkspace(
    {
      files,
      activePath,
      defaultActivePath,
      onActivePathChange,
      onFileChange,
      readOnly = false,
      height = "100%",
      className,
      style,
      ...props
    },
    ref,
  ) {
    const [internalActive, setInternalActive] = useState(defaultActivePath ?? files[0]?.path ?? "");
    const isControlled = activePath !== undefined;
    const requested = isControlled ? activePath : internalActive;
    const activeFile = files.find((f) => f.path === requested) ?? files[0];
    const active = activeFile?.path ?? "";

    // DOM-id-safe Tabs value per file (#154); `path` stays the lookup key.
    const tabs = files.map((file) => ({ file, id: tabIdForFile(file.path) }));
    const activeTabId = tabs.find((t) => t.file.path === active)?.id ?? "";

    // The root div ref (getElement() preserves old HTMLDivElement access).
    const rootRef = useRef<HTMLDivElement | null>(null);

    // The live Monaco editor for the active tab. Nulled when there is no active file.
    const [activeEditor, setActiveEditor] = useState<MonacoCodeEditor | null>(null);

    // Defensive: if the active file is removed (no `activeFile`), null the held instance
    // so getActiveEditor() and content-access methods don't act on a disposed editor.
    useEffect(() => {
      if (!activeFile) setActiveEditor(null);
    }, [activeFile]);

    // A STABLE listener set for onSelectionChange. The handle adds/removes here;
    // the binding effect below forwards the ACTIVE editor's selection changes into
    // it. This is what makes a subscribe-in-mount-effect survive the editor's async
    // mount (and tab swaps): the consumer subscribes once; binding re-attaches as
    // `activeEditor` changes. (Delegating onSelectionChange to a call-time snapshot
    // would bind to the not-yet-mounted editor and silently never fire.)
    const [selectionListeners] = useState(() => new Set<(sel: EditorSelection) => void>());
    useEffect(() => {
      if (!activeEditor) return;
      const unsub = monacoContentAccess(activeEditor).onSelectionChange((sel) =>
        selectionListeners.forEach((l) => l(sel)),
      );
      return unsub;
    }, [activeEditor, selectionListeners]);

    const selectTab = useCallback(
      (path: string) => {
        if (!isControlled) setInternalActive(path);
        onActivePathChange?.(path);
      },
      [isControlled, onActivePathChange],
    );

    useImperativeHandle(ref, () => {
      const access = activeEditor ? monacoContentAccess(activeEditor) : NULL_ACCESS;
      return {
        getActiveEditor: () => activeEditor,
        getElement: () => rootRef.current,
        getText: () => access.getText(),
        getSelection: () => access.getSelection(),
        replaceSelection: (text: string) => access.replaceSelection(text),
        insertAtCursor: (text: string) => access.insertAtCursor(text),
        focus: () => access.focus(),
        // Stable set (not the call-time `access`) so a subscription survives the
        // editor's async mount + tab swaps; the binding effect forwards events.
        onSelectionChange: (listener) => {
          selectionListeners.add(listener);
          return () => selectionListeners.delete(listener);
        },
      };
    }, [activeEditor, selectionListeners]);

    const resolvedStyle: CSSProperties = {
      height: typeof height === "number" ? `${height}px` : height,
      ...style,
    };

    return (
      <div
        ref={rootRef}
        className={cn(
          "flex flex-col overflow-hidden rounded-lg border border-border bg-surface",
          className,
        )}
        style={resolvedStyle}
        {...props}
      >
        <Tabs
          value={activeTabId}
          onValueChange={(id) => {
            const found = tabs.find((t) => t.id === id);
            if (found) selectTab(found.file.path);
          }}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex items-center border-b border-border bg-surface">
            <TabsList className="h-9 flex-1 justify-start gap-0 rounded-none bg-transparent p-0">
              {tabs.map(({ file, id }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="h-9 rounded-none border-e border-border px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                >
                  {basename(file.path)}
                </TabsTrigger>
              ))}
            </TabsList>
            {activeFile ? <CopyButton value={activeFile.value} className="me-1.5" /> : null}
          </div>

          {tabs.map(({ file, id }) => {
            const isActive = file.path === activeFile?.path;
            return (
              // `forceMount` keeps every tab's content in the DOM so each
              // trigger's `aria-controls` resolves to a real element, not only
              // the active one (#154). Radix derives its own `hidden` from
              // `forceMount || isSelected`, so under `forceMount` it hides
              // NOTHING: without the explicit `hidden` below every inactive
              // panel stays a visible `flex-1` child and the editor height is
              // split across all of them. `tabIndex={-1}` keeps the empty
              // panels out of the tab sequence for the same reason. Only the
              // active file mounts a (single) Monaco instance.
              <TabsContent
                key={id}
                value={id}
                forceMount
                hidden={!isActive}
                tabIndex={isActive ? 0 : -1}
                className="mt-0 min-h-0 flex-1"
              >
                {isActive ? (
                  <CodeEditor
                    key={file.path}
                    path={file.path}
                    language={inferLanguage(file)}
                    value={file.value}
                    readOnly={readOnly}
                    onChange={(next) => onFileChange?.(file.path, next)}
                    onMount={(editor) => setActiveEditor(editor)}
                    height="100%"
                  />
                ) : null}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    );
  },
);
