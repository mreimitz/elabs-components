"use client";

/**
 * The `monaco-editor` namespace, as its own subpath (ADR 0006 subpath exports).
 *
 * The root barrel (`.`) exports lightweight chrome — `CopyButton`,
 * `EDITOR_LANGUAGES`, `languageLabel` — that a consumer should be able to
 * import WITHOUT pulling Monaco in at all: the editing surfaces
 * (`CodeEditor`, `DiffEditor`, `MarkdownEditor`) already own lazy-loading the
 * engine themselves. Re-exporting the whole `monaco-editor` namespace from
 * that SAME barrel defeated that split — `import { CopyButton } from
 * "@elabs-ai/components-editor"` pulled megabytes of Monaco and touched
 * browser globals at import time, breaking SSR/RSC for a component that never
 * renders the editor.
 *
 * A consumer that needs to build a custom editor, or wire Monaco commands
 * directly, imports this subpath instead:
 *
 *   import { monaco } from "@elabs-ai/components-editor/monaco";
 */
export * as monaco from "monaco-editor";
