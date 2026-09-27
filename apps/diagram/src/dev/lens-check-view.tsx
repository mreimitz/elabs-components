import {
  Heading,
  StatusBadge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "@elabs-ai/components-ui";
import { compileText } from "../state/compile-text";
import { deriveVisualLens } from "../visual/derive-visual";
import type { VisualLens } from "../visual/visual-model";

/**
 * `#dev/lens-check` (maintainer 2026-09-27, "the switch from technical to visual"): there is no
 * test runner in this app (`package.json` has neither vitest nor jest — `spec-check-view.tsx`'s
 * own header note), so `deriveVisualLens` gets the same treatment as the dialect: every shipped
 * example, compiled, derived twice, and checked here instead of in a `*.test.ts` file.
 *
 * Two things this page checks, per example:
 * - **it derives at all** — a clean compile with an AST produces a lens with at least one box;
 * - **it is deterministic** — deriving the same AST twice gives byte-identical JSON, since nothing
 *   in `derive-visual.ts` may depend on `Set`/`Object.keys` order, `Date.now()` or any other
 *   non-document-order input (see that file's own header note on why grouping by `Map` is safe).
 */
const EXAMPLES = import.meta.glob<string>("../../workspace/examples/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

interface ExampleRow {
  name: string;
  ok: boolean;
  deterministic: boolean;
  lens: VisualLens | null;
  error: string | null;
}

function canonical(lens: VisualLens): string {
  return JSON.stringify(lens);
}

function checkExample(name: string, text: string): ExampleRow {
  const compiled = compileText(text);
  if (!compiled.ast) {
    return { name, ok: false, deterministic: false, lens: null, error: "did not compile" };
  }
  try {
    const once = deriveVisualLens(compiled.ast);
    const twice = deriveVisualLens(compiled.ast);
    const deterministic = canonical(once) === canonical(twice);
    return { name, ok: once.boxes.length > 0, deterministic, lens: once, error: null };
  } catch (error) {
    return {
      name,
      ok: false,
      deterministic: false,
      lens: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const ROWS: ExampleRow[] = Object.entries(EXAMPLES)
  .map(([path, text]) => checkExample(path.split("/").pop() ?? path, text))
  .sort((a, b) => a.name.localeCompare(b.name));

/** DG-09-style strings, in one place (`conventions/i18n-strings`). */
const LENS_CHECK_LABELS = {
  title: "Lens check",
  summary: (passed: number, total: number) =>
    `${passed} of ${total} examples derive a non-empty, deterministic visual lens.`,
  caption: "Every shipped example, twice",
  example: "Example",
  result: "Result",
  lanes: "Lanes",
  boxes: "Boxes",
  flows: "Flows",
  deterministic: "Deterministic",
  pass: "Pass",
  fail: "Fail",
  error: (message: string) => `Error: ${message}`,
} as const;

export function LensCheckView() {
  const passed = ROWS.filter((r) => r.ok && r.deterministic).length;
  return (
    <main className="min-h-dvh bg-background p-8 text-foreground">
      <Heading level={1}>{LENS_CHECK_LABELS.title}</Heading>
      <Text className="mt-2" tone="muted">
        {LENS_CHECK_LABELS.summary(passed, ROWS.length)}
      </Text>

      <Table className="mt-6">
        <TableCaption>{LENS_CHECK_LABELS.caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{LENS_CHECK_LABELS.example}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.result}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.lanes}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.boxes}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.flows}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.deterministic}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.name} data-pass={row.ok && row.deterministic}>
              <TableCell>
                <Text as="span" variant="code">
                  {row.name}
                </Text>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.ok ? "complete" : "failed"}>
                  {row.ok ? LENS_CHECK_LABELS.pass : LENS_CHECK_LABELS.fail}
                </StatusBadge>
                {row.error ? (
                  <Text as="span" variant="caption" tone="muted" className="ms-2">
                    {LENS_CHECK_LABELS.error(row.error)}
                  </Text>
                ) : null}
              </TableCell>
              <TableCell>
                <Text as="span" variant="code" className="tabular-nums">
                  {row.lens?.lanes.length ?? "—"}
                </Text>
              </TableCell>
              <TableCell>
                <Text as="span" variant="code" className="tabular-nums">
                  {row.lens?.boxes.length ?? "—"}
                </Text>
              </TableCell>
              <TableCell>
                <Text as="span" variant="code" className="tabular-nums">
                  {row.lens?.flows.length ?? "—"}
                </Text>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.deterministic ? "complete" : "failed"}>
                  {row.deterministic ? LENS_CHECK_LABELS.pass : LENS_CHECK_LABELS.fail}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
