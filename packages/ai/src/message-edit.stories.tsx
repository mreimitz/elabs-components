import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "@elabs/components-ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MessageEdit,
  MessageEditContent,
  MessageEditProvider,
  MessageEditTrigger,
} from "./message-edit";
import { Message, MessageContent } from "./message";

const meta = {
  title: "AI/MessageEdit",
  component: MessageEdit,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof MessageEdit>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default — a user message with an edit affordance (hover to reveal). */
export const Default: Story = {
  render: function Default() {
    const [text, setText] = useState("Summarize the Q3 revenue report by region.");
    return (
      <Message from="user">
        <MessageContent>
          <MessageEdit value={text} onEditSubmit={setText}>
            {text}
          </MessageEdit>
        </MessageContent>
      </Message>
    );
  },
};

/** Editing — starts in edit mode (Enter saves · Shift+Enter newline · Esc cancels). */
export const Editing: Story = {
  render: function Editing() {
    const [text, setText] = useState("Make the intro shorter and add a chart.");
    return (
      <Message from="user">
        <MessageContent>
          <MessageEdit value={text} onEditSubmit={setText} defaultEditing>
            {text}
          </MessageEdit>
        </MessageContent>
      </Message>
    );
  },
};

/** Trigger in a toolbar — compose the parts so the edit control lives elsewhere. */
export const TriggerInToolbar: Story = {
  render: function TriggerInToolbar() {
    const [text, setText] = useState("Rewrite this as a bulleted list.");
    return (
      <MessageEditProvider value={text} onEditSubmit={setText}>
        <div className="flex items-start justify-between gap-4">
          <Message from="user" className="flex-1">
            <MessageContent>
              <MessageEditContent>{text}</MessageEditContent>
            </MessageContent>
          </Message>
          <MessageEditTrigger />
        </div>
      </MessageEditProvider>
    );
  },
};

/**
 * Branch on edit — editing creates a new version. The consumer owns branch
 * state; here each save appends a version and jumps to it (compose with
 * `MessageBranch*` in production).
 */
export const BranchOnEdit: Story = {
  render: function BranchOnEdit() {
    const [versions, setVersions] = useState<string[]>(["What's our churn rate this quarter?"]);
    const [active, setActive] = useState(0);
    const current = versions[active] ?? "";
    return (
      <div className="flex flex-col gap-2">
        <Message from="user">
          <MessageContent>
            <MessageEdit
              key={active}
              value={current}
              onEditSubmit={(next) => {
                setVersions((v) => [...v, next]);
                setActive(versions.length);
              }}
            >
              {current}
            </MessageEdit>
          </MessageContent>
        </Message>
        {versions.length > 1 && (
          <div className="flex items-center gap-2 self-end text-caption text-muted-foreground">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Previous version"
              disabled={active === 0}
              onClick={() => setActive((a) => Math.max(0, a - 1))}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <span>
              {active + 1} / {versions.length}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Next version"
              disabled={active === versions.length - 1}
              onClick={() => setActive((a) => Math.min(versions.length - 1, a + 1))}
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        )}
      </div>
    );
  },
};

/** Dark theme — inline editor + trigger in dark. */
export const DarkTheme: Story = {
  render: function DarkTheme() {
    const [text, setText] = useState("Draft a follow-up email to the finance team.");
    return (
      <Message from="user">
        <MessageContent>
          <MessageEdit value={text} onEditSubmit={setText} defaultEditing>
            {text}
          </MessageEdit>
        </MessageContent>
      </Message>
    );
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};
