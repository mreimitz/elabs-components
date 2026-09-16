import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent } from "storybook/test";
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

/**
 * Focus indicator on ToolDetails trigger (#313): Tab to the disclosure
 * trigger and assert the compound indicator's OUTLINE layer. The prior
 * version read `buttons[0]` — but `ToolHeader` (rendered before `ToolDetails`
 * in the DOM) is ALSO a `CollapsibleTrigger` (`tool.tsx:98`, the outer
 * `Tool` row's own disclosure) with no focus styling of its own, so it is
 * `buttons[0]` and receives the first Tab, not the `ToolDetails` trigger
 * this issue is about (`tool.tsx:152`). Query the actual trigger by its
 * accessible name (`t("ai.tool.showTechnicalDetails")`) instead of by index.
 */
export const FocusIndicator: Story = {
  render: () => (
    // defaultOpen on the OUTER Tool — its ToolContent (and so ToolDetails'
    // trigger) is hidden/unmounted when the outer Collapsible starts closed,
    // as it does without this prop (see Default story). Without it the
    // ToolDetails trigger this test targets isn't in the accessibility tree
    // at all, and `getByRole` throws before ever reaching the focus check.
    <Tool defaultOpen className="max-w-prose">
      <ToolHeader type="tool-fetch" state="output-available" summary="Fetched data" />
      <ToolContent>
        <ToolDetails>
          <ToolInput input={{ url: "https://example.com" }} />
          <ToolOutput output={{ status: "ok" }} />
        </ToolDetails>
      </ToolContent>
    </Tool>
  ),
  play: async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: /show technical details/i });
    trigger.focus();
    await expect(trigger).toHaveFocus();
    const focused = getComputedStyle(trigger);
    await expect(focused.boxShadow).not.toBe("none");
    await expect(focused.outlineStyle).toBe("solid");
    await expect(parseFloat(focused.outlineWidth)).toBeGreaterThan(0);
  },
};
