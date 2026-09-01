import { useLayoutEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { cn } from "../../lib/cn";
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
          "`@elabs-ai/components-tokens/styles.css` sets `-webkit-font-smoothing: antialiased` and " +
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
      <Text variant="code">pnpm --filter @elabs-ai/components-ui test</Text>
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

/**
 * The CJK FONT FALLBACK + LINE-BREAKING seam (#15). `--font-cjk-sans` is a
 * dedicated tail in `--font-sans` (system faces only — never bundled; a CJK
 * face is megabytes and every target platform already ships one) that
 * `:lang(zh)` / `:lang(ko)` re-point per locale (`ja` is the root default);
 * `:lang(ja)`/`:lang(zh)` also get `line-break: strict` and `:lang(ko)` gets
 * `word-break: keep-all` (`themes.css` §§ "CJK PER-LOCALE FONT SEAM" / "CJK
 * line-breaking"). Before this story, no story anywhere rendered CJK text, so
 * none of this was exercised.
 *
 * The designed real-world shape is `<html lang="zh">` for a whole document,
 * with `font-family: var(--font-sans)` declared ONCE at that same theme-root
 * element. That matters for how this story has to be built: a custom
 * property's `var()` references are substituted at the element that declares
 * the property, and the RESULT — not the raw token stream — is what
 * descendants inherit. So `--font-sans`'s `var(--font-cjk-sans)` is resolved
 * once, at the theme root, using whatever `lang` is active THERE; a nested
 * `:lang(zh)` further down only re-points `--font-cjk-sans` on that
 * descendant — it does nothing for `--font-sans`, which the descendant never
 * redeclares, only inherits pre-resolved. To show all three locales side by
 * side under one shared theme root (whose own `lang` cannot be three things
 * at once), each "with the seam" sample below redeclares the SAME expansion
 * `--font-sans` itself uses (see `themes/light.css`/`themes/dark.css`)
 * directly in its `style`, so the `var(--font-cjk-sans)` substitution happens
 * fresh, at that element, against the `--font-cjk-sans` value its own `lang`
 * cascades in via `:lang()`.
 */
type CjkSample = {
  lang: "ja" | "zh" | "ko";
  label: string;
  rule: string;
  text: string;
  width?: string; // Optional custom width, defaults to w-56
};

const CJK_SAMPLES: readonly CjkSample[] = [
  {
    lang: "ja",
    label: "Japanese (ja)",
    rule: "line-break: strict",
    text:
      "この文章は十分に長く、コンテナの幅を超えるとブラウザが自動的に折り返しを行います。" +
      "折り返しの際に句読点や閉じ括弧（このように）が行頭に来ないようにするのが、" +
      "line-break: strict の役割です。",
  },
  {
    lang: "zh",
    label: "Chinese (zh)",
    rule: "line-break: strict",
    text:
      "这段文字足够长，当容器宽度不足时浏览器会自动换行。line-break: strict 的作用是避免" +
      "标点符号（例如逗号、句号或右括号）出现在行首，让排版更符合中文书写习惯。",
  },
  {
    lang: "ko",
    label: "Korean (ko)",
    rule: "word-break: keep-all",
    text:
      "소프트웨어개발환경구축및정보통신기술표준화를위한국제협력과연구개발사업이진행되고있습니다. " +
      "word-break: keep-all 속성은 긴 복합어 중간에서 줄이 바뀌지 않도록 보장하여 " +
      "가독성을 지켜 줍니다.",
    width: "w-36",
  },
];

/** One locale panel: the seam ON (real `lang`) next to the seam forced OFF, for comparison. */
function CjkPanel({ sample }: { sample: CjkSample }) {
  const { lang, label, rule, text, width = "w-56" } = sample;
  const withSeamRef = useRef<HTMLParagraphElement>(null);
  const [measured, setMeasured] = useState("");
  useLayoutEffect(() => {
    const el = withSeamRef.current;
    if (!el) return;
    const { lineBreak, wordBreak, fontFamily } = getComputedStyle(el);
    setMeasured(`line-break: ${lineBreak} · word-break: ${wordBreak} · font-family: ${fontFamily}`);
  }, []);
  return (
    <section aria-labelledby={`cjk-${lang}`} className="space-y-2">
      <h3 id={`cjk-${lang}`} className="text-subtitle text-foreground">
        {label} — <code className="text-code">{rule}</code>
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <figure className="m-0 space-y-1">
          <figcaption className="text-meta text-muted-foreground">
            Without the seam (comparison only — line-break/word-break forced to the CSS-initial
            default)
          </figcaption>
          {/* Comparison-only override to show what the seam replaces; a real
              consumer never does this. Font-family is left alone here — this
              column isolates the LINE-BREAKING half of the seam. */}
          <p
            lang={lang}
            style={{ fontFamily: "var(--font-sans)", lineBreak: "auto", wordBreak: "normal" }}
            className={cn("m-0 rounded-md border border-border bg-card p-3 text-body", width)}
          >
            {text}
          </p>
        </figure>
        <figure className="m-0 space-y-1">
          <figcaption className="text-meta text-muted-foreground">
            With the seam (the default result of{" "}
            <code className="text-code">lang=&quot;{lang}&quot;</code>)
          </figcaption>
          <p
            ref={withSeamRef}
            lang={lang}
            data-testid={`cjk-with-seam-${lang}`}
            // Redeclares --font-sans's own expansion (themes/light.css,
            // themes/dark.css) directly, rather than using
            // `var(--font-sans)`, because --font-sans is inherited from the
            // shared theme root as an ALREADY-substituted string — see the
            // comment above CjkSample. Writing the expansion here forces the
            // `var(--font-cjk-sans)` substitution to happen at THIS element,
            // against the value its own `lang` cascades in.
            style={{
              fontFamily:
                'Inter, var(--font-cjk-sans), "Helvetica Neue", Helvetica, Arial, sans-serif',
            }}
            className={cn("m-0 rounded-md border border-border bg-card p-3 text-body", width)}
          >
            {text}
          </p>
        </figure>
      </div>
      {/* The declared (not rendered) values — a real, un-bundled system CJK
          face never looks identical across two machines, so THIS is what a
          reviewer can actually verify: the correct stack is being asked for.

          NOTE: document.fonts.check() is NOT used to verify font resolution
          (issue #62). That API reports load status, not face existence — it
          returns true even for nonexistent font names. The measured values
          instead read the browser's own getComputedStyle output, which is
          verifiable. */}
      <p className="m-0 text-meta text-muted-foreground" data-testid={`cjk-measured-${lang}`}>
        {measured || "measuring…"}
      </p>
    </section>
  );
}

export const CJKFontAndLineBreaking: Story = {
  name: "CJK font fallback + line-breaking (#15)",
  parameters: {
    docs: {
      description: {
        story:
          "Japanese, Chinese and Korean samples, each wrapped in a narrow (14rem) column so " +
          "the text wraps across multiple lines — the line-breaking rules need a real wrap " +
          "point to have anything to do.\n\n" +
          "**Verification by locale:**\n" +
          "* **Japanese (`ja`) and Chinese (`zh`):** `line-break: strict` is verified via " +
          "computed style only; no empirically-validated visual wrap difference has been found at " +
          "this column width for any practical sample text in chromium or webkit, so the rendered " +
          "layout is NOT asserted to differ. The rule is confirmed present via `getComputedStyle`.\n" +
          "* **Korean (`ko`):** `word-break: keep-all` is verified both via computed style AND " +
          "an actual rendered wrap-position difference assertion in the play function.\n\n" +
          "The measured line under each pair reads the browser's OWN computed `line-break` / " +
          "`word-break` / `font-family`, live. Rendered glyph shape depends on which CJK system " +
          "fonts are installed on the machine viewing this story (none are bundled, by design " +
          "— #15); the declared font STACK is what is verifiable everywhere.",
      },
    },
  },
  render: () => (
    <div className="max-w-3xl space-y-8">
      {CJK_SAMPLES.map((s) => (
        <CjkPanel key={s.lang} sample={s} />
      ))}
    </div>
  ),
  // Asserts the seam on the REAL rendered surface, mirroring the DensityScale
  // play function above: read the browser's actual computed style rather than
  // re-deriving the CSS by hand.
  play: async ({ canvas }) => {
    const ja = canvas.getByTestId("cjk-with-seam-ja");
    const zh = canvas.getByTestId("cjk-with-seam-zh");
    const ko = canvas.getByTestId("cjk-with-seam-ko");

    // :lang(ja), :lang(zh) => line-break: strict. :lang(ko) is NOT in that
    // rule, so it stays at the CSS-initial value ("auto").
    expect(getComputedStyle(ja).lineBreak).toBe("strict");
    expect(getComputedStyle(zh).lineBreak).toBe("strict");
    expect(getComputedStyle(ko).lineBreak).toBe("auto");

    // :lang(ko) => word-break: keep-all. ja/zh are NOT in that rule, so they
    // stay at the CSS-initial value ("normal").
    expect(getComputedStyle(ko).wordBreak).toBe("keep-all");
    expect(getComputedStyle(ja).wordBreak).toBe("normal");
    expect(getComputedStyle(zh).wordBreak).toBe("normal");

    // --font-cjk-sans is re-pointed per :lang() — the DECLARED face list
    // differs by locale, which is what the fallback seam actually ships.
    expect(getComputedStyle(ja).fontFamily).toContain("Hiragino Sans");
    expect(getComputedStyle(zh).fontFamily).toContain("PingFang SC");
    expect(getComputedStyle(ko).fontFamily).toContain("Apple SD Gothic Neo");

    // Korean's word-break: keep-all must produce a RENDERED wrap-position
    // difference. Measure bounding height via getClientRects — if the seam
    // (word-break: keep-all) doesn't change the wrap, the height stays the
    // same. Find the corresponding "without the seam" panel by the section's
    // sibling figure.
    const koSection = canvas.getByTestId("cjk-with-seam-ko").closest("section");
    if (!koSection) throw new Error("Korean section not found");
    const koFigures = Array.from(koSection.querySelectorAll("figure"));
    if (koFigures.length < 2) throw new Error("Korean figures not found");

    const withSeamFigure = koFigures[1]; // "With the seam" is the second figure
    const withoutSeamFigure = koFigures[0]; // "Without the seam" is the first figure

    const withSeamP = withSeamFigure.querySelector("p");
    const withoutSeamP = withoutSeamFigure.querySelector("p");

    if (!withSeamP || !withoutSeamP) {
      throw new Error("Korean paragraph elements not found");
    }

    // Measure bounding height: the word-break property should change how the
    // text wraps, resulting in a different total height.
    const withSeamHeight = withSeamP.getBoundingClientRect().height;
    const withoutSeamHeight = withoutSeamP.getBoundingClientRect().height;

    // Assert they differ — word-break: keep-all should prevent word breaks
    // that would otherwise occur, changing the layout.
    expect(withSeamHeight).not.toBe(withoutSeamHeight);
  },
};
