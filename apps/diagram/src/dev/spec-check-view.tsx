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
import { ARCH_COMPOSITE_TYPE } from "../nodes/arch-node-data"; // DG-26
import { IssueMessage, SEVERITY_STATUS } from "../panes/issues-panel";
import { checkArchYaml, type ArchCheckResult, type ArchIssue } from "../spec/dialect";
import type { CompiledCompositeData } from "../spec/compile/compile-arch"; // DG-26
import { upgradeText } from "../spec/dialect/upgrade"; // DG-26
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

/**
 * JSON with sorted keys, without `path`, `form` and `sourceVersion` — two ASTs from different
 * sugar, or the same diagram before and after the upgrader (DG-26), compare equal.
 */
function canonical(value: unknown): string {
  return JSON.stringify(value, (key, v: unknown) => {
    if (key === "path" || key === "form" || key === "sourceVersion") return undefined; // DG-26
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

// DG-26 — the seven workspace files: dialect "1", no error or warning, the measured shape.
const WORKSPACE = import.meta.glob<string>(
  [
    "../../workspace/examples/*.yaml",
    "../../workspace/templates/*.yaml",
    "../../workspace/components/*.yaml",
  ],
  { query: "?raw", import: "default", eager: true },
);
/** nodes / edges each file compiles to. Rows iterate THESE keys: a file saved later is not a row. */
const WORKSPACE_SHAPE: Record<string, readonly [nodes: number, edges: number]> = {
  "components/qlik-cloud-tenant.yaml": [5, 2],
  "examples/clickhouse-cloud-stack.yaml": [14, 9],
  "examples/lakehouse-aws.yaml": [19, 14],
  "examples/qlik-cloud-data-gateway.yaml": [13, 8],
  "examples/qlik-sense-enterprise-onprem.yaml": [21, 13],
  "templates/qlik-cloud-customer-landscape.yaml": [18, 10], // 17 ids + 1 note; 10 flows
  "templates/qlik-talend-cloud-pipeline.yaml": [28, 13],
};

interface WorkspaceRow {
  name: string;
  pass: boolean;
  sourceVersion?: string;
  nodes: number;
  edges: number;
  compiled: CompiledDiagram;
  roundTrip: boolean | null;
  /** Set when the row fails for a reason beyond the generic checks (template 1's tenant shape). */
  detail?: string;
}

/**
 * Template 1's row also checks the collapsed `tenant` reference: one composite node naming
 * `components/qlik-cloud-tenant.yaml`, 9 edges touching it (2 into an inner port, 5 out of
 * one), and the three ports in first-use order (DG-26).
 */
function tenantDetail(compiled: CompiledDiagram): string | undefined {
  const node = compiled.graph?.nodes.find((n) => n.id === "tenant");
  if (!node || node.type !== ARCH_COMPOSITE_TYPE) return 'no "arch/composite" node "tenant"';
  const data = node.data as CompiledCompositeData;
  if (data.component !== "components/qlik-cloud-tenant.yaml") {
    return `component is ${JSON.stringify(data.component)}, not "components/qlik-cloud-tenant.yaml"`;
  }
  const touching = (compiled.graph?.edges ?? []).filter(
    (e) => e.source === "tenant" || e.target === "tenant",
  );
  const inner = (e: (typeof touching)[number]) =>
    e.data as { innerSource?: string; innerTarget?: string } | undefined;
  const innerTarget = touching.filter((e) => inner(e)?.innerTarget !== undefined);
  const innerSource = touching.filter((e) => inner(e)?.innerSource !== undefined);
  if (touching.length !== 9) return `${touching.length} edges touch "tenant", not 9`;
  if (innerTarget.length !== 2) return `${innerTarget.length} edges carry innerTarget, not 2`;
  if (innerSource.length !== 5) return `${innerSource.length} edges carry innerSource, not 5`;
  const wantPorts = JSON.stringify(["qtdi", "answers", "qca"]);
  if (JSON.stringify(data.ports) !== wantPorts) {
    return `ports are ${JSON.stringify(data.ports)}, not ${wantPorts}`;
  }
  return undefined;
}

function runWorkspace(): WorkspaceRow[] {
  return Object.keys(WORKSPACE_SHAPE)
    .map((name) => {
      const [wantNodes, wantEdges] = WORKSPACE_SHAPE[name] ?? [0, 0];
      const text = WORKSPACE[`../../workspace/${name}`] ?? "";
      const compiled = compileText(text);
      const roundTrip = roundTrips(compiled);
      const nodes = compiled.graph?.nodes.length ?? 0;
      const edges = compiled.graph?.edges.length ?? 0;
      const clean = !compiled.issues.some(
        (i) => i.severity === "error" || i.severity === "warning",
      );
      const shapeOk = nodes === wantNodes && edges === wantEdges;
      const detail =
        name === "templates/qlik-cloud-customer-landscape.yaml"
          ? tenantDetail(compiled)
          : undefined;
      const pass =
        compiled.ast?.sourceVersion === "1" &&
        clean &&
        shapeOk &&
        roundTrip !== false &&
        detail === undefined;
      return {
        name,
        pass,
        sourceVersion: compiled.ast?.sourceVersion,
        nodes,
        edges,
        compiled,
        roundTrip,
        detail,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const WORKSPACE_ROWS = runWorkspace();

// DG-26 — the upgrader (`upgrade.ts`) over the valid-* fixtures (7 say "0", 3 say "1"): a "0"
// fixture must change, keep the same issues and the same AST, and be a no-op once upgraded
// again; a "1" fixture must not change at all.
interface UpgradeRow {
  name: string;
  from: string;
  changed: boolean;
  pass: boolean;
}

function runUpgrades(): UpgradeRow[] {
  return ROWS.filter((r) => r.name.startsWith("valid-")).map((r) => {
    const from = r.result.ast?.sourceVersion ?? "?";
    const text = FIXTURES[`../spec/dialect/__fixtures__/${r.name}`] ?? "";
    const up = upgradeText(text);
    if (from === "1") return { name: r.name, from, changed: up.changed, pass: !up.changed };
    const after = checkArchYaml(up.text, ICON_NAMES);
    const again = upgradeText(up.text);
    const pass =
      up.changed &&
      JSON.stringify(r.result.issues.map(label).sort()) ===
        JSON.stringify(after.issues.map(label).sort()) &&
      canonical(r.result.ast) === canonical(after.ast) &&
      !again.changed;
    return { name: r.name, from, changed: up.changed, pass };
  });
}

const UPGRADE_ROWS = runUpgrades();

export function SpecCheckView() {
  const passed =
    ROWS.filter((r) => r.pass).length +
    PAIRS.filter((p) => p.pass).length +
    WORKSPACE_ROWS.filter((r) => r.pass).length +
    UPGRADE_ROWS.filter((r) => r.pass).length;
  const total = ROWS.length + PAIRS.length + WORKSPACE_ROWS.length + UPGRADE_ROWS.length;
  return (
    <main className="min-h-dvh bg-background p-8 text-foreground">
      <Heading level={1}>Spec check</Heading>
      <Text className="mt-2" tone="muted">
        {passed} of {total} checks pass. Each fixture&rsquo;s “# expect:” lines must match its
        issues exactly.
      </Text>

      <Table className="mt-6">
        <TableCaption>{SPEC_CHECK_LABELS.fixtures}</TableCaption>
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

      <Table className="mt-6">
        <TableCaption>{SPEC_CHECK_LABELS.workspace}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{SPEC_CHECK_LABELS.file}</TableHead>
            <TableHead>{SPEC_CHECK_LABELS.result}</TableHead>
            <TableHead>{SPEC_CHECK_LABELS.dialect}</TableHead>
            <TableHead>{COMPILED_LABELS.column}</TableHead>
            <TableHead>{SPEC_CHECK_LABELS.detail}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {WORKSPACE_ROWS.map((row) => (
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
                  {row.sourceVersion ?? "—"}
                </Text>
              </TableCell>
              <TableCell>
                <CompiledCell compiled={row.compiled} roundTrip={row.roundTrip} />
              </TableCell>
              <TableCell>
                <Text as="span" variant="caption" tone="muted" className="min-w-0 break-words">
                  {row.detail ?? "—"}
                </Text>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableCaption>{SPEC_CHECK_LABELS.upgrade}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{SPEC_CHECK_LABELS.fixture}</TableHead>
            <TableHead>{SPEC_CHECK_LABELS.from}</TableHead>
            <TableHead>{SPEC_CHECK_LABELS.changed}</TableHead>
            <TableHead>{SPEC_CHECK_LABELS.result}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {UPGRADE_ROWS.map((row) => (
            <TableRow key={row.name} data-pass={row.pass}>
              <TableCell>
                <Text as="span" variant="code">
                  {row.name}
                </Text>
              </TableCell>
              <TableCell>
                <Text as="span" variant="code">
                  {row.from}
                </Text>
              </TableCell>
              <TableCell>
                <Text as="span" variant="code">
                  {row.changed ? "yes" : "no"}
                </Text>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.pass ? "complete" : "failed"}>
                  {row.pass ? "Pass" : "Fail"}
                </StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}

/** Captions and column titles for the DG-26 tables, in one place (`conventions/i18n-strings`). */
const SPEC_CHECK_LABELS = {
  fixtures: "Dialect fixtures (v0 and v1)",
  workspace: "Workspace files",
  upgrade: "Upgrade 0 → 1",
  file: "File",
  dialect: "Dialect",
  detail: "Detail",
  fixture: "Fixture",
  from: "From",
  changed: "Changed",
  result: "Result",
} as const;

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
