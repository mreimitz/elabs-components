"use client";

/**
 * MarkdownView — the branded READ-ONLY markdown renderer (#193, research 04 §5).
 *
 * Renders a markdown *document* as a document — never as Shiki source (that
 * was the ASSET-2 defect: `CodeBlock code={…} language="markdown"`). Built on
 * the EXISTING `streamdown` dependency (no new heavy dep), but unlike the
 * streaming `MessageResponse` it maps the element tree onto the promoted
 * `Prose*` primitives from `@elabs-ai/components-ui` via a `components` map — one
 * source-owned prose set for chat answers, the editor preview and this view.
 *
 * `baseHeadingLevel` is the constrained-rung seam (research 04 §5 / 09 §G.2):
 * inside a narrow rail pass `baseHeadingLevel={2}` so a document `#` renders
 * at the `title` rung, not the reading-scale h1 — never "biggest text on
 * screen" inside a 20rem panel.
 */
import {
  ProseBlockquote,
  ProseHeading,
  ProseInlineCode,
  ProseLink,
  ProseList,
  ProseListItem,
  ProseText,
  type ProseHeadingLevel,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { stripSanitizerOverrides } from "./_streamdown-safety";
import { useStreamdownPlugins, useStreamdownTranslations } from "./_streamdown-i18n";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Streamdown } from "streamdown";

type StreamdownComponents = NonNullable<ComponentProps<typeof Streamdown>["components"]>;
type StreamdownPlugins = ComponentProps<typeof Streamdown>["plugins"];

const MAX_HEADING_LEVEL = 6;

const clampHeadingLevel = (level: number): ProseHeadingLevel =>
  Math.min(MAX_HEADING_LEVEL, Math.max(1, level)) as ProseHeadingLevel;

/**
 * Map the markdown element tree onto the Prose* primitives. Fenced code blocks
 * (className `language-*`) stay with the streamdown `code` plugin (Shiki);
 * only INLINE code re-maps to `ProseInlineCode`.
 */
function buildProseComponents(baseHeadingLevel: ProseHeadingLevel): StreamdownComponents {
  const heading =
    (markdownLevel: number): StreamdownComponents["h1"] =>
    ({ node: _node, ...props }) => (
      <ProseHeading level={clampHeadingLevel(markdownLevel + baseHeadingLevel - 1)} {...props} />
    );
  return {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    p: ({ node: _node, ...props }) => <ProseText {...props} />,
    a: ({ node: _node, ...props }) => <ProseLink {...props} />,
    // `ref` is stripped: ProseList's intersection ref type (ul & ol) is
    // narrower than the per-element ref react-markdown passes.
    ul: ({ node: _node, ref: _ref, ...props }) => <ProseList {...props} />,
    ol: ({ node: _node, ref: _ref, ...props }) => <ProseList ordered {...props} />,
    li: ({ node: _node, ...props }) => <ProseListItem {...props} />,
    blockquote: ({ node: _node, ...props }) => <ProseBlockquote {...props} />,
    code: ({ node: _node, className, ...props }) =>
      /\blanguage-/.test(className ?? "") ? (
        <code className={className} {...props} />
      ) : (
        <ProseInlineCode className={className} {...props} />
      ),
  };
}

export interface MarkdownViewProps extends Omit<
  ComponentProps<typeof Streamdown>,
  "components" | "plugins" | "rehypePlugins"
