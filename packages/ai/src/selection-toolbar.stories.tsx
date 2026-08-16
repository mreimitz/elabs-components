import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Textarea } from "@elabs/components-ui";
import { SelectionToolbar } from "./selection-toolbar";
import { Message, MessageContent } from "./message";

const meta = {
  title: "AI/SelectionToolbar",
  component: SelectionToolbar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof SelectionToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Default — select any text in the transcript to reveal the Quote toolbar. */
export const Default: Story = {
  render: () => (
    <SelectionToolbar onQuote={(text) => console.info("quote", text)}>
      <div className="flex flex-col gap-3">
        <Message from="assistant">
          <MessageContent>
            Q3 revenue totalled $4.2M across four regions. EMEA led at $1.8M, followed by the
            Americas at $1.4M. Growth was strongest in APAC, up 22% quarter over quarter.
          </MessageContent>
        </Message>
        <Message from="assistant">
          <MessageContent>
            The biggest risk to Q4 is renewal concentration: three enterprise accounts make up 31%
            of ARR and all renew in the same month.
          </MessageContent>
        </Message>
      </div>
    </SelectionToolbar>
  ),
};

/** Wired to a composer — quoting prepends a `>`-prefixed blockquote into the draft. */
export const QuoteIntoComposer: Story = {
  render: function QuoteIntoComposer() {
    const [draft, setDraft] = useState("");
    const quote = (text: string) => {
      const block = text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      setDraft((d) => (d ? `${block}\n\n${d}` : `${block}\n\n`));
    };
    return (
      <div className="flex flex-col gap-4">
        <SelectionToolbar onQuote={quote}>
          <Message from="assistant">
            <MessageContent>
              Select this sentence and click Quote to pull it into the composer as a blockquote.
            </MessageContent>
          </Message>
        </SelectionToolbar>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Your reply…"
          aria-label="Reply"
          className="min-h-24"
        />
      </div>
    );
  },
};

/** Dark theme. */
export const DarkTheme: Story = {
  render: () => (
    <SelectionToolbar onQuote={(text) => console.info("quote", text)}>
      <Message from="assistant">
        <MessageContent>Select this text to see the Quote toolbar in dark theme.</MessageContent>
      </Message>
    </SelectionToolbar>
  ),
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};
