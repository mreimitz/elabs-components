"use client";

import { Tabs, TabsList, TabsTrigger } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
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
          value={active}
          onValueChange={selectTab}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex items-center border-b border-border bg-surface">
            <TabsList className="h-9 flex-1 justify-start gap-0 rounded-none bg-transparent p-0">
              {files.map((file) => (
                <TabsTrigger
                  key={file.path}
                  value={file.path}
                  className="h-9 rounded-none border-e border-border px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-none"
                >
                  {basename(file.path)}
                </TabsTrigger>
              ))}
            </TabsList>
            {activeFile ? <CopyButton value={activeFile.value} className="me-1.5" /> : null}
          </div>

          <div className="min-h-0 flex-1">
            {activeFile ? (
              <CodeEditor
                key={activeFile.path}
                path={activeFile.path}
                language={inferLanguage(activeFile)}
                value={activeFile.value}
                readOnly={readOnly}
                onChange={(next) => onFileChange?.(activeFile.path, next)}
                onMount={(editor) => setActiveEditor(editor)}
                height="100%"
              />
            ) : null}
          </div>
        </Tabs>
      </div>
    );
  },
);
