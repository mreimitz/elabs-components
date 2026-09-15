/**
 * @elabs-ai/components-editor — a token-themed Monaco (VS Code) editor wrapped as brand-ui
 * components.
 *
 * Monaco is a self-rendering editor engine; this package wraps it the way
 * @elabs-ai/components-flow wraps React Flow and @elabs-ai/components-data wraps TanStack. The editing
 * surface + widgets are Monaco's, recolored from the active brand theme via the
 * theming bridge; the chrome (toolbar, file tabs, copy button) is brand-ui.
 *
 * Worker setup (for completions/diagnostics) — import ONCE at the app entry:
 *   import "@elabs-ai/components-editor/monaco-environment";   // Vite apps
 */
export {
  CodeEditor,
  type CodeEditorProps,
  type MonacoCodeEditor,
  type EditorAction,
} from "./code-editor";
export { DiffEditor, type DiffEditorProps, type MonacoDiffEditor } from "./diff-editor";
export {
  MarkdownEditor,
  type MarkdownEditorProps,
  type MarkdownEditorHandle,
  type EmbedAssetFn,
} from "./markdown-editor";
export {
  CodeWorkspace,
  type CodeWorkspaceHandle,
  type CodeWorkspaceProps,
  type EditorFile,
} from "./code-workspace";
export {
  monacoContentAccess,
  type EditorContentAccess,
  type EditorSelection,
} from "./lib/editor-content-access";
export { EditorToolbar, type EditorToolbarProps } from "./editor-toolbar";
export { EditorContextMenu, type EditorContextMenuProps } from "./editor-context-menu";
export { CopyButton, type CopyButtonProps } from "./copy-button";

// Theming bridge + language helpers (advanced consumers / custom chrome).
export { applyBrandTheme, buildBrandThemeData, brandThemeId } from "./lib/monaco-theme-bridge";
export { useDataTheme, type DataThemeState } from "./lib/use-data-theme";
export { EDITOR_LANGUAGES, languageLabel, type EditorLanguage } from "./lib/languages";

// The `monaco-editor` namespace moved to its own subpath — see `./monaco.ts`.
// Re-exporting it here pulled Monaco into every consumer of this barrel, even
// one only importing `CopyButton`/`EDITOR_LANGUAGES`:
//   import { monaco } from "@elabs-ai/components-editor/monaco";
