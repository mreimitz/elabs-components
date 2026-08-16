import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { CodeWorkspace, type EditorFile } from "./code-workspace";

const meta = {
  title: "Editor/CodeWorkspace",
  component: CodeWorkspace,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Multi-file editor shell. brand-ui `Tabs` + `Button` provide the chrome; " +
          "a single Monaco `CodeEditor` swaps to the active file. Language is " +
          "inferred from each file's extension.",
      },
    },
  },
} satisfies Meta<typeof CodeWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

const INITIAL: EditorFile[] = [
  {
    path: "src/button.tsx",
    value: `export function Button({ children }: { children: string }) {\n  return <button className="btn">{children}</button>;\n}\n`,
  },
  {
    path: "src/styles.css",
    value: `.btn {\n  border-radius: 0.5rem;\n  padding: 0.5rem 1rem;\n}\n`,
  },
  {
    path: "package.json",
    value: `{\n  "name": "demo",\n  "version": "1.0.0"\n}\n`,
  },
];

export const ThreeFiles: Story = {
  render: function ThreeFilesStory() {
    const [files, setFiles] = useState(INITIAL);
    const onFileChange = (path: string, value: string) =>
      setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, value } : f)));
    return (
      <div className="h-[460px] w-full p-4">
        <CodeWorkspace files={files} onFileChange={onFileChange} />
      </div>
    );
  },
};