> {
  /**
   * The prose level a markdown `#` maps to; deeper headings shift with it
   * (capped at 6). Default `1` (the full reading scale). Pass `2` in narrow
   * embeds (a context rail) so headings stay on the constrained rung.
   */
  baseHeadingLevel?: ProseHeadingLevel;
  /**
   * Per-element renderer overrides, MERGED over the internal Prose* map
   * (#10) — a consumer entry wins for its key; every key the consumer does
   * NOT set keeps rendering through `buildProseComponents()`. This is the
   * seam for rendering inline citations: override `a` (or a custom node
   * type) to swap a `[1](url)`-style marker for an `InlineCitation` chip
   * while headings/lists/etc. keep the branded prose styling.
   *
   * Deliberately a MERGE, not a replace: sanitisation is unaffected either
   * way (see `plugins` below), but a wholesale replace would silently drop
   * the branded styling from every element the consumer didn't think to
   * re-declare — a citation override should not have to also re-implement
   * headings/lists/code to keep them on-brand.
   *
   * **Known constraint: a `components` change alone does not force a
   * re-render of already-rendered markdown (#10).** Streamdown memoizes on
   * `children`/`plugins`/theme/etc but NOT on `components`
   * (`streamdown@2.5.0`'s top-level `memo` comparator omits it), so if the
   * SAME markdown string is still current when an override's closed-over
   * data changes — e.g. an inline-citation chip that resolves its title
   * asynchronously — the new render function is captured but nothing
   * schedules Streamdown to call it again. Don't rely on a `components`
   * closure to reflect state that arrives after the initial render; instead
   * have the overriding component read that state itself (a shared context,
   * a store keyed by citation id, or an internal `useState`/subscription
   * inside the override) so IT re-renders independently of `MarkdownView`'s
   * own render pass — the pattern `InlineCitation`/`InlineCitationCard`
   * already use.
   */
  components?: StreamdownComponents;
  /**
   * Streamdown plugin-slot overrides (`cjk`/`code`/`math`/`mermaid`/
   * `renderers`), MERGED per key over the internal defaults (the reactive,
   * brand-token-derived `code` plugin and i18n-aware `cjk`/`math`/`mermaid`
   * set — see `_streamdown-i18n.ts`).
   *
   * **This narrow `plugins` prop can only APPEND — it can never displace
   * Streamdown's default `rehypePlugins` chain** (`rehype-raw` →
   * `rehype-sanitize` → `rehype-harden`). `MarkdownView` never sets
   * `rehypePlugins` itself, and nothing in `PluginConfig` removes or replaces
   * a member of that pipeline, so the sanitiser cannot be turned off through
   * this prop. But two of the five slots are **not** upstream of it and must
   * be treated as trusted code:
   * - **`math.rehypePlugin` runs AFTER `rehype-sanitize`/`rehype-harden`**
   *   (appended to the end of the rehype pipeline, verified against
   *   `streamdown@2.5.0`'s `dist/chunk-BO2N2NFS.js`) — its output is never
   *   re-sanitised.
   * - **`mermaid` never enters the rehype/remark pipeline at all.** Its
   *   `getMermaid().render()` result is written via
   *   `dangerouslySetInnerHTML` (streamdown's only such sink). brand-ui's own
   *   `useStreamdownPlugins()` default pins `securityLevel: "strict"`
   *   (`_lazy-mermaid.ts`); a replacement `mermaid` plugin must sanitise its
   *   own SVG output the same way.
   * - `cjk` (remark-stage only — its output is re-sanitised downstream by
   *   the rehype pipeline like any other remark result), `code` (feeds only
   *   `shikiTheme`, no HTML injection) and `renderers` (ordinary React
   *   components rendered with the fenced block's raw `code` string as a
   *   `string` prop, the same trusted-component boundary as a `components`
   *   override) do not bypass sanitisation.
   *
   * **`rehypePlugins` is NOT exposed on this component (#36, fixed).** Unlike
   * `plugins`, a caller-supplied `rehypePlugins` array would REPLACE
   * Streamdown's default rehype pipeline wholesale rather than extending it,
   * silently dropping `rehype-raw`/`rehype-sanitize`/`rehype-harden` and
   * letting a plain markdown string execute script in the host page — so
   * `MarkdownViewProps` `Omit`s it at the type level AND
   * `stripSanitizerOverrides()` deletes it at runtime before the `{...props}`
   * spread below, even if a JS consumer or a cast reaches this component with
   * it set. If you need to widen sanitisation, use
   * `allowedTags`/`literalTagContent`, which MERGE into the sanitize schema
   * instead of replacing the pipeline. See
   * `packages/ai/src/_streamdown-safety.ts`.
   *
   * **`remarkPlugins` IS supported** (PR #74 review, round 1 — the original
   * #36 fix over-reached and removed it too). The remark stage runs strictly
   * upstream of the rehype chain, and Streamdown builds its rehype list
   * without reading `remarkPlugins`, so everything a remark plugin emits is
   * still sanitised downstream — measured across raw-`html` mdast nodes,
   * `data.hName`/`hChildren` hast elements, `hProperties` event handlers,
   * `javascript:` link URLs and smuggled `raw` hast children. Note the
   * ordinary (non-security) footgun: your array REPLACES Streamdown's own
   * remark defaults (`remark-gfm`, `codeMeta`), so spread
   * `Object.values(defaultRemarkPlugins)` from `streamdown` back in if you
   * want to keep GFM tables/strikethrough.
   */
  plugins?: StreamdownPlugins;
}

export const MarkdownView = ({
  baseHeadingLevel = 1,
  className,
  children,
  components: componentOverrides,
  plugins: pluginOverrides,
  ...props
}: MarkdownViewProps) => {
  // Streamdown installs [rehypeRaw, rehypeSanitize, harden] as the DEFAULT VALUE of
  // `rehypePlugins`; a supplied array REPLACES it. This component renders untrusted
  // model output, so the chain is not overridable. Widen with `allowedTags` /
  // `literalTagContent`, which merge into the sanitize schema. See issue #36.
  // `remarkPlugins` is deliberately left alone — it runs upstream of the rehype
  // chain and cannot bypass it (PR #74 review; see `_streamdown-safety.ts`).
  stripSanitizerOverrides(props);
  const internalComponents = useMemo(
    () => buildProseComponents(baseHeadingLevel),
    [baseHeadingLevel],
  );
  // Consumer entries win per key; every other key falls through to the
  // internal Prose* map — see the `components` prop doc above.
  const components = useMemo(
    () => ({ ...internalComponents, ...componentOverrides }),
    [internalComponents, componentOverrides],
  );
  // Streamdown's own chrome (code copy, table menus) reads the locale seam (#310).
  // Spread AFTER so an explicit `translations` prop still wins (ADR 0017).
  const translations = useStreamdownTranslations();
  // Brand-token-derived `code` plugin, not the package's static github-*
  // default (#315 follow-up) — re-derives when the active theme changes.
  const internalPlugins = useStreamdownPlugins();
  // Same per-key merge as `components` — see the `plugins` prop doc above.
  const plugins = useMemo(
    () => ({ ...internalPlugins, ...pluginOverrides }),
    [internalPlugins, pluginOverrides],
  );
  return (
    <Streamdown
      data-slot="markdown-view"
      className={cn("space-y-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      components={components}
      plugins={plugins}
      translations={translations}
      {...props}
    >
      {children}
    </Streamdown>
  );
};
