import {
  Badge,
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
import { LUCIDE_ICONS } from "../icons/lucide-map";
import { ICON_INDEX } from "../icons/register-packs";
import { checkArchYaml, type ArchCheckResult, type ArchIssue } from "../spec/dialect";

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

/** DG-04's vendor index + the reserved lucide/ names. */
const ICON_NAMES: ReadonlySet<string> = new Set([
  ...Object.keys(ICON_INDEX),
  ...Object.keys(LUCIDE_ICONS).map((name) => `lucide/${name}`),
]);

/** Fixture pairs whose ASTs must be identical once `path` and `form` are dropped. */
const SAME_AST = [
  ["valid-sugar-shorthand.yaml", "valid-sugar-object.yaml"],
  ["valid-nesting-children.yaml", "valid-nesting-parent.yaml"],
] as const;

const EXPECT = /^# expect: (.+)$/gm;

const SEVERITY_BADGE = {
  error: "destructive",
  warning: "warning",
  info: "info",
} as const;

interface FixtureRow {
  name: string;
  expected: string[];
  actual: string[];
  pass: boolean;
  result: ArchCheckResult;
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
      const pass = JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
      return { name, expected, actual, pass, result };
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
                      <Badge variant={SEVERITY_BADGE[i.severity]}>{i.severity}</Badge>
                      <Text as="span" variant="code">
                        {label(i)}
                      </Text>
                      <Text
                        as="span"
                        variant="caption"
                        tone="muted"
                        className="min-w-0 break-words"
                      >
                        {i.message}
                      </Text>
                    </li>
                  ))}
                </ul>
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
