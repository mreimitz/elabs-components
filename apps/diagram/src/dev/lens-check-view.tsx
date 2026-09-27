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

/**
 * maintainer 2026-09-27 (review round, F17): `ROWS` above only proves a lens is non-empty and
 * repeatable — every derivation rule bug the review round found (F6–F9) passed it. These are
 * small, inline fixtures with an EXPECTED shape, one per rule this slice actually changed.
 */
interface DeriveCase {
  name: string;
  text: string;
  check: (lens: VisualLens) => string | null;
}

const boxTitled = (lens: VisualLens, title: string) => lens.boxes.find((b) => b.title === title);

const DERIVE_CASES: DeriveCase[] = [
  {
    name: "opposite pair, same kind → one bidirectional flow",
    text: `diagram: "0"\nnodes:\n  - { id: a, type: service }\n  - { id: b, type: datastore }\nflows:\n  - a -> b: { kind: data }\n  - b -> a: { kind: data }\n`,
    check: (lens) => {
      if (lens.flows.length !== 1) return `expected 1 flow, got ${lens.flows.length}`;
      const flow = lens.flows[0];
      if (!flow?.bidirectional) return "expected the one flow to be bidirectional";
      if (flow.kind !== "data") return `expected kind "data", got "${flow.kind}"`;
      return null;
    },
  },
  {
    name: "opposite pair, different kind → two one-way flows (F7)",
    text: `diagram: "0"\nnodes:\n  - { id: a, type: service }\n  - { id: b, type: datastore }\nflows:\n  - a -> b: { kind: control }\n  - b -> a: { kind: data }\n`,
    check: (lens) => {
      if (lens.flows.length !== 2) return `expected 2 flows, got ${lens.flows.length}`;
      if (lens.flows.some((f) => f.bidirectional)) return "expected neither flow bidirectional";
      const kinds = new Set(lens.flows.map((f) => f.kind));
      if (kinds.size !== 2) return `expected one "data" and one "other", got ${[...kinds]}`;
      return null;
    },
  },
  {
    name: "duplicate same-direction pairs → one flow",
    text: `diagram: "0"\nnodes:\n  - { id: a, type: service }\n  - { id: b, type: service }\n  - { id: c, type: datastore }\n  - { id: d, type: datastore }\nflows:\n  - a -> c: { kind: data }\n  - b -> d: { kind: data }\n`,
    check: (lens) => (lens.flows.length !== 1 ? `expected 1 flow, got ${lens.flows.length}` : null),
  },
  {
    name: "network-only node → aside; an actor's access flow does not (F9)",
    text: `diagram: "0"\nnodes:\n  - { id: net, type: service }\n  - { id: person, type: actor }\n  - { id: target, type: service }\nflows:\n  - net -> target: { kind: network }\n  - person -> target: { kind: access }\n`,
    check: (lens) => {
      const aside = lens.boxes.find((b) => b.aside);
      if (!aside) return "expected an aside box";
      if (!aside.members.some((m) => m.id === "net")) return "expected net in the aside box";
      if (aside.members.some((m) => m.id === "person"))
        return "expected the actor NOT in the aside box";
      return null;
    },
  },
  {
    name: "bare actor with only an outgoing flow → sources (F6)",
    text: `diagram: "0"\nnodes:\n  - { id: person, type: actor }\n  - { id: target, type: service }\nflows:\n  - person -> target: { kind: access }\n`,
    check: (lens) => {
      const box = lens.boxes.find((b) => b.members.some((m) => m.id === "person"));
      if (!box) return "expected person in some box";
      if (box.lane !== "sources") return `expected lane "sources", got "${box.lane}"`;
      return null;
    },
  },
  {
    name: "mixed-type vendor group → the vendor's name, not the kind (F8)",
    text: [
      'diagram: "0"',
      "zones:",
      "  - { id: z, title: Zone Z, owner: customer, kind: cloud-account }",
      "nodes:",
      "  - { id: db1, type: datastore, icon: aws/rds, parent: z }",
      "  - { id: ep, type: service, icon: aws/virtual-private-cloud, parent: z }",
      "  - { id: svc1, type: service, icon: databricks/databricks, parent: z }",
      "  - { id: svc2, type: queue, icon: databricks/jobs, parent: z }",
      "",
    ].join("\n"),
    check: (lens) => {
      if (boxTitled(lens, "Databases")) return 'expected no box titled "Databases"';
      if (!boxTitled(lens, "AWS services")) return 'expected a box titled "AWS services"';
      return null;
    },
  },
];

interface DeriveCaseRow {
  name: string;
  ok: boolean;
  detail: string | null;
}

const DERIVE_ROWS: DeriveCaseRow[] = DERIVE_CASES.map(({ name, text, check }) => {
  const compiled = compileText(text);
  if (!compiled.ast) return { name, ok: false, detail: "did not compile" };
  try {
    const failure = check(deriveVisualLens(compiled.ast));
    return { name, ok: failure === null, detail: failure };
  } catch (error) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
});

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
  casesTitle: "Derivation cases",
  casesSummary: (passed: number, total: number) => `${passed} of ${total} cases match.`,
  casesCaption: "One small fixture per rule this slice fixed (F6–F9)",
  case: "Case",
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

      <Heading level={2} className="mt-10">
        {LENS_CHECK_LABELS.casesTitle}
      </Heading>
      <Text className="mt-2" tone="muted">
        {LENS_CHECK_LABELS.casesSummary(DERIVE_ROWS.filter((r) => r.ok).length, DERIVE_ROWS.length)}
      </Text>
      <Table className="mt-6">
        <TableCaption>{LENS_CHECK_LABELS.casesCaption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{LENS_CHECK_LABELS.case}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.result}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {DERIVE_ROWS.map((row) => (
            <TableRow key={row.name} data-pass={row.ok}>
              <TableCell>
                <Text as="span">{row.name}</Text>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.ok ? "complete" : "failed"}>
                  {row.ok ? LENS_CHECK_LABELS.pass : LENS_CHECK_LABELS.fail}
                </StatusBadge>
                {row.detail ? (
                  <Text as="span" variant="caption" tone="muted" className="ms-2">
                    {LENS_CHECK_LABELS.error(row.detail)}
                  </Text>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
