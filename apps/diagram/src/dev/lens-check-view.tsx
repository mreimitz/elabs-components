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
import { visualGeometryIssues } from "../visual/check-visual-geometry";
import { compileText } from "../state/compile-text";
import { deriveVisualLens } from "../visual/derive-visual";
import type { VisualLens } from "../visual/visual-model";

/**
 * `#dev/lens-check` (maintainer 2026-09-27, "the switch from technical to visual"): there is no
 * test runner in this app (`package.json` has neither vitest nor jest — `spec-check-view.tsx`'s
 * own header note), so `deriveVisualLens` gets the same treatment as the dialect: every shipped
 * example AND template, compiled, derived twice, and checked here instead of in a `*.test.ts`
 * file — every shipped EXAMPLE and TEMPLATE gets checked here, not just examples, so a
 * template-only regression (e.g. in skip-lane routing) has a fixture too.
 *
 * Two things this page checks, per document:
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
const TEMPLATES = import.meta.glob<string>("../../workspace/templates/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

function displayName(path: string): string {
  return path.split("/").slice(-2).join("/");
}

interface ExampleRow {
  name: string;
  ok: boolean;
  deterministic: boolean;
  lens: VisualLens | null;
  actorIds: ReadonlySet<string> | null;
  /** Every real (non-`note`) node id in the compiled AST — `structuralIssues` uses this to
   * check that derivation places each node in exactly one box, never zero or two. */
  nodeIds: ReadonlySet<string> | null;
  error: string | null;
}

function canonical(lens: VisualLens): string {
  return JSON.stringify(lens);
}

