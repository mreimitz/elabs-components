/**
 * Prose primitives — re-exported from @elabs-ai/components-ui (#188; ADR-0012 own/re-export
 * model: @elabs-ai/components-ui owns the canonical prose source in
 * `components/typography/prose.tsx`; this package derives). The
 * `@elabs-ai/components-editor/markdown` public surface keeps the original names
 * (Heading, Text, Link, List, ListItem, Blockquote, InlineCode).
 *
 * These must stay the SAME objects, not lookalikes: that identity is the whole
 * reason a `Prose*` change cannot drift the editor away from the chat view or
 * the file viewer. `prose.test.ts` asserts it against the package barrel — if
 * you replace a line below with a local component, that test goes red while the
 * behaviour tests in `prose.test.tsx` stay green, which is exactly the failure
 * it exists to catch.
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
} from "@elabs-ai/components-ui";
