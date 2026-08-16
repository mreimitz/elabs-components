/**
 * `@qlik-coe-emea/qlabs-components-editor/markdown/parse` — a Monaco-free markdown parser.
 *
 * `parseMarkdown(md)` returns the mdast `Root` for the SAME dialect the branded
 * preview parses: GitHub-flavored markdown + `:::`/`::`/`:` directives + YAML
 * frontmatter. Split onto its own leaf subpath (like `./markdown/frontmatter`) so
 * SERVER, RSC, and unit-test consumers can parse markdown WITHOUT pulling the
 * editor engines (Milkdown, Monaco, Streamdown) into their bundle — the whole
 * reason the `.` vs `./markdown` split exists. Depends only on `unified` +
 * `remark-*` (no React, no Monaco).
 *
 * It returns RAW directive mdast (`containerDirective` / `leafDirective` /
 * `textDirective` nodes) — it does NOT run `remarkBrandDirectives` (that rewrites
 * directives into the `<brand-directive>` hast tag, which is a RENDER concern).
 * Walk the tree by `node.type` + `node.name` yourself. The match is at the
 * DIALECT level (same plugins/extensions); it is not byte-identical to the tree
 * Streamdown builds internally (which also applies a streaming block-splitter).
 */
import type { Root } from "mdast";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

// Built once: a frozen parser-only processor (gfm + frontmatter + directive
// syntax extensions). `parse()` is stateless per call, so one instance is safe.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkDirective)
  .freeze();

/** Parse markdown to mdast (gfm + directives + frontmatter). Monaco-free. */
export function parseMarkdown(md: string): Root {
  return processor.parse(md) as Root;
}
