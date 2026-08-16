import type { Meta, StoryObj } from "@storybook/react-vite";

import { MermaidDiagram } from "./mermaid-diagram";

const meta = {
  title: "Editor/MermaidDiagram",
  component: MermaidDiagram,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof MermaidDiagram>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Order flow",
    chart: `graph TD
  A[Browse repos] --> B{Markdown file?}
  B -- yes --> C[Open in reader]
  B -- no --> D[Open in code editor]
  C --> E[Edit + commit]`,
  },
};

export const Sequence: Story = {
  args: {
    label: "Commit sequence",
    chart: `sequenceDiagram
  participant U as User
  participant W as Workbench
  participant G as GitHub
  U->>W: Save (⌘S)
  W->>G: PUT /contents (base sha)
  G-->>W: 200 new sha
  W-->>U: Committed`,
  },
};

export const InvalidSource: Story = {
  args: { chart: "graph TD; A--> ::nope::" },
};