function checkExample(name: string, text: string): ExampleRow {
  const compiled = compileText(text);
  if (!compiled.ast) {
    return {
      name,
      ok: false,
      deterministic: false,
      lens: null,
      actorIds: null,
      nodeIds: null,
      error: "did not compile",
    };
  }
  try {
    const once = deriveVisualLens(compiled.ast);
    const twice = deriveVisualLens(compiled.ast);
    const deterministic = canonical(once) === canonical(twice);
    const actorIds = new Set(
      compiled.ast.nodes.filter((node) => node.type === "actor").map((node) => node.id),
    );
    const nodeIds = new Set(
      compiled.ast.nodes.filter((node) => node.type !== "note").map((node) => node.id),
    );
    return {
      name,
      ok: once.boxes.length > 0,
      deterministic,
      lens: once,
      actorIds,
      nodeIds,
      error: null,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      deterministic: false,
      lens: null,
      actorIds: null,
      nodeIds: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const COMPONENTS = import.meta.glob<string>("../../workspace/components/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

const ROWS: ExampleRow[] = [
  ...Object.entries(EXAMPLES),
  ...Object.entries(TEMPLATES),
  ...Object.entries(COMPONENTS),
]
  .map(([path, text]) => checkExample(displayName(path), text))
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * `ROWS` above only proves a lens is non-empty and repeatable, not that any one derivation
 * rule is correct. `DERIVE_CASES` below covers a handful of rules on small synthetic
 * fixtures, never on the real files. This function restates the rules that generalize
 * (referential integrity, node coverage, the same-kind bidirectional flow merge, the actor
 * exemption from the network/access aside rule) as invariants any correctly-derived lens must
 * satisfy, run against every shipped example AND template so a regression in real content —
 * not just the hand-written cases — fails here too.
 */
function structuralIssues(
  lens: VisualLens,
  actorIds: ReadonlySet<string>,
  nodeIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = visualGeometryIssues(lens);
  const laneIds = new Set(lens.lanes.map((l) => l.id));
  const boxIds = new Set(lens.boxes.map((b) => b.id));
  // Every real node must land in exactly one box, once — never dropped, never duplicated
  // into two boxes by an overlapping grouping rule.
  const memberCounts = new Map<string, number>();
  for (const box of lens.boxes) {
    if (!laneIds.has(box.lane)) issues.push(`box "${box.id}" has unknown lane "${box.lane}"`);
    if (box.members.length === 0) issues.push(`box "${box.id}" has no members`);
    for (const member of box.members) {
      memberCounts.set(member.id, (memberCounts.get(member.id) ?? 0) + 1);
    }
    if (box.aside) {
      const actor = box.members.find((m) => actorIds.has(m.id));
      if (actor) issues.push(`aside box "${box.id}" contains actor "${actor.id}"`);
    }
  }
  for (const id of nodeIds) {
    const count = memberCounts.get(id) ?? 0;
    if (count === 0) issues.push(`node "${id}" appears in no box`);
    else if (count > 1) issues.push(`node "${id}" appears in ${count} boxes`);
  }
  for (const id of memberCounts.keys()) {
    if (!nodeIds.has(id)) issues.push(`box member "${id}" is not a node in the document`);
  }
  // Two raw flows between the same box pair, opposite direction, of the SAME kind must merge
  // into one bidirectional flow (rule 3) — seeing both directions as separate rows here means
  // that merge did not happen.
  const pairDirections = new Map<string, { forward: boolean; back: boolean; kind: string }>();
  for (const flow of lens.flows) {
    if (!boxIds.has(flow.from)) issues.push(`flow "${flow.id}" has unknown source "${flow.from}"`);
    if (!boxIds.has(flow.to)) issues.push(`flow "${flow.id}" has unknown target "${flow.to}"`);
    if (flow.from === flow.to) issues.push(`flow "${flow.id}" is a self-loop (should be dropped)`);
    const [a, b] = [flow.from, flow.to].sort();
    const key = `${a}~${b}~${flow.kind}`;
    const entry = pairDirections.get(key) ?? { forward: false, back: false, kind: flow.kind };
    if (flow.from === a) entry.forward = true;
    else entry.back = true;
    pairDirections.set(key, entry);
  }
  for (const [key, entry] of pairDirections) {
    if (entry.forward && entry.back) {
      issues.push(`box pair "${key}" has an opposite same-kind pair not merged bidirectional`);
    }
  }
  return issues;
}

interface StructuralRow {
  name: string;
  issues: string[];
}

const STRUCTURAL_ROWS: StructuralRow[] = ROWS.map((row) => ({
  name: row.name,
  issues:
    row.lens && row.actorIds && row.nodeIds
      ? structuralIssues(row.lens, row.actorIds, row.nodeIds)
      : ["did not derive"],
}));

/**
 * `ROWS` above only proves a lens is non-empty and repeatable, not that any one derivation
 * rule is correct. These are small, inline fixtures with an EXPECTED shape, one per
 * derivation rule this slice actually changed.
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
    name: "opposite pair, different kind → two one-way flows",
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
    name: "network-only node → aside; an actor's access flow does not",
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
    name: "bare actor with only an outgoing flow → sources",
    text: `diagram: "0"\nnodes:\n  - { id: person, type: actor }\n  - { id: target, type: service }\nflows:\n  - person -> target: { kind: access }\n`,
    check: (lens) => {
      const box = lens.boxes.find((b) => b.members.some((m) => m.id === "person"));
      if (!box) return "expected person in some box";
      if (box.lane !== "sources") return `expected lane "sources", got "${box.lane}"`;
      return null;
    },
  },
  {
    name: "balanced control plane precedes its downstream service",
    text: `diagram: "0"\nnodes:\n  - { id: ingress, type: actor }\n  - { id: control, type: service }\n  - { id: jobs, type: datastore }\nflows:\n  - ingress -> control: { kind: network }\n  - control -> jobs: { kind: control }\n`,
    check: (lens) =>
      lens.boxes.find((box) => box.members.some((member) => member.id === "control"))?.lane ===
      "sources"
        ? null
        : "control plane must be upstream",
  },
  {
    name: "mixed-type vendor group → the vendor's name, not the kind",
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
    `${passed} of ${total} documents derive a non-empty, deterministic visual lens.`,
  caption: "Every shipped example and template, twice",
  example: "Document",
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
  casesCaption: "One small fixture per derivation rule",
  case: "Case",
  structuralTitle: "Structural rules",
  structuralSummary: (passed: number, total: number) =>
    `${passed} of ${total} documents satisfy every structural invariant.`,
  structuralCaption:
    "Node coverage, flow direction, distinct routes and box clearance on real content",
  document: "Document",
  issues: "Issues",
  none: "None",
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

      <Heading level={2} className="mt-10">
        {LENS_CHECK_LABELS.structuralTitle}
      </Heading>
      <Text className="mt-2" tone="muted">
        {LENS_CHECK_LABELS.structuralSummary(
          STRUCTURAL_ROWS.filter((r) => r.issues.length === 0).length,
          STRUCTURAL_ROWS.length,
        )}
      </Text>
      <Table className="mt-6">
        <TableCaption>{LENS_CHECK_LABELS.structuralCaption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{LENS_CHECK_LABELS.document}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.result}</TableHead>
            <TableHead>{LENS_CHECK_LABELS.issues}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {STRUCTURAL_ROWS.map((row) => (
            <TableRow key={row.name} data-pass={row.issues.length === 0}>
              <TableCell>
                <Text as="span" variant="code">
                  {row.name}
                </Text>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.issues.length === 0 ? "complete" : "failed"}>
                  {row.issues.length === 0 ? LENS_CHECK_LABELS.pass : LENS_CHECK_LABELS.fail}
                </StatusBadge>
              </TableCell>
              <TableCell>
                <Text as="span" variant="caption" tone="muted">
                  {row.issues.length === 0 ? LENS_CHECK_LABELS.none : row.issues.join("; ")}
                </Text>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
