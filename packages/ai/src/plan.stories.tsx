import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  Plan,
  PlanAction,
  PlanApprove,
  PlanComment,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanRequestChanges,
  PlanStatusLine,
  PlanTitle,
  PlanTrigger,
} from "./plan";

const meta = {
  title: "AI/Plan",
  component: Plan,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The CHAT plan card — what the agent intends to do, optionally with an accept/edit decision. The console counterpart of a three-state agent checklist is `Terminal/TerminalTodoList`; the summary of what already ran is `AI/Task`. See [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). `status` is additive: a `Plan` rendered without it has no ARIA region, no rail and no status line.",
      },
    },
  },
} satisfies Meta<typeof Plan>;

export default meta;

type Story = StoryObj<typeof meta>;

const steps = (
  <ol className="list-decimal space-y-1 ps-5 text-body text-muted-foreground">
    <li>Pull the Q3 10-Q and Q2 board pack</li>
    <li>Reconcile to the warehouse revenue table</li>
    <li>Compute QoQ growth, ARR and gross margin</li>
    <li>Draft a one-page note and export the figures</li>
  </ol>
);

// The pre-#108 shape — no `status`, `isStreaming` defaults to `false`. Kept as
// the Default story so the legacy, display-only usage stays exercised exactly
// as before (#108 acceptance: existing usage renders unchanged).
export const Default: Story = {
  render: () => (
    <Plan>
      <PlanHeader>
        <div className="min-w-0">
          <PlanTitle>Draft the Q3 board note</PlanTitle>
          <PlanDescription>
            Retrieve filings, reconcile to the warehouse, then summarize.
          </PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent>{steps}</PlanContent>
      <PlanFooter>
        <span className="text-meta text-muted-foreground">
          4 steps · grounded in filings + warehouse
        </span>
      </PlanFooter>
    </Plan>
  ),
};

// The legacy display-only signal (pre-#108): the title/description shimmer
// while the plan is still arriving. No decision contract is attached.
export const Streaming: Story = {
  render: () => (
    <Plan isStreaming>
      <PlanHeader>
        <div className="min-w-0">
          <PlanTitle>Draft the Q3 board note</PlanTitle>
          <PlanDescription>Retrieving filings…</PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent>{steps}</PlanContent>
    </Plan>
  ),
};

// The decision contract (#108): a pending plan is a LABELLED GROUP (not
// `role="alert"`) containing the three named actions — Approve is the filled
// primary path, Request changes / Comment are quieter.
export const Awaiting: Story = {
  render: () => (
    <Plan status="awaiting">
      <PlanHeader>
        <div className="min-w-0">
          <PlanTitle>Draft the Q3 board note</PlanTitle>
          <PlanDescription>
            Retrieve filings, reconcile to the warehouse, then summarize.
          </PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent>{steps}</PlanContent>
      <PlanFooter className="flex-col items-stretch gap-3">
        <PlanStatusLine />
        <div className="flex w-full items-center justify-end gap-2">
          <PlanComment>Comment</PlanComment>
          <PlanRequestChanges>Request changes</PlanRequestChanges>
          <PlanApprove>Approve</PlanApprove>
        </div>
      </PlanFooter>
    </Plan>
  ),
};

// A settled outcome renders `role="alert"`, the actions are gone, and the
// outcome is carried in text + glyph (never rail colour alone).
export const Approved: Story = {
  render: () => (
    <Plan status="approved">
      <PlanHeader>
        <div className="min-w-0">
          <PlanTitle>Draft the Q3 board note</PlanTitle>
          <PlanDescription>
            Retrieve filings, reconcile to the warehouse, then summarize.
          </PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent>{steps}</PlanContent>
      <PlanFooter>
        <PlanStatusLine />
      </PlanFooter>
    </Plan>
  ),
};

export const ChangesRequested: Story = {
  render: () => (
    <Plan status="changes-requested">
      <PlanHeader>
        <div className="min-w-0">
          <PlanTitle>Draft the Q3 board note</PlanTitle>
          <PlanDescription>
            Retrieve filings, reconcile to the warehouse, then summarize.
          </PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent>{steps}</PlanContent>
      <PlanFooter>
        <PlanStatusLine>Changes requested — reconcile against Q2 instead</PlanStatusLine>
      </PlanFooter>
    </Plan>
  ),
};
