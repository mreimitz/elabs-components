import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "./code-block";
const meta = {
  title: "AI/CodeBlock",
  component: CodeBlock,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CodeBlock>;
export default meta;
type Story = StoryObj<typeof meta>;
// A representative mix of comment/keyword/type/string/number/function scopes
// (#315) — so the derived-from-tokens Shiki theme is visually checkable across
// both themes (light, dark) via the toolbar's global
// theme switcher, not just a single flat color.
const SAMPLE_CODE = [
  "// Adds two numbers together",
  "export function add(a: number, b: number): number {",
  '  const label = "sum";',
  "  return a + b; // 42",
  "}",
].join("\n");

export const Default: Story = {
  render: () => (
    <div className="max-w-lg">
      <CodeBlock code={SAMPLE_CODE} language="tsx" />
    </div>
  ),
};

// Dark theme — verifies the derived-from-tokens Shiki theme in dark
// (#315). Also proves the region-scoped fix: a `<div data-theme="dark">`
// decorator (the same pattern as `message-table.stories.tsx`'s `DarkTheme`)
// resolves ITS OWN theme rather than always the document root's.
export const DarkTheme: Story = {
  render: () => (
    <div className="max-w-lg">
      <CodeBlock code={SAMPLE_CODE} language="tsx" />
    </div>
  ),
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-lg bg-background p-6 text-foreground">
        <Story />
      </div>
    ),
  ],
};

// Markup (JSX tags) — exercises the `--code-tag` role (#315 follow-up). A
// valid <div>/<span> tag must read as its OWN color, never the same as
// destructive/warning text — the collision a prior revision had (`--code-tag`
// aliased to `--calc-warning`, so a normal tag looked identical to an error).
const MARKUP_CODE = [
  "export function Card({ label, count }: CardProps) {",
  "  return (",
  '    <div className="card" data-count={count}>',
  "      <span>{label}</span>",
  "    </div>",
  "  );",
  "}",
].join("\n");

export const MarkupTags: Story = {
  render: () => (
    <div className="max-w-lg">
      <CodeBlock code={MARKUP_CODE} language="tsx" />
    </div>
  ),
};
// STREAMING — code is arriving incrementally (loading-states.md `isStreaming`).
// The partial code keeps rendering (build-up, NOT a skeleton — it isn't
// fetch-then-show); a `Shimmer` "Generating…" cue is the in-progress affordance.
export const Streaming: Story = {
  name: "isStreaming",
  render: () => (
    <div className="max-w-lg">
      <CodeBlock code={"export function add(a: number, b"} language="tsx" isStreaming />
    </div>
  ),
};
