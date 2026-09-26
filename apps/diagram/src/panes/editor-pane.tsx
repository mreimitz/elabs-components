import { useId } from "react";
import { CodeEditor } from "@elabs-ai/components-editor";
import { Kbd } from "@elabs-ai/components-ui";

export interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
}

/** Monaco's `editor.action.toggleTabFocusMode` default chord: Ctrl+Shift+M on macOS, Ctrl+M elsewhere. */
const IS_MAC = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);
const TAB_FOCUS_KEYS = IS_MAC ? ["Ctrl", "Shift", "M"] : ["Ctrl", "M"];

/** The left-hand YAML editor. The validator's line markers arrive in DG-12. */
export function EditorPane({ value, onChange }: EditorPaneProps) {
  const hintId = useId();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={value}
          onChange={onChange}
          language="yaml"
          height="100%"
          ariaLabel="Diagram YAML"
          // P4: library gap — CodeEditor has no disclosed way to Tab out (Tab indents) and
          // replaces Monaco's own accessibility hint in the label; the caption below advises
          // the chord (WCAG 2.1.2). See docs/findings/DG-02-shell-a11y.md.
          ariaDescribedBy={hintId}
          contextMenu="brand"
        />
      </div>
      <p id={hintId} className="border-t px-3 py-1.5 text-caption text-muted-foreground">
        {TAB_FOCUS_KEYS.map((key, index) => (
          <span key={key}>
            {index > 0 && "+"}
            <Kbd>{key}</Kbd>
          </span>
        ))}{" "}
        switches Tab between indenting and moving focus out of the editor.
      </p>
    </div>
  );
}
