import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Sandbox,
  SandboxContent,
  SandboxHeader,
  SandboxTabContent,
  SandboxTabs,
  SandboxTabsBar,
  SandboxTabsList,
  SandboxTabsTrigger,
} from "./sandbox";

const meta = {
  title: "AI/Sandbox",
  component: Sandbox,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A collapsible, tabbed view of a code-execution tool part — code in, output out, read-only. The real Monaco editing surface is `Editor/CodeEditor`; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `Sandbox` is the only place that knows whether the run body has arrived, so `SandboxContent` renders a layout-shaped skeleton while `loading`.",
      },
    },
  },
} satisfies Meta<typeof Sandbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sandbox className="max-w-lg">
      <SandboxHeader title="Python sandbox" state="output-available" />
      <SandboxContent>
        <SandboxTabs defaultValue="output">
          <SandboxTabsBar>
            <SandboxTabsList>
              <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
            </SandboxTabsList>
          </SandboxTabsBar>
          <SandboxTabContent value="output" className="p-3">
            3 rows reconciled.
          </SandboxTabContent>
        </SandboxTabs>
      </SandboxContent>
    </Sandbox>
  ),
};

// LOADING — the run's output hasn't arrived yet (loading-states.md `loading`).
// `SandboxContent` renders a layout-shaped skeleton while `SandboxHeader`
// keeps rendering as passed, so the run's identity stays visible.
export const Loading: Story = {
  render: () => (
    <Sandbox className="max-w-lg" loading>
      <SandboxHeader title="Python sandbox" state="input-streaming" />
      <SandboxContent>
        <SandboxTabs defaultValue="output">
          <SandboxTabsBar>
            <SandboxTabsList>
              <SandboxTabsTrigger value="output">Output</SandboxTabsTrigger>
            </SandboxTabsList>
          </SandboxTabsBar>
          <SandboxTabContent value="output" className="p-3">
            This content is not shown while loading.
          </SandboxTabContent>
        </SandboxTabs>
      </SandboxContent>
    </Sandbox>
  ),
};
