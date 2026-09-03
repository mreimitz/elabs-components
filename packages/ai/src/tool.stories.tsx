import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Tool,
  ToolContent,
  ToolDetails,
  ToolHeader,
  ToolInput,
  ToolOutput,
  statusFromToolState,
} from "./tool";
const meta = {
  title: "AI/Tool",
  component: Tool,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The CHAT tool-call row; the console skin is `Terminal/TerminalToolCall`, and both speak the same success / error / pending vocabulary — see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `Tool` owns the rail-and-inspect idiom: a header carrying the derived tool name, a `StatusBadge` and a business summary, with the raw payload behind a default-collapsed `ToolDetails`. The artifact a call PRODUCED is `AI/ToolResultCard` instead.",
      },
    },
  },
} satisfies Meta<typeof Tool>;
export default meta;
type Story = StoryObj<typeof meta>;
// JSON-behind-disclosure is the package default (#192, research 10 §B.5): the
// header carries the business summary; the raw payload sits inside the
// default-COLLAPSED ToolDetails, one expand away.
export const Default: Story = {
  render: () => (
    <Tool defaultOpen className="max-w-prose">
      <ToolHeader type="tool-search_web" state="output-available" summary="3 results found" />
      <ToolContent>
        <ToolDetails>
          <ToolInput input={{ query: "platform status page" }} />
          <ToolOutput
            output={{ hits: 3, sources: ["status.example.com", "community", "docs"] }}
            errorText={undefined}
          />
        </ToolDetails>
      </ToolContent>
    </Tool>
  ),
};
// STREAMING — the call is still running (`input-streaming`). `ToolOutput`
// derives `isStreaming` from the SAME `statusFromToolState` mapping the header
// badge uses (no second source of truth), and renders a layout-shaped
// skeleton in the Result slot instead of `null` — and never the error branch,
// even though this demo call will eventually resolve to `errorText`.
export const Streaming: Story = {
  name: "ToolOutput isStreaming",
  render: () => {
    const state = "input-streaming" as const;
    return (
      <Tool defaultOpen className="max-w-prose">
        <ToolHeader type="tool-search_web" state={state} summary="Searching…" />
        <ToolContent>
          <ToolDetails defaultOpen>
            <ToolInput input={{ query: "platform status page" }} />
            <ToolOutput
              output={undefined}
              errorText={undefined}
              isStreaming={statusFromToolState(state) === "pending"}
            />
          </ToolDetails>
        </ToolContent>
      </Tool>
    );
  },
};
