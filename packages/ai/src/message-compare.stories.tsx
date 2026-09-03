import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageCompare, MessageCompareColumn } from "./message-compare";
import { MessageFeedback } from "./message-feedback";
import { MessageResponse } from "./message";
import { Switch } from "@elabs-ai/components-ui";

const meta = {
  title: "AI/MessageCompare",
  component: MessageCompare,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Two to four model ANSWERS side by side — not a diff. Nothing here is line-level; for that, start from `AI/DiffView` and the rest of the diff family in [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). The one-at-a-time sibling is `MessageBranch`, which switches between responses instead of showing them at once; each pane here keeps its own status, its own scroll position and its own feedback.",
      },
    },
  },
} satisfies Meta<typeof MessageCompare>;
export default meta;
type Story = StoryObj<typeof meta>;

const GPT_ANSWER = `Postgres row-level security is the safer default for a multi-tenant
schema: every query is filtered by the database itself, so a missing \`WHERE tenant_id = …\`
in application code can't leak another tenant's rows.`;

const CLAUDE_ANSWER = `I'd reach for a separate schema per tenant only once you're past a few
hundred tenants — below that, a shared schema with row-level security is simpler to migrate
and easier to reason about, and it keeps a single connection pool.`;

const GEMINI_ANSWER = `Both approaches work. Schema-per-tenant gives the strongest isolation
(useful for compliance-heavy customers) at the cost of migration fan-out; row-level security
keeps one schema and pushes isolation into policies, which is cheaper to operate at scale.`;

/** Two columns: one still streaming, one settled — independent status per column. */
export const Default: Story = {
  render: () => (
    <div className="h-[520px]">
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "GPT-5" }} status="streaming">
          <MessageResponse>{GPT_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Claude" }} status="ready">
          <MessageResponse>{CLAUDE_ANSWER}</MessageResponse>
          <MessageFeedback className="mt-3" />
        </MessageCompareColumn>
      </MessageCompare>
    </div>
  ),
};

/** Both columns still generating — the `Shimmer` status indicator per header. */
export const Streaming: Story = {
  render: () => (
    <div className="h-[520px]">
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "GPT-5" }} status="streaming">
          <MessageResponse>{GPT_ANSWER.slice(0, 60)}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Claude" }} status="submitted" />
      </MessageCompare>
    </div>
  ),
};

/** One column failed — `role="alert"` + icon + `text-destructive-text`, never colour alone. */
export const WithError: Story = {
  render: () => (
    <div className="h-[520px]">
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "GPT-5" }} status="ready">
          <MessageResponse>{GPT_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Claude" }} status="error">
          <p className="text-body text-muted-foreground">No response — the request failed.</p>
        </MessageCompareColumn>
      </MessageCompare>
    </div>
  ),
};

/** Three responses side by side (`columns` supports 2-4). */
export const ThreeColumns: Story = {
  render: () => (
    <div className="h-[520px]">
      <MessageCompare columns={3}>
        <MessageCompareColumn model={{ name: "GPT-5" }} status="ready">
          <MessageResponse>{GPT_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Claude" }} status="ready">
          <MessageResponse>{CLAUDE_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Gemini" }} status="ready">
          <MessageResponse>{GEMINI_ANSWER}</MessageResponse>
        </MessageCompareColumn>
      </MessageCompare>
    </div>
  ),
};

/** Four responses — the upper bound of `columns`. */
export const FourColumns: Story = {
  render: () => (
    <div className="h-[520px]">
      <MessageCompare columns={4}>
        <MessageCompareColumn model={{ name: "GPT-5" }} status="ready">
          <MessageResponse>{GPT_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Claude" }} status="ready">
          <MessageResponse>{CLAUDE_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Gemini" }} status="ready">
          <MessageResponse>{GEMINI_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Llama" }} status="streaming">
          <MessageResponse>{GEMINI_ANSWER.slice(0, 40)}</MessageResponse>
        </MessageCompareColumn>
      </MessageCompare>
    </div>
  ),
};

function SyncedScrollDemo() {
  const [syncScroll, setSyncScroll] = useState(true);
  const long = (label: string) =>
    Array.from({ length: 24 }, (_, i) => `${label} — paragraph ${i + 1}. ${GEMINI_ANSWER}`).join(
      "\n\n",
    );

  return (
    <div className="flex h-[520px] flex-col gap-3">
      <label className="flex w-fit items-center gap-2 text-body">
        <Switch checked={syncScroll} onCheckedChange={setSyncScroll} />
        Sync scroll across columns
      </label>
      <div className="min-h-0 flex-1">
        <MessageCompare columns={2} syncScroll={syncScroll}>
          <MessageCompareColumn model={{ name: "GPT-5" }} status="ready">
            <MessageResponse>{long("GPT-5")}</MessageResponse>
          </MessageCompareColumn>
          <MessageCompareColumn model={{ name: "Claude" }} status="ready">
            <MessageResponse>{long("Claude")}</MessageResponse>
          </MessageCompareColumn>
        </MessageCompare>
      </div>
    </div>
  );
}

/**
 * Long content in both columns with a `syncScroll` toggle — scrolling one
 * column proportionally moves its sibling while the toggle is on (issue #23).
 */
export const SyncedScroll: Story = {
  render: () => <SyncedScrollDemo />,
};

/** Below the `md` breakpoint the grid collapses to a `MessageBranch`-style tab strip. */
export const Mobile: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
  render: () => (
    <div className="h-[520px]">
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "GPT-5" }} status="ready">
          <MessageResponse>{GPT_ANSWER}</MessageResponse>
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Claude" }} status="ready">
          <MessageResponse>{CLAUDE_ANSWER}</MessageResponse>
        </MessageCompareColumn>
      </MessageCompare>
    </div>
  ),
};
