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
import { ICON_NAMES } from "../icons/icon-names"; // DG-10
import { IssueMessage, SEVERITY_STATUS } from "../panes/issues-panel";
import { checkArchYaml, type ArchCheckResult, type ArchIssue } from "../spec/dialect";
import { fromReactFlow, toReactFlow } from "../spec/flow-spec"; // DG-10
import { archRegistry, compileText, type CompiledDiagram } from "../state/compile-text"; // DG-10

/** Every fixture as raw text, keyed by its path ("../spec/dialect/__fixtures__/valid-min.yaml"). */
const FIXTURES = import.meta.glob<string>(
  // *.yaml.txt: the two fixtures that are not valid YAML (Prettier cannot parse them).
  ["../spec/dialect/__fixtures__/*.yaml", "../spec/dialect/__fixtures__/*.yaml.txt"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

/** Fixture pairs whose ASTs must be identical once `path` and `form` are dropped. */
const SAME_AST = [
  ["valid-sugar-shorthand.yaml", "valid-sugar-object.yaml"],
  ["valid-nesting-children.yaml", "valid-nesting-parent.yaml"],
] as const;

const EXPECT = /^# expect: (.+)$/gm;

interface FixtureRow {
  name: string;
  expected: string[];
  actual: string[];
  pass: boolean;
  result: ArchCheckResult;
  compiled: CompiledDiagram;
  /** null = nothing to round-trip (no graph). */
  roundTrip: boolean | null;
}

/**
 * DG-10: `toReactFlow(fromReactFlow(toReactFlow(spec)))` must give the same ids, types,
 * parents, handles and data as `toReactFlow(spec)` — compared as JSON of those fields.
 */
function roundTrips(compiled: CompiledDiagram): boolean | null {
  if (!compiled.spec) return null;
  const defs = archRegistry.definitions;
  const canon = ({ nodes, edges }: ReturnType<typeof toReactFlow>) =>
    JSON.stringify([
      nodes.map((n) => [n.id, n.type, n.parentId, n.data]),
      edges.map((e) => [e.id, e.type, e.source, e.target, e.sourceHandle, e.targetHandle, e.data]),
    ]);
  const once = toReactFlow(compiled.spec, defs);
  const twice = toReactFlow(fromReactFlow(once.nodes, once.edges, compiled.spec), defs);
  return canon(once) === canon(twice);
}

const label = (i: ArchIssue) =>
  `${i.code} @ ${i.range?.start.line ?? 0}:${i.range?.start.col ?? 0}`;

function runFixtures(): FixtureRow[] {
  return Object.entries(FIXTURES)
    .map(([path, text]) => {
      const name = path.split("/").pop() ?? path;
      const expected = [...text.matchAll(EXPECT)]
        .map((m) => (m[1] ?? "").trim())
        .filter((e) => e !== "none");
      const result = checkArchYaml(text, ICON_NAMES);
      const actual = result.issues.map(label);
      const compiled = compileText(text); // DG-10
      const roundTrip = roundTrips(compiled); // DG-10
      const pass =
        JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()) &&
        !compiled.issues.some((i) => i.stage === "flow-spec") && // DG-10
        roundTrip !== false; // DG-10
      return { name, expected, actual, pass, result, compiled, roundTrip };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** JSON with sorted keys, without `path` and `form` — two ASTs from different sugar compare equal. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (key, v: unknown) => {
    if (key === "path" || key === "form") return undefined;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
    }
    return v;
  });
}

const ROWS = runFixtures();
const PAIRS = SAME_AST.map(([a, b]) => {
  const left = ROWS.find((r) => r.name === a)?.result.ast;
  const right = ROWS.find((r) => r.name === b)?.result.ast;
  return {
    a,
    b,
    pass: left != null && right != null && canonical(left) === canonical(right),
  };
});

export function SpecCheckView() {
  const passed = ROWS.filter((r) => r.pass).length + PAIRS.filter((p) => p.pass).length;
  const total = ROWS.length + PAIRS.length;
  return (
    <main className="min-h-dvh bg-background p-8 text-foreground">
      <Heading level={1}>Spec check</Heading>
      <Text className="mt-2" tone="muted">
        {passed} of {total} checks pass. Each fixture&rsquo;s “# expect:” lines must match its
        issues exactly.
      </Text>

      <Table className="mt-6">
        <TableCaption>Dialect v0 fixtures</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Fixture</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead>Issues found</TableHead>
            <TableHead>{COMPILED_LABELS.column}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.name} data-pass={row.pass}>
              <TableCell>
                <Text as="span" variant="code">
                  {row.name}
                </Text>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.pass ? "complete" : "failed"}>
                  {row.pass ? "Pass" : "Fail"}
                </StatusBadge>
              </TableCell>
              <TableCell>
                <Text as="span" variant="code">
                  {row.expected.length ? row.expected.join(", ") : "none"}
                </Text>
              </TableCell>
              <TableCell>
                <ul className="flex flex-col gap-1">
                  {row.result.issues.map((i) => (
                    <li key={`${label(i)}-${i.path}`} className="flex min-w-0 items-center gap-2">
                      <StatusBadge status={SEVERITY_STATUS[i.severity]} size="sm" />
                      <Text as="span" variant="code">
                        {label(i)}
                      </Text>
                      <Text
                        as="span"
                        variant="caption"
                        tone="muted"
                        className="min-w-0 break-words"
                      >
                        <IssueMessage message={i.message} />
                      </Text>
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <CompiledCell compiled={row.compiled} roundTrip={row.roundTrip} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableCaption>Sugar and nesting give the same AST</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Pair</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PAIRS.map((p) => (
            <TableRow key={p.a} data-pass={p.pass}>
              <TableCell>
                <Text as="span" variant="code">
                  {p.a} = {p.b}
                </Text>
              </TableCell>
              <TableCell>
                <StatusBadge status={p.pass ? "complete" : "failed"}>
                  {p.pass ? "Pass" : "Fail"}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}

const PLURAL = new Intl.PluralRules("en");

/** "1 node", "0 edges": the count's plural category picks the word (wave-2 review m8). */
const countOf = (count: number, one: string, other: string) =>
  `${count} ${PLURAL.select(count) === "one" ? one : other}`;

/** DG-10's strings, in one place (`conventions/i18n-strings`). */
const COMPILED_LABELS = {
  column: "Compiled",
  notCompiled: "not compiled",
  counts: (nodes: number, edges: number) =>
    `${countOf(nodes, "node", "nodes")} · ${countOf(edges, "edge", "edges")}`,
  roundTrip: "Round trip",
  roundTripDiffers: "Round trip differs",
  stage: "flow-spec",
} as const;

/** DG-10: node/edge counts, flow-spec issues and the round-trip result for one fixture. */
function CompiledCell({
  compiled,
  roundTrip,
}: {
  compiled: CompiledDiagram;
  roundTrip: boolean | null;
}) {
  if (!compiled.graph) {
    return (
      <Text as="span" variant="caption" tone="muted">
        {COMPILED_LABELS.notCompiled}
      </Text>
    );
  }
  const specIssues = compiled.issues.filter((i) => i.stage === "flow-spec");
  return (
    <div className="flex flex-col gap-1" data-compiled-nodes={compiled.graph.nodes.length}>
      <Text as="span" variant="code" className="tabular-nums">
        {COMPILED_LABELS.counts(compiled.graph.nodes.length, compiled.graph.edges.length)}
      </Text>
      <StatusBadge status={roundTrip ? "complete" : "failed"}>
        {roundTrip ? COMPILED_LABELS.roundTrip : COMPILED_LABELS.roundTripDiffers}
      </StatusBadge>
      {specIssues.map((i) => (
        <Text key={`${i.code}-${i.path}`} as="span" variant="caption" tone="muted">
          {COMPILED_LABELS.stage} {i.code} {i.path}: {i.message}
        </Text>
      ))}
    </div>
  );
}
