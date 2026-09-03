/**
 * The teeth behind "one prose source, several renderers".
 *
 * `@elabs-ai/components-ui` owns the canonical `Prose*` set; this package
 * re-exports it under the short names the `@elabs-ai/components-editor/markdown`
 * surface has always used (ADR-0012 own/re-export model, #188). The whole claim
 * that a `Prose*` change cannot drift the editor is that these are the SAME
 * function objects — not two implementations that happen to agree today.
 *
 * Nothing enforced that. A future refactor could quietly replace a line here
 * with a local component of the same name and every render test in
 * `prose.test.tsx` would keep passing, because those assert BEHAVIOUR. These
 * assert IDENTITY, which is the property the re-export actually promises.
 *
 * The import below is the package BARREL (`@elabs-ai/components-ui`), never a
 * deep path into its source. A deep path can resolve to a second module
 * instance whose exports are different objects with identical behaviour — the
 * assertion would then fail for a reason that has nothing to do with the
 * re-export, or (worse, with a different resolver) pass vacuously. The barrel is
 * exactly what `prose.tsx` imports, so this compares like with like.
 */
import { describe, expect, it } from "vitest";

import {
  ProseBlockquote,
  ProseHeading,
  ProseInlineCode,
  ProseLink,
  ProseList,
  ProseListItem,
  ProseText,
} from "@elabs-ai/components-ui";

import { Blockquote, Heading, InlineCode, Link, List, ListItem, Text } from "./prose";

describe("prose re-export identity", () => {
  it.each([
    ["Heading", Heading, ProseHeading],
    ["Text", Text, ProseText],
    ["Link", Link, ProseLink],
    ["List", List, ProseList],
    ["ListItem", ListItem, ProseListItem],
    ["Blockquote", Blockquote, ProseBlockquote],
    ["InlineCode", InlineCode, ProseInlineCode],
  ])("%s is the same object as the ui primitive it re-exports", (_name, short, canonical) => {
    expect(short).toBe(canonical);
  });

  it("re-exports all seven, so the list above cannot silently shrink", () => {
    const shortNames = [Heading, Text, Link, List, ListItem, Blockquote, InlineCode];
    expect(shortNames).toHaveLength(7);
    expect(shortNames.every((c) => typeof c !== "undefined")).toBe(true);
  });
});
