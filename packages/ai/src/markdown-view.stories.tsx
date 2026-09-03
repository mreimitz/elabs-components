import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
} from "./inline-citation";
import { MarkdownView } from "./markdown-view";

const meta = {
  title: "AI/MarkdownView",
  component: MarkdownView,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A model-authored answer or a read-only markdown DOCUMENT, rendered as a " +
          "document — never as Shiki source. " +
          "Pick a markdown renderer by where the markdown is going to be READ: a " +
          "read-only document in a chat or a side rail → `AI/MarkdownView`; the preview " +
          "pane of the markdown editor → `Editor/MarkdownPreview`; a file the app did " +
          "not write → the markdown adapter behind `Viewer/FileViewer`; streaming into " +
          "a message as the model writes it → `MessageResponse` on `AI/Message`. See " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs)." +
          " Its own seams: `baseHeadingLevel` constrains the heading rungs so a " +
          "document `#` inside a 20rem rail lands on the `title` rung instead of " +
          "becoming the biggest text on screen, and the sanitiser chain is LOCKED — " +
          "`rehypePlugins` is omitted at the type level and stripped at runtime, so a " +
          "caller cannot widen what a model is allowed to emit. It understands no brand " +
          "directives; those belong to the editor preview.\n\n" +
          "All three map their element tree onto the same `Prose*` primitives owned " +
          "by `@elabs-ai/components-ui` (`@elabs-ai/components-editor` re-exports them " +
          "under short names). The element MAPS stay per-surface on purpose — " +
          "`@elabs-ai/components-ai`, `@elabs-ai/components-editor` and " +
          "`@elabs-ai/components-viewer` are leaves that may not import one another, and " +
          "`streamdown` deliberately never moves down into `@elabs-ai/components-ui`, or " +
          "every consumer of every foundation component would carry it. One prose source, " +
          "several renderers.",
      },
    },
  },
} satisfies Meta<typeof MarkdownView>;
export default meta;
type Story = StoryObj<typeof meta>;

const DOC = `# Quarterly summary

Revenue grew **12.4% QoQ**. See the [variance check](https://example.com) for details.

## Regional highlights

- EMEA $18.4M (+14%)
- Americas $21.2M (+8%)
- APAC $8.6M — watch churn

> Flagged by the automated variance check.

Inline \`code\` stays inline; fenced blocks go through Shiki:

\`\`\`sql
SELECT region, total FROM finance.revenue;
\`\`\`
`;

/** The full reading scale — markdown mapped onto the Prose* primitives. */
export const Default: Story = {
  args: { children: DOC },
  decorators: [
    (Story) => (
      <div className="max-w-prose">
        <Story />
      </div>
    ),
  ],
};

/**
 * The constrained rung for narrow embeds (research 09 §G.2): `baseHeadingLevel={2}`
 * maps a document `#` to the title rung — never "biggest text on screen" in a rail.
 */
export const ConstrainedHeadings: Story = {
  args: { children: DOC, baseHeadingLevel: 2 },
  decorators: [
    (Story) => (
      <div className="max-w-80">
        <Story />
      </div>
    ),
  ],
};

const CITED_DOC = `## Q3 answer

Revenue grew **12.4% QoQ**, led by EMEA[1](https://example.com/q3-report) with a smaller
lift from APAC[2](https://example.com/apac-notes).

Regular links are unaffected — see the [dashboard](https://example.com/dashboard) for the
full breakdown.
`;

/** A markdown `a` renderer that swaps a `[1](url)`-style citation marker for an
 * interactive `InlineCitation` chip; any other link renders exactly as before. */
const citationLinkComponent: NonNullable<
  ComponentProps<typeof MarkdownView>["components"]
>["a"] = ({ href, children, node: _node, ...props }) => {
  const label = typeof children === "string" ? children : "";
  if (href && /^\d+$/.test(label)) {
    return (
      <InlineCitation>
        <InlineCitationCard>
          <InlineCitationCardTrigger sources={[href]} />
          <InlineCitationCardBody>
            <div className="p-3 text-meta text-muted-foreground">Source {label}</div>
          </InlineCitationCardBody>
        </InlineCitationCard>
      </InlineCitation>
    );
  }
  return (
    <a href={href} rel="noopener noreferrer" target="_blank" {...props}>
      {children}
    </a>
  );
};

/**
 * The #10 motivating use case: a RAG answer's markdown emits `[1](url)`-style
 * citation markers. Overriding `components.a` swaps those for `InlineCitation`
 * chips — every other element (the `##` heading, the "dashboard" link) still
 * renders through the internal Prose* map because `MarkdownView` MERGES the
 * override in per key rather than replacing the whole map.
 */
export const InlineCitations: Story = {
  args: {
    children: CITED_DOC,
    components: { a: citationLinkComponent },
  },
  decorators: [
    (Story) => (
      <div className="max-w-prose">
        <Story />
      </div>
    ),
  ],
};
