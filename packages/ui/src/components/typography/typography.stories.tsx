import { useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { Heading, Text } from "./typography";
import {
  ProseBlockquote,
  ProseHeading,
  ProseInlineCode,
  ProseLink,
  ProseList,
  ProseListItem,
  ProseText,
} from "./prose";

const meta = {
  title: "Foundations/Typography",
  component: Text,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The semantic type-role API (#187/#188): `Heading` maps a level to the " +
          "display/title/subtitle rungs; `Text` maps intent (lead/body/caption/meta/kpi/code) " +
          "to a role. Roles bundle size + leading + weight + tracking and stay composable. " +
          "`Prose*` primitives carry the reading-column scale the markdown preview maps onto.\n\n" +
          '**Type is density-aware** (#340): `data-density="compact"` shrinks the whole scale ' +
          "(−6.25%) as well as the spacing, and `spacious` grows it (+6.25%) — see the " +
          "*Density scale* story. `comfortable` is the exact identity.\n\n" +
          "**Font smoothing ships with the tokens stylesheet** (#345): the `@layer base` `body` rule in " +
          "`@elabs/components-tokens/styles.css` sets `-webkit-font-smoothing: antialiased` and " +
          "`-moz-osx-font-smoothing: grayscale`, so every consumer inherits it from the one import. Do not " +
          "re-add those two lines in an app stylesheet. It is a base-layer rule, so an app that genuinely " +
          "wants subpixel rendering can still override it.",
      },
    },
  },
} satisfies Meta<typeof Text>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Body text — the default role (text-body == text-sm by design)." },
};

export const TextVariants: Story = {
  render: () => (
    <div className="max-w-2xl space-y-3">
      <Text variant="lead">Lead — a lead paragraph: the subtitle rung at body weight.</Text>
      <Text variant="body">Body — default reading text for app surfaces.</Text>
      <Text variant="caption">Caption — secondary / supporting body.</Text>
      <Text variant="meta">Meta — metadata, eyebrows, timestamps.</Text>
      <Text variant="kpi">12,480</Text>
      <Text variant="code">pnpm --filter @elabs/components-ui test</Text>
    </div>
  ),
};

export const Tones: Story = {
  render: () => (
    <div className="space-y-2">
      <Text tone="default">Default tone — foreground.</Text>
      <Text tone="muted">Muted tone — secondary information.</Text>
      <Text tone="primary">Primary tone — brand emphasis.</Text>
    </div>
  ),
};

export const Headings: Story = {
  render: () => (
    <div className="space-y-3">
      <Heading level={1}>Level 1 — display</Heading>
      <Heading level={2}>Level 2 — title</Heading>
      <Heading level={3}>Level 3 — title</Heading>
      <Heading level={4}>Level 4 — subtitle</Heading>
      <Heading level={5}>Level 5 — subtitle</Heading>
      <Heading level={6}>Level 6 — subtitle</Heading>
    </div>
  ),
};

export const HeadingSizeOverride: Story = {
  render: () => (
    <div className="space-y-3">
      <Heading level={2} size="display">
        An h2 that reads as display
      </Heading>
      <Heading level={2} size="subtitle">
        An h2 that reads as subtitle — the tag keeps the document outline
      </Heading>
    </div>
  ),
};

export const AsAndAsChild: Story = {
  render: () => (
    <div className="space-y-3">
      <Text as="span" variant="meta" tone="muted">
        Rendered as a span
      </Text>
      <Heading level={2} asChild>
        <a href="#typography">A heading that is a link (asChild)</a>
      </Heading>
    </div>
  ),
};

/**
 * The DENSITY dial rescales type as well as spacing (#340). Literal `text-<role>`
 * classes (not a template string) so Tailwind statically emits every rung.
 */
const DENSITY_COLUMNS = [
  { mode: "compact", label: "Compact", note: "−6.25% type · −11% spacing" },
  { mode: "comfortable", label: "Comfortable", note: "identity — the default" },
  { mode: "spacious", label: "Spacious", note: "+6.25% type · +12% spacing" },
] as const;

const DENSITY_ROLES = [
  { role: "display", cls: "text-display", sample: "Pipeline health" },
  { role: "title", cls: "text-title", sample: "Ingestion failures" },
  { role: "subtitle", cls: "text-subtitle", sample: "Last 24 hours" },
  {
    role: "body",
    cls: "text-body",
    sample: "Four sources missed their window; two recovered on retry.",
  },
  { role: "caption", cls: "text-caption", sample: "Retries are counted per source, not per file." },
  { role: "meta", cls: "text-meta", sample: "Updated 3 minutes ago" },
  { role: "kpi", cls: "text-kpi tabular-nums", sample: "12,480" },
  { role: "code", cls: "text-code font-mono", sample: "sources.retry(max=3)" },
] as const;

