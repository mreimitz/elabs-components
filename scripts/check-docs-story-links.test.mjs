#!/usr/bin/env node
/**
 * Self-test for `scripts/check-docs-story-links.mjs` (`pnpm docs-links:check:test`).
 *
 * A gate that can silently stop firing is worse than no gate, so each test
 * PLANTS the failure it is supposed to catch and asserts the gate reports it —
 * the rename, the missing autodocs tag — rather than only asserting the happy
 * path.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { checkDocsStoryLinks, sanitize } from "./check-docs-story-links.mjs";

/** Writes `files` (relative path → contents) into a fresh temp root. */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "docs-story-links-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }
  return root;
}

const storyFile = (title, { autodocs = true } = {}) =>
  [
    'import type { Meta } from "@storybook/react-vite";',
    "const meta = {",
    `  title: ${JSON.stringify(title)},`,
    autodocs ? '  tags: ["autodocs"],' : "",
    "} satisfies Meta;",
    "export default meta;",
    "export const Default = {};",
  ].join("\n");

const page = (link) => `<Meta title="Docs/Picking" />\n\nSee [it](${link}).\n`;

test("sanitize matches the ids Storybook actually generates", () => {
  assert.equal(sanitize("AI/ChangeReview"), "ai-changereview");
  assert.equal(sanitize("Editor/MarkdownEditor/SlashMenu"), "editor-markdowneditor-slashmenu");
  assert.equal(sanitize("Layout/App Shell/Mail"), "layout-app-shell-mail");
  assert.equal(sanitize("Foundations/Spacing & Radius"), "foundations-spacing-radius");
  assert.equal(sanitize("Docs/View Toolbar Contract"), "docs-view-toolbar-contract");
  assert.equal(sanitize("Layout/SplitPanel"), "layout-splitpanel");
});

test("a link that resolves passes", () => {
  const root = fixture({
    "packages/ui/src/widget.stories.tsx": storyFile("Core/Widget"),
    "apps/docs/stories/Picking.mdx": page("?path=/docs/core-widget--docs"),
  });
  const { errors, linkCount } = checkDocsStoryLinks(root);
  assert.deepEqual(errors, []);
  assert.equal(linkCount, 1);
  rmSync(root, { recursive: true, force: true });
});

test("a RENAMED title breaks the link and the gate says so", () => {
  const root = fixture({
    // The page still names `core-widget`; the story has moved to Layout.
    "packages/ui/src/widget.stories.tsx": storyFile("Layout/Widget"),
    "apps/docs/stories/Picking.mdx": page("?path=/docs/core-widget--docs"),
  });
  const { errors } = checkDocsStoryLinks(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /core-widget/);
  rmSync(root, { recursive: true, force: true });
});

test("a --docs link to a story with no autodocs tag fails", () => {
  const root = fixture({
    "packages/ui/src/widget.stories.tsx": storyFile("Core/Widget", { autodocs: false }),
    "apps/docs/stories/Picking.mdx": page("?path=/docs/core-widget--docs"),
  });
  const { errors } = checkDocsStoryLinks(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /autodocs/);
  rmSync(root, { recursive: true, force: true });
});

test("the same target linked as a STORY is fine without autodocs", () => {
  const root = fixture({
    "packages/ui/src/widget.stories.tsx": storyFile("Core/Widget", { autodocs: false }),
    "apps/docs/stories/Picking.mdx": page("?path=/story/core-widget--default"),
  });
  const { errors } = checkDocsStoryLinks(root);
  assert.deepEqual(errors, []);
  rmSync(root, { recursive: true, force: true });
});

test("links inside a story description are checked too, not only MDX", () => {
  const root = fixture({
    "packages/ui/src/widget.stories.tsx": storyFile("Core/Widget"),
    "packages/ui/src/other.stories.tsx":
      storyFile("Core/Other") + "\n// see ?path=/docs/core-gone--docs\n",
    "apps/docs/stories/Picking.mdx": page("?path=/docs/core-widget--docs"),
  });
  const { errors } = checkDocsStoryLinks(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /core-gone/);
  rmSync(root, { recursive: true, force: true });
});

test("sample data with a `title:` that is not a path is not mistaken for a title", () => {
  const root = fixture({
    "packages/ui/src/widget.stories.tsx":
      storyFile("Core/Widget") + '\nconst row = { title: "Book a demo" };\n',
    "apps/docs/stories/Picking.mdx": page("?path=/docs/book-a-demo--docs"),
  });
  const { errors } = checkDocsStoryLinks(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /book-a-demo/);
  rmSync(root, { recursive: true, force: true });
});

test("the real repo passes its own gate", () => {
  const { errors } = checkDocsStoryLinks();
  assert.deepEqual(errors, [], errors.join("\n"));
});
