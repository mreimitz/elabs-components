import { CodeEditor } from "@elabs-ai/components-editor";

export interface EditorPaneProps {
  value: string;
  onChange: (value: string) => void;
}

/** The left-hand YAML editor. The validator's line markers arrive in DG-12. */
export function EditorPane({ value, onChange }: EditorPaneProps) {
  return (
    <CodeEditor
      value={value}
      onChange={onChange}
      language="yaml"
      height="100%"
      ariaLabel="Diagram YAML"
      contextMenu="brand"
    />
  );
}
