/**
 * collect-exports.test.mjs — locks the barrel-export crawler against two
 * compounding mis-parses in `export { ... }` blocks, both surfaced by the
 * same real regression (#82 round-2 follow-up).
 *
 * `collectExports` (packages/cli/lib/core.mjs) captures the raw text between
 * `{` and `}` and splits it on `,`. Two independent bugs in that pipeline:
 *
 * 1. No comment-stripping before the split. A barrel is free to interleave
 *    `//`/`/* *\/` comments between named exports (valid TS); a comma inside
 *    one of those comments used to survive into the split, corrupting the
 *    parse — a real named export got silently swallowed into the same field
 *    as the comment text, while a comment fragment that happened to look
 *    like an identifier leaked out as a phantom export name.
 * 2. A PER-SPECIFIER `type` keyword (`export { A, type B }` — as opposed to
 *    the whole-block `export type { ... }` form) was left in place and then
 *    joined onto the name by the whitespace-stripping step:
 *    `"type DataTableProps"` → `"typeDataTableProps"`, one mangled string,
 *    filed as a `value`-kind `otherExports` entry instead of a `type`-kind
 *    entry named `DataTableProps`. This was ALREADY shipping in
 *    `brand-ui.manifest.json` before the #69/#82 round-1 fix ever touched
 *    the file (`"typeDataTableProps"`, `"typeColumnPickerProps"`, etc. in
 *    `otherExports`) — so fixing bug 1 alone would NOT have made
 *    `DataTableColumnMeta` discoverable; its own `type DataTableColumnMeta`
 *    specifier hits this exact mis-parse independent of the comment.
 *
 * These tests plant both shapes (and the combination, matching the real
 * `packages/data/src/data-table/index.ts` barrel) as temp fixture files and
 * assert the parse is correct, so this class of bug can't return silently.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectExports, collectBarrelExports } from "../lib/core.mjs";

const tmp = () => mkdtempSync(join(tmpdir(), "brand-ui-collect-exports-"));

test("collectExports strips a // comment (with commas) inside an export block", () => {
  const dir = tmp();
  try {
    const file = join(dir, "index.ts");
    writeFileSync(
      file,
      [
        "export {",
        "  DataTable,",
        "  createSelectionColumn,",
        "  type DataTableProps,",
        "  // #69 round-1 fix (validator B3): this named type was declared and",
        "  // documented as exported (\"Exported (not just declared) so a consumer's",
        '  // own `ColumnDef` literal type-checks against a NAMED type") but was never',
        "  // actually re-exported through this barrel — a consumer importing it from",
        "  type DataTableColumnMeta,",
        '} from "./data-table";',
        "",
      ].join("\n"),
    );
    const out = collectExports(file, dir);
    const names = out.map((e) => e.name).sort();
    // The real exports survive, in full — including the one the comment sat
    // directly above.
    assert.deepEqual(names, [
      "DataTable",
      "DataTableColumnMeta",
      "DataTableProps",
      "createSelectionColumn",
    ]);
    // Both per-specifier `type` exports parse as `kind: "type"` under their
    // OWN name — not just the one the comment sat next to.
    assert.equal(
      out.find((e) => e.name === "DataTableColumnMeta").kind,
      "type",
      "DataTableColumnMeta must parse as a type export",
    );
    assert.equal(
      out.find((e) => e.name === "DataTableProps").kind,
      "type",
      "DataTableProps must parse as a type export",
    );
    // No stray fragment leaked from inside the comment (e.g. the word
    // "exported" from "documented as exported").
    assert.ok(!names.includes("exported"), "no phantom export leaked from the comment");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectExports strips a per-specifier `type` keyword from the NAME (no comment involved)", () => {
  const dir = tmp();
  try {
    const file = join(dir, "index.ts");
    // A mixed block — no leading `export type`, so the block-level `isType`
    // is false and only the per-specifier keyword marks `Props` as a type.
    writeFileSync(file, ["export {", "  Widget,", "  type WidgetProps,", "};", ""].join("\n"));
    const out = collectExports(file, dir);
    const widget = out.find((e) => e.name === "Widget");
    const props = out.find((e) => e.name === "WidgetProps");
    assert.ok(widget, "Widget present under its own name");
    assert.equal(widget.kind, "value");
    assert.ok(props, "the name is `WidgetProps`, not the mangled `typeWidgetProps`");
    assert.equal(props.kind, "type");
    assert.ok(
      !out.some((e) => e.name === "typeWidgetProps"),
      "the `type` keyword must not be concatenated onto the name",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectExports handles a per-specifier `type X as Y` alias", () => {
  const dir = tmp();
  try {
    const file = join(dir, "index.ts");
    writeFileSync(file, ["export {", "  type Foo as Bar,", "};", ""].join("\n"));
    const out = collectExports(file, dir);
    assert.equal(out.length, 1);
    assert.equal(out[0].name, "Bar", "the alias wins, same as an un-typed `as`");
    assert.equal(out[0].kind, "type");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectExports strips a /* */ block comment (with a comma) inside an export block", () => {
  const dir = tmp();
  try {
    const file = join(dir, "index.ts");
    writeFileSync(
      file,
      [
        "export {",
        "  Foo,",
        "  /* internal note: kept for parity, see issue, tracked separately */",
        "  Bar,",
        '} from "./impl";',
        "",
      ].join("\n"),
    );
    const names = collectExports(file, dir)
      .map((e) => e.name)
      .sort();
    assert.deepEqual(names, ["Bar", "Foo"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("collectBarrelExports de-dupes through a comment-bearing export block", () => {
  const dir = tmp();
  try {
    const file = join(dir, "index.ts");
    writeFileSync(
      file,
      [
        "export {",
        "  type Widget, // a comma, right here, inside the comment",
        "  Widget,",
        '} from "./widget";',
        "",
      ].join("\n"),
    );
    const all = collectBarrelExports(file, dir);
    assert.equal(all.length, 1, "type + value of the same name de-dupe to one entry");
    assert.equal(all[0].name, "Widget");
    // Prefers the value kind over the type when both are present.
    assert.equal(all[0].kind, "value");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
