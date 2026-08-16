/**
 * Code workspace scaffold (copy-owned block).
 *
 * A multi-file Monaco editor with brand-ui tabs + token theming. Wire Monaco's
 * language workers once at the app entry (Vite):
 *   import "@qlik-coe-emea/qlabs-components-editor/monaco-environment";
 *
 * Depends on installed @qlik-coe-emea/qlabs-components-editor (+ its peers @qlik-coe-emea/qlabs-components-ui, @qlik-coe-emea/qlabs-components-tokens, and
 * monaco-editor).
 */
"use client";

import { useState } from "react";
import { CodeWorkspace, type EditorFile } from "@qlik-coe-emea/qlabs-components-editor";

const initialFiles: EditorFile[] = [
  {
    path: "src/index.ts",
    value: `export function greet(name: string): string {\n  return \`Hello \${name}!\`;\n}\n`,
  },
  {
    path: "config.json",
    value: `{\n  "name": "demo",\n  "version": "1.0.0"\n}\n`,
  },
  {
    path: "README.md",
    value: `# Demo\n\nEdit these files — language is inferred from each extension.\n`,
  },
];

export function CodeWorkspaceBlock() {
  const [files, setFiles] = useState(initialFiles);

  return (
    <div className="h-[480px]">
      <CodeWorkspace
        files={files}
        onFileChange={(path, value) =>
          setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, value } : f)))
        }
      />
    </div>
  );
}
