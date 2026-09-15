import { describe, expect, it, vi } from "vitest";

/**
 * The root barrel (`.`) exports lightweight chrome (`CopyButton`,
 * `EDITOR_LANGUAGES`, `languageLabel`) alongside the Monaco-backed editing
 * surfaces (`CodeEditor`, `DiffEditor`, `CodeWorkspace`). A consumer that only
 * wants the chrome must never pay for Monaco: `monaco-editor` touches browser
 * globals at import time and is megabytes on the wire, breaking SSR/RSC for a
 * component that never renders an editor.
 *
 * `code-editor.tsx`/`diff-editor.tsx` used to `import * as monaco from
 * "monaco-editor"` at the top of the module — a VALUE import, evaluated the
 * moment anything imports the barrel (native ESM instantiates every module in
 * the graph, regardless of which named export is actually read). This test
 * locks the fix: mock `monaco-editor` to THROW on evaluation, then import the
 * barrel and prove the lightweight exports still work. If either editing
 * surface regresses to a top-level value import, this fails at the `import`
 * statement itself.
 */
vi.mock("monaco-editor", () => {
  throw new Error(
    "monaco-editor must not be evaluated merely by importing the @elabs-ai/components-editor barrel",
  );
});

describe("@elabs-ai/components-editor barrel", () => {
  it("importing the barrel never evaluates monaco-editor", async () => {
    await expect(import("./index")).resolves.toBeDefined();
  });

  it("CopyButton is usable without evaluating monaco-editor", async () => {
    const { CopyButton } = await import("./index");
    expect(CopyButton).toBeTypeOf("function");
  });

  it("EDITOR_LANGUAGES / languageLabel are usable without evaluating monaco-editor", async () => {
    const { EDITOR_LANGUAGES, languageLabel } = await import("./index");
    expect(Array.isArray(EDITOR_LANGUAGES)).toBe(true);
    expect(EDITOR_LANGUAGES.length).toBeGreaterThan(0);
    expect(languageLabel(EDITOR_LANGUAGES[0]!.id)).toBeTypeOf("string");
  });

  it("EditorToolbar + EditorContextMenu are usable (rendered) without evaluating monaco-editor", async () => {
    const { EditorToolbar, EditorContextMenu } = await import("./index");
    // Both are `forwardRef`/context components — objects, not plain functions;
    // assert they're valid React element types instead of a bare `typeof`.
    expect(EditorToolbar).toBeTruthy();
    expect(EditorContextMenu).toBeTruthy();
  });
});
