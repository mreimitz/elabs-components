import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPropTable, findRepoRoot } from "../lib/core.mjs";

test("extractPropTable parses own props, optionality, TSDoc and extends", () => {
  const src = `
    export interface ButtonProps
      extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
      /** Render the child element as the button (Radix Slot) instead of a <button>. */
      asChild?: boolean;
      label: string;
    }
  `;
  const t = extractPropTable(src, "Button");
  assert.ok(t, "table extracted");
  assert.deepEqual(t.extends, [
    "ButtonHTMLAttributes<HTMLButtonElement>",
    "VariantProps<typeof buttonVariants>",
  ]);
  const asChild = t.props.find((p) => p.name === "asChild");
  assert.equal(asChild.optional, true);
  assert.equal(asChild.type, "boolean");
  assert.match(asChild.description, /Radix Slot/);
  const label = t.props.find((p) => p.name === "label");
  assert.equal(label.optional, false);
  assert.equal(label.type, "string");
});

test("extractPropTable handles union/generic types without splitting them", () => {
  const src = `
    export interface XProps {
      size?: "sm" | "md" | "lg";
      data: Record<string, number>;
      onChange?: (v: string) => void;
    }
  `;
  const t = extractPropTable(src, "X");
  const size = t.props.find((p) => p.name === "size");
  assert.equal(size.type, '"sm" | "md" | "lg"', "union type kept whole");
  const data = t.props.find((p) => p.name === "data");
  assert.equal(data.type, "Record<string, number>", "generic kept whole (comma not split)");
  const onChange = t.props.find((p) => p.name === "onChange");
  assert.equal(onChange.type, "(v: string) => void", "function type kept whole");
});

test("extractPropTable returns null for an absent interface", () => {
  assert.equal(extractPropTable("export const x = 1;", "Nope"), null);
});

test("extractPropTable records extends-only interfaces (thin Props)", () => {
  const src = `export interface PlainProps extends HTMLAttributes<HTMLDivElement> {}`;
  const t = extractPropTable(src, "Plain");
  assert.deepEqual(t.extends, ["HTMLAttributes<HTMLDivElement>"]);
  assert.deepEqual(t.props, []);
});

// ── Regressions the earlier fixtures could not catch (#60) ──────────────────
// The existing cases put the function-typed prop LAST and gave every member its
// own tidy doc comment, so both real failure modes were invisible: the `>` of
// `=>` drove the member splitter negative (everything after it collapsed into
// one prop) and the block-comment scan spanned from the FIRST `/**` to the LAST
// `*/` (a prop inherited the description of one declared earlier). Both shipped
// straight into `brand-ui docs`, the manifest and the llms spokes.

test("extractPropTable does not let `=>` collapse every following member", () => {
  const src = `
    export interface XProps {
      /** Render a toolbar above the table. */
      toolbar?: (table: Table<TData>) => ReactNode;
      /** Enable client-side pagination. */
      enablePagination?: boolean;
      pageSize?: number;
    }
  `;
  const t = extractPropTable(src, "X");
  assert.deepEqual(
    t.props.map((p) => p.name),
    ["toolbar", "enablePagination", "pageSize"],
    "members after a function type are still split",
  );
  assert.equal(t.props[0].type, "(table: Table<TData>) => ReactNode");
  assert.equal(t.props[1].type, "boolean");
});

test("extractPropTable attributes each TSDoc to the member it abuts", () => {
  const src = `
    export interface XProps {
      /** Task data. */
      tasks: Task[];
      /** Row height override (px). */
      rowHeight?: number;
      /** Bar-label placement. */
      labelPosition?: LabelPosition;
    }
  `;
  const t = extractPropTable(src, "X");
  const byName = Object.fromEntries(t.props.map((p) => [p.name, p.description]));
  assert.equal(byName.tasks, "Task data.");
  assert.equal(byName.rowHeight, "Row height override (px).", "not `tasks`' doc");
  assert.equal(byName.labelPosition, "Bar-label placement.");
});

