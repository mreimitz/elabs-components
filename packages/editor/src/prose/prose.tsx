/**
 * Prose primitives — re-exported from @elabs/components-ui (#188; ADR-0012 own/re-export
 * model: @elabs/components-ui owns the canonical prose source in
 * `components/typography/prose.tsx`; this package derives). The
 * `@elabs/components-editor/markdown` public surface keeps the original names
 * (Heading, Text, Link, List, ListItem, Blockquote, InlineCode).
 */
export {
  ProseHeading as Heading,
  ProseText as Text,
  ProseLink as Link,
  ProseList as List,
  ProseListItem as ListItem,
  ProseBlockquote as Blockquote,
  ProseInlineCode as InlineCode,
  type ProseHeadingProps as HeadingProps,
  type ProseHeadingLevel as HeadingLevel,
  type ProseTextProps as TextProps,
  type ProseLinkProps as LinkProps,
  type ProseListProps as ListProps,
} from "@elabs/components-ui";
