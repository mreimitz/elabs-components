import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { StreamingSuggestions, Suggestion, Suggestions } from "./suggestion";
const meta = {
  title: "AI/Suggestion",
  component: Suggestions,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof Suggestions>;
export default meta;
type Story = StoryObj<typeof meta>;
// Default = the soft tinted pill (#194): borderless `bg-secondary rounded-full`.
export const Default: Story = {
  render: () => (
    <Suggestions>
      {["Summarize the deploys", "Explain the billing error", "Write a regression test"].map(
        (s) => (
          <Suggestion key={s} suggestion={s} onClick={() => {}} />
        ),
      )}
    </Suggestions>
  ),
};
// A caller can still opt into an outlined chip; reach for the quiet
// `outline-subtle` rung. (Since the ADR 0010 Amendment, 2026-06-20, `--input` ==
// `--border` so `outline`/`outline-subtle` render identically by default;
// `outline-subtle` remains the semantically correct choice for a quiet chip.)
export const OutlineSubtle: Story = {
  render: () => (
    <Suggestions>
      {["Compare to last quarter", "Draft the follow-up email"].map((s) => (
        <Suggestion key={s} suggestion={s} variant="outline-subtle" onClick={() => {}} />
      ))}
    </Suggestions>
  ),
};

// Streaming trailing-loader — chips are present and a shimmering trailing chip
// is shown while the generator is still producing suggestions.
export const Streaming: Story = {
  render: () => (
    <StreamingSuggestions
      loading
      suggestions={["Summarize the deploys", "Explain the billing error"]}
      onSuggestionClick={() => {}}
    />
  ),
};

// Live demo — suggestions appear progressively, then the trailing loader
// disappears once the set settles.
export const StreamingLive: Story = {
  render: function StreamingLive() {
    const all = [
      "Summarize the deploys",
      "Explain the billing error",
      "Write a regression test",
      "Draft the follow-up email",
    ];
    const [count, setCount] = useState(0);
    const done = count >= all.length;
    useEffect(() => {
      if (done) return;
      const t = setTimeout(() => setCount((c) => c + 1), 700);
      return () => clearTimeout(t);
    }, [count, done]);
    return (
      <StreamingSuggestions
        loading={!done}
        suggestions={all.slice(0, count)}
        onSuggestionClick={() => {}}
      />
    );
  },
};
