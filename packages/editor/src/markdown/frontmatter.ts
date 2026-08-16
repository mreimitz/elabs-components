/**
 * `@elabs-ai/components-editor/markdown/frontmatter` — the lightweight frontmatter subpath.
 *
 * Just the YAML frontmatter parse/serialize (depends on `js-yaml` only). Split out
 * from the `./markdown` barrel so DATA-only consumers — a metadata form, a document
 * store — can read/write frontmatter WITHOUT pulling the editor engines (Milkdown,
 * Monaco, Streamdown) into their bundle or their unit tests. Same dependency-control
 * principle as the `.` vs `./markdown` split.
 */
export {
  parseFrontmatter,
  serializeFrontmatter,
  type ParsedDocument,
} from "../lib/markdown/frontmatter";
