import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { ProseLink, Text, cn } from "@elabs-ai/components-ui";

/** Captions use a deliberately small prose dialect: paragraphs, emphasis, inline code and
 * links. The full editor preview has media/HTML renderers; captions must never fetch media.
 * Every unmatched character stays a React text node, including raw HTML and image syntax. */
function inline(text: string): ReactNode[] {
  const pattern =
    /\\([\\`*_[\]!])|`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|!?\[([^\]\n]+)\]\(([^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index!;
    parts.push(text.slice(cursor, at));
    const [token, escaped, code, strong, bold, emphasis, italic, label, url] = match;
    if (escaped) parts.push(escaped);
    else if (code)
      parts.push(
        <code key={at} className="font-mono">
          {code}
        </code>,
      );
    else if (strong || bold) parts.push(<strong key={at}>{strong ?? bold}</strong>);
    else if (emphasis || italic) parts.push(<em key={at}>{emphasis ?? italic}</em>);
    else if (
      !token.startsWith("!") &&
      url &&
      /^(https?:\/\/|mailto:)/i.test(url) &&
      !Array.from(url).some(
        (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
      )
    ) {
      parts.push(
        <ProseLink key={at} href={url}>
          {label}
        </ProseLink>,
      );
    } else parts.push(token);
    cursor = at + token.length;
  }
  parts.push(text.slice(cursor));
  return parts;
}
export interface StoryMarkdownProps extends HTMLAttributes<HTMLDivElement> {
  text: string;
}
export const StoryMarkdown = forwardRef<HTMLDivElement, StoryMarkdownProps>(function StoryMarkdown(
  { text, className, ...props },
  ref,
) {
  const occurrences = new Map<string, number>();
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const occurrence = occurrences.get(paragraph) ?? 0;
      occurrences.set(paragraph, occurrence + 1);
      return { paragraph, id: `${paragraph}:${occurrence}` };
    });
  return (
    <div
      ref={ref}
      data-slot="story-markdown"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {paragraphs.map(({ paragraph, id }) => (
        <Text key={id} variant="meta" className="whitespace-pre-line break-words">
          {inline(paragraph)}
        </Text>
      ))}
    </div>
  );
});
