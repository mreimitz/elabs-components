import type { Meta, StoryObj } from "@storybook/react-vite";
import { cn } from "@elabs/components-ui/lib/cn";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning";
const meta = {
  title: "AI/Reasoning",
  component: Reasoning,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Reasoning>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Reasoning defaultOpen className="max-w-prose">
      <ReasoningTrigger />
      <ReasoningContent>
        {"I checked CI for the last 7 days, grouped by service, then summarized the failures."}
      </ReasoningContent>
    </Reasoning>
  ),
};

/** While the model is still thinking: the trigger shimmers and the panel auto-opens. */
export const Streaming: Story = {
  render: () => (
    <Reasoning defaultOpen isStreaming className="max-w-prose">
      <ReasoningTrigger />
      <ReasoningContent>
        {"Querying the warehouse for Q3 orders, then joining against the returns table"}
      </ReasoningContent>
    </Reasoning>
  ),
};

/**
 * A structured live ledger instead of markdown.
 *
 * `ReasoningContent` takes `ReactNode`: a **string** is parsed as streamed
 * markdown, anything else renders as-is — so per-step status can live inside the
 * disclosure without being handed to a markdown parser.
 */
export const StructuredLedger: Story = {
  render: () => (
    <Reasoning defaultOpen className="max-w-prose">
      <ReasoningTrigger />
      <ReasoningContent>
        <ol className="flex flex-col gap-2">
          {[
            ["done", "Resolved the schema for orders + returns"],
            ["done", "Ran the Q3 aggregation (1.2M rows)"],
            ["active", "Reconciling against the finance ledger"],
            ["pending", "Drafting the summary"],
          ].map(([state, label]) => (
            <li className="flex items-start gap-2 text-body" key={label}>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  state === "done" && "bg-primary",
                  state === "active" && "bg-info",
                  state === "pending" && "bg-muted-foreground/40",
                )}
              />
              <span className={state === "pending" ? "text-muted-foreground" : undefined}>
                {label}
                {/* The dot is colour-only, so carry the status in text too —
                    this story is an exemplar consumers copy (WCAG 1.4.1). */}
                <span className="sr-only">
                  {state === "done"
                    ? " (done)"
                    : state === "active"
                      ? " (in progress)"
                      : " (pending)"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </ReasoningContent>
    </Reasoning>
  ),
};
