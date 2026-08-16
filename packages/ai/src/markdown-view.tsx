"use client";

/**
 * MarkdownView — the branded READ-ONLY markdown renderer (#193, research 04 §5).
 *
 * Renders a markdown *document* as a document — never as Shiki source (that
 * was the ASSET-2 defect: `CodeBlock code={…} language="markdown"`). Built on
 * the EXISTING `streamdown` dependency (no new heavy dep), but unlike the
 * streaming `MessageResponse` it maps the element tree onto the promoted
 * `Prose*` primitives from `@elabs/components-ui` via a `components` map — one
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
} from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";
import { useStreamdownPlugins, useStreamdownTranslations } from "./_streamdown-i18n";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { Streamdown } from "streamdown";

type StreamdownComponents = NonNullable<ComponentProps<typeof Streamdown>["components"]>;

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
  "components" | "plugins"
> {
  /**
   * The prose level a markdown `#` maps to; deeper headings shift with it
   * (capped at 6). Default `1` (the full reading scale). Pass `2` in narrow
   * embeds (a context rail) so headings stay on the constrained rung.
   */
  baseHeadingLevel?: ProseHeadingLevel;
}

export const MarkdownView = ({
  baseHeadingLevel = 1,
  className,
  children,
  ...props
}: MarkdownViewProps) => {
  const components = useMemo(() => buildProseComponents(baseHeadingLevel), [baseHeadingLevel]);
  // Streamdown's own chrome (code copy, table menus) reads the locale seam (#310).
  // Spread AFTER so an explicit `translations` prop still wins (ADR 0017).
  const translations = useStreamdownTranslations();
  // Brand-token-derived `code` plugin, not the package's static github-*
  // default (#315 follow-up) — re-derives when the active theme changes.
  const plugins = useStreamdownPlugins();
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
