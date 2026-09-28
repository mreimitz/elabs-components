import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const root = fileURLToPath(new URL("../../", import.meta.url));
const ui = fileURLToPath(new URL("../../../../packages/ui/src/", import.meta.url));
const {
  module: { StoryMarkdown },
} = await runnerImport(`${root}/src/story/story-markdown.tsx`, {
  root,
  configFile: false,
  logLevel: "error",
  plugins: [
    {
      name: "story-typography-only",
      enforce: "pre",
      resolveId(id) {
        if (id === "@elabs-ai/components-ui") return "\0story-typography";
      },
      load(id) {
        if (id === "\0story-typography")
          return `export { Text } from ${JSON.stringify(`${ui}components/typography/typography.tsx`)}; export { ProseLink } from ${JSON.stringify(`${ui}components/typography/prose.tsx`)}; export { cn } from ${JSON.stringify(`${ui}lib/cn.ts`)};`;
      },
    },
  ],
});
const render = (text) => renderToStaticMarkup(createElement(StoryMarkdown, { text }));
test("caption prose formats emphasis, code and paragraphs", () => {
  const html = render("The **gateway** dials *out*.\n\nUse `<tenant>` and __bold__ or _italics_.");
  assert(html.includes("<strong>gateway</strong>"));
  assert(html.includes("<em>out</em>"));
  assert(html.includes("&lt;tenant&gt;</code>"));
  assert.equal((html.match(/<p /g) ?? []).length, 2);
});
test("only safe links render as links", () => {
  const html = render(
    "[Docs](https://example.com) [Mail](mailto:a@example.com) [Bad](javascript:alert) [Encoded](java&#115;cript:alert) [Local](#home)",
  );
  assert.equal((html.match(/<a /g) ?? []).length, 2);
  assert(html.includes('rel="noopener noreferrer"'));
  assert(!html.includes('href="javascript:'));
});
test("HTML and images stay inert text without media or network elements", () => {
  const html = render(
    '<img src="https://example.com/pixel" onerror="alert(1)"> ![tracker](https://example.com/pixel) <script>alert(1)</script>',
  );
  assert(!/<(?:img|script|iframe|video|audio)\b/.test(html));
  assert(!html.includes("<a "));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("![tracker]"));
});