test("extractPropTable survives braces/parens/angles inside comments", () => {
  const src = `
    export interface XProps {
      // ── Server-side model ─────────────────────────────────────────────
      /** Fires with the current {pagination, sorting} — see <Table> (px). */
      onServerChange?: (args: Args) => void;
      rowCount?: number;
    }
  `;
  const t = extractPropTable(src, "X");
  assert.deepEqual(
    t.props.map((p) => p.name),
    ["onServerChange", "rowCount"],
  );
  // A box-drawing section rule is a heading, not the next prop's description.
  assert.equal(
    t.props[0].description,
    "Fires with the current {pagination, sorting} — see <Table> (px).",
  );
});

test("extractPropTable does not turn a `// ──` section rule into a description", () => {
  const src = `
    export interface XProps {
      // ── Zoom ────────────────────────────────────────────────
      pixelsPerDay?: number;
    }
  `;
  const t = extractPropTable(src, "X");
  assert.equal(t.props[0].description, undefined);
});

// Real source, not a fixture: the two components whose printed prop tables were
// wrong. A fixture-only suite is exactly what let this ship, so lock the promise
// against the modules an agent actually asks about.
const repoRoot = findRepoRoot(import.meta.dirname);

test("extractPropTable parses the REAL DataTable interface", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const src = readFileSync(join(repoRoot, "packages/data/src/data-table/data-table.tsx"), "utf8");
  const table = extractPropTable(src, "DataTable");
  const names = table.props.map((p) => p.name);
  assert.ok(names.length > 20, `expected the full prop surface, got ${names.length}`);
  for (const expected of ["columns", "data", "toolbar", "loading", "zebra", "emptyMessage"]) {
    assert.ok(names.includes(expected), `own-declared prop \`${expected}\` is present`);
  }
  const toolbar = table.props.find((p) => p.name === "toolbar");
  assert.equal(toolbar.type, "(table: TanstackTable<TData>) => ReactNode");
});

test("extractPropTable parses the REAL Gantt interface without mis-attributing docs", (t) => {
  if (!repoRoot) return t.skip("not inside the monorepo");
  const src = readFileSync(join(repoRoot, "packages/charts/src/gantt/gantt.tsx"), "utf8");
  const table = extractPropTable(src, "Gantt");
  const byName = Object.fromEntries(table.props.map((p) => [p.name, p]));
  assert.ok(table.props.length > 20, `expected the full prop surface, got ${table.props.length}`);
  assert.equal(byName.tasks.description, "Task data.");
  assert.match(byName.rowHeight.description, /^Row height override/);
  assert.equal(byName.rowHeight.type, "number");
  assert.ok(byName.loading, "`loading` survives the members declared before it");
});