/** One role row, with its measured rendered size so the dial is observable. */
function DensityRoleRow({ role, cls, sample }: (typeof DENSITY_ROLES)[number]) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [measured, setMeasured] = useState("");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { fontSize, lineHeight } = getComputedStyle(el);
    setMeasured(fontSize && lineHeight ? `${fontSize} / ${lineHeight}` : "");
  }, []);
  return (
    <div className="space-y-1 border-t border-border py-2 first:border-t-0">
      <p className="m-0 flex items-baseline justify-between gap-3 text-meta text-muted-foreground">
        <span>{role}</span>
        <span className="tabular-nums" data-testid={`measured-${role}`}>
          {measured}
        </span>
      </p>
      <p ref={ref} className={`m-0 ${cls}`} data-testid={`sample-${role}`}>
        {sample}
      </p>
    </div>
  );
}

export const DensityScale: Story = {
  name: "Density scale",
  parameters: {
    docs: {
      description: {
        story:
          "The same eight roles at all three densities, side by side. Density scales the " +
          "type SIZE and LINE-HEIGHT (weight and tracking are untouched) alongside the " +
          "spacing, so a compact surface tightens as a whole. `comfortable` is the exact " +
          "identity — pixel-identical to a pre-#340 build. The measured `font-size / " +
          "line-height` under each role name is read live from the browser, so the columns " +
          "cannot claim a difference they do not render.",
      },
    },
  },
  render: () => (
    <div className="space-y-4">
      <p className="m-0 max-w-prose text-caption text-muted-foreground">
        Each column pins its own <code className="text-code">data-density</code>. Type shrinks at
        roughly HALF the rate of spacing — whitespace can be cut hard before a layout stops working,
        text cannot. Compact body lands at 13.125px, above the 13px reading floor.
      </p>
      <div className="flex flex-wrap gap-6">
        {DENSITY_COLUMNS.map(({ mode, label, note }) => (
          <section key={mode} className="min-w-64 flex-1 space-y-2">
            <Heading level={3} size="subtitle">
              {label}
            </Heading>
            <Text variant="meta" tone="muted">
              {note}
            </Text>
            {/* The dial itself — everything below scales, the label above does not,
                so the three columns stay comparable. */}
            <div data-density={mode} className="rounded-lg border border-border p-3">
              {DENSITY_ROLES.map((r) => (
                <DensityRoleRow key={r.role} {...r} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  ),
  // Asserts the dial on the REAL rendered surface: the source-parsed token test
  // proves the arithmetic, this proves a browser actually applies it.
  play: async ({ canvas }) => {
    const px = (el: HTMLElement) => parseFloat(getComputedStyle(el).fontSize);
    const columns = canvas.getAllByTestId("sample-body");
    expect(columns).toHaveLength(3);
    const [compact, comfortable, spacious] = columns.map(px);

    // Identity: comfortable is still the shipped 14px body.
    expect(comfortable).toBe(14);
    // Direction: the dial actually moves type, both ways.
    expect(compact).toBeLessThan(comfortable);
    expect(spacious).toBeGreaterThan(comfortable);
    // Legibility floor: compact body never drops below 13px.
    expect(compact).toBeGreaterThanOrEqual(13);
    // Weight is a semantic rung — it does NOT scale with density.
    for (const el of columns) expect(getComputedStyle(el).fontWeight).toBe("400");
  },
};

export const Prose: Story = {
  render: () => (
    <div className="max-w-2xl space-y-3">
      <ProseHeading level={1}>Prose heading level 1</ProseHeading>
      <ProseHeading level={2}>Prose heading level 2</ProseHeading>
      <ProseHeading level={3}>Prose heading level 3</ProseHeading>
      <ProseText>
        Body text with an <ProseLink href="https://example.com">external link</ProseLink> and some{" "}
        <ProseInlineCode>inline code</ProseInlineCode>.
      </ProseText>
      <ProseText variant="muted">Muted helper text.</ProseText>
      <ProseBlockquote>A blockquote rendered through the branded primitive.</ProseBlockquote>
      <ProseList>
        <ProseListItem>First bullet</ProseListItem>
        <ProseListItem>Second bullet</ProseListItem>
      </ProseList>
      <ProseList ordered>
        <ProseListItem>First step</ProseListItem>
        <ProseListItem>Second step</ProseListItem>
      </ProseList>
    </div>
  ),
};