test("extractPropTable is not fooled by a prose apostrophe inside a JSDoc comment", () => {
  // Before the fix, `matchDelim`'s (and `splitMembers`'s) string-quote
  // tracking treated the apostrophe in "isn't" as OPENING a string literal —
  // scanning for a matching `'` corrupted brace-depth tracking for the rest
  // of the source, so `matchDelim` returned -1 and the ENTIRE prop table was
  // silently dropped (`{ props: [] }`).
  const src = `
    export interface FooProps {
      /**
       * This isn't optional.
       */
      bar?: string;
      baz: number;
    }
  `;
  const t = extractPropTable(src, "Foo");
  assert.equal(t.props.length, 2, "both members survive the apostrophe in the JSDoc");
  const bar = t.props.find((p) => p.name === "bar");
  assert.equal(bar.optional, true);
  assert.match(bar.description, /isn't optional/);
  const baz = t.props.find((p) => p.name === "baz");
  assert.equal(baz.optional, false);
  assert.equal(baz.type, "number");
});

test("extractPropTable is not fooled by a prose apostrophe inside a `//` doc comment", () => {
  const src = `
    export interface FooProps {
      // This isn't optional either.
      bar?: string;
      baz: number;
    }
  `;
  const t = extractPropTable(src, "Foo");
  assert.equal(t.props.length, 2, "both members survive the apostrophe in the line comment");
  const bar = t.props.find((p) => p.name === "bar");
  assert.match(bar.description, /isn't optional either/);
});

// ── Type-alias intersections (#77) ──────────────────────────────────────────
// `export type XProps = Base & { ... }` never went through the `interface`
// path's `extends\s+…` header regex (that syntax is `interface`-only), so
// every such component silently lost its base type, and a base-only alias
// (`export type XProps = Base;`, no object literal) was dropped from the
// manifest entirely. Every case below asserts on the `extends` VALUE, not
// merely non-emptiness.

test("extractPropTable records the base of a type-alias intersection", () => {
  const src = `
    export type FooProps = Omit<ComponentProps<typeof Bar>, "rehypePlugins"> & { a?: string };
  `;
  const t = extractPropTable(src, "Foo");
  assert.deepEqual(t.extends, ['Omit<ComponentProps<typeof Bar>, "rehypePlugins">']);
  assert.ok(
    t.props.find((p) => p.name === "a"),
    "own prop `a` is still parsed",
  );
});

test("extractPropTable records the base with the object literal FIRST", () => {
  const src = `
    export type FooProps = { a?: string } & ComponentProps<"div">;
  `;
  const t = extractPropTable(src, "Foo");
  assert.deepEqual(t.extends, ['ComponentProps<"div">']);
  assert.ok(
    t.props.find((p) => p.name === "a"),
    "own prop `a` is still parsed",
  );
});

test("extractPropTable records multiple intersection members, in source order", () => {
  const src = `
    export type FooProps = ComponentProps<"div"> & VariantProps<typeof v> & { a?: string };
  `;
  const t = extractPropTable(src, "Foo");
  assert.deepEqual(t.extends, ['ComponentProps<"div">', "VariantProps<typeof v>"]);
  assert.ok(
    t.props.find((p) => p.name === "a"),
    "own prop `a` is still parsed",
  );
});

test("extractPropTable does not mistake a union for a base", () => {
  const src = `
    export type FooProps = A | B;
  `;
  const t = extractPropTable(src, "Foo");
  assert.ok(t, "table extracted (never null for a valid type-alias decl)");
  assert.deepEqual(t.extends, []);
  assert.deepEqual(t.props, []);
});

test("extractPropTable survives an arrow-function type in the body (the splitTopLevel trap)", () => {
  // `splitTopLevel`'s naive depth counter treats every `>` as a closer, so the
  // `>` of `=> void` inside the object-literal member would decrement depth to
  // 0 and split the top-level `&` in the WRONG place. The fix reuses the
  // separate `angle` counter + `isIdent` guard already proven in `splitMembers`.
  const src = `
    export type FooProps = ComponentProps<"div"> & { onPick?: (id: string) => void; a?: string };
  `;
  const t = extractPropTable(src, "Foo");
  assert.deepEqual(t.extends, ['ComponentProps<"div">']);
  const onPick = t.props.find((p) => p.name === "onPick");
  assert.ok(onPick, "onPick is parsed, not swallowed by a mis-split");
  assert.equal(onPick.type, "(id: string) => void");
  assert.ok(
    t.props.find((p) => p.name === "a"),
    "the member AFTER the arrow-typed one still splits correctly",
  );
});

test("extractPropTable records a base-only type alias (Arm B)", () => {
  const src = `
    export type FooProps = HTMLAttributes<HTMLSpanElement>;
  `;
  const t = extractPropTable(src, "Foo");
  assert.deepEqual(t, { extends: ["HTMLAttributes<HTMLSpanElement>"], props: [] });
});

test("extractPropTable recovers own props nested inside a utility-type generic argument (Arm C — PR #87 review finding)", () => {
  // `PropsWithChildren<{ initialInput?: string }>` is neither a plain
  // object-literal alias (Arm A/no-`&`-object) nor a base-only alias (Arm B) —
  // it's a single non-`{`-led segment whose OWN generic argument is an object
  // literal. Before this fix, `PromptInputProviderProps` (the real,
  // pre-existing shape this reproduces verbatim) silently degraded from
  // `props:[initialInput]` to `props:[]`, even though the public API is
  // unchanged — a real regression caught in code review, confirmed against
  // git history (`brand-ui.manifest.json` before/after the #77 commit).
  const src = `
    export type FooProps = PropsWithChildren<{
      initialInput?: string;
    }>;
  `;
  const t = extractPropTable(src, "Foo");
  assert.deepEqual(t.extends, ["PropsWithChildren<{\n      initialInput?: string;\n    }>"]);
  const initialInput = t.props.find((p) => p.name === "initialInput");
  assert.ok(
    initialInput,
    "own prop `initialInput` nested inside the utility-type generic is recovered",
  );
  assert.equal(initialInput.optional, true);
  assert.equal(initialInput.type, "string");
});

test("extractPropTable Arm C does not reach into a parenthesized union member (the disclosed AudioPlayerElementProps limitation stays as-is)", () => {
  // `Omit<X, Y> & (A | B)` — a parenthesized discriminated union as one `&`
  // member — is NOT a flat prop table (the props are mutually exclusive
  // between arms), so Arm C's identifier-led-only guard must not reach into
  // it: the segment starts with `(`, not an identifier. Reproduces the real,
  // disclosed `AudioPlayerElementProps` shape (`packages/ai/src/audio-player.tsx`)
  // verbatim, scoped down. Flattening the first arm's `data` into `props`
  // would misrepresent the API (the `src` arm would be silently hidden) —
  // strictly worse than the pre-existing, disclosed `props: []`.
  const src = `
    export type FooProps = Omit<Bar, "src"> &
      (
        | {
            data: string;
          }
        | {
            src: string;
          }
      );
  `;
  const t = extractPropTable(src, "Foo");
  assert.deepEqual(t.props, []);
  assert.ok(t.extends.includes('Omit<Bar, "src">'));
});

test("extractPropTable: the interface form is unchanged (no-regression pair)", () => {
  // Re-asserts the existing cases above explicitly, so a change to the type-alias
  // path that accidentally touches the interface path is caught here too.
  const withExtends = extractPropTable(
    `
      export interface ButtonProps
        extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
        asChild?: boolean;
        label: string;
      }
    `,
    "Button",
  );
  assert.deepEqual(withExtends.extends, [
    "ButtonHTMLAttributes<HTMLButtonElement>",
    "VariantProps<typeof buttonVariants>",
  ]);
  const extendsOnly = extractPropTable(
    `export interface PlainProps extends HTMLAttributes<HTMLDivElement> {}`,
    "Plain",
  );
  assert.deepEqual(extendsOnly.extends, ["HTMLAttributes<HTMLDivElement>"]);
  assert.deepEqual(extendsOnly.props, []);
});

test("extractPropTable never throws on a type alias with no terminating top-level `;` (parser must stay total)", () => {
  // Malformed/truncated input must never throw — `extractPropTable` runs during
  // `pnpm manifest`, invoked by the pre-commit hook; a throw breaks the commit
  // path for the whole repo. The spec calls this the graceful bail: fall back
  // to today's (pre-#77) object-literal-only parse.
  const src = `export type FooProps = Omit<Bar, "x"> & { a?: string }`; // no trailing `;`
  assert.doesNotThrow(() => extractPropTable(src, "Foo"));
  const t = extractPropTable(src, "Foo");
  assert.ok(t && Array.isArray(t.extends) && Array.isArray(t.props));
});

test("extractPropTable keeps two adjacent multi-line TSDoc'd members separate (#269 regression)", () => {
  // Before the fix, `leadingDoc`'s block-comment regex started scanning from
  // the FIRST `/**` in the preceding source rather than the nearest one, so
  // the SECOND member's description spliced in the first member's entire doc
  // block PLUS the bare declaration line between them.
  const src = `
    export type CodeBlockProps = {
      /**
       * Soft-wrap long lines instead of scrolling horizontally. Use in narrow
       * embeds so content is not silently clipped.
       */
      wrap?: boolean;
      /**
       * Code is arriving incrementally.
       * @default false
       */
      isStreaming?: boolean;
    };
  `;
  const t = extractPropTable(src, "CodeBlock");
  const wrap = t.props.find((p) => p.name === "wrap");
  assert.match(wrap.description, /Soft-wrap/);
  assert.doesNotMatch(wrap.description, /incrementally/);
  const isStreaming = t.props.find((p) => p.name === "isStreaming");
  assert.match(isStreaming.description, /incrementally/);
  assert.doesNotMatch(isStreaming.description, /Soft-wrap/);
  assert.doesNotMatch(isStreaming.description, /wrap\?: boolean/);
});
