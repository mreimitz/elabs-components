import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  Check,
  CircleDot,
  Clock,
  Database,
  Lock,
  Minus,
  Puzzle,
  RefreshCw,
  Users,
  WifiOff,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  cn,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

/** How an option fares on one criterion — the icon carries it, colour is the second channel. */
export type Verdict = "yes" | "partly" | "no";

export interface CompareOption {
  id: string;
  name: string;
  /** Marked "Us" in words — the column the reader came to check. */
  ours?: boolean;
}

export interface CompareRow {
  id: string;
  criterion: string;
  icon: Glyph;
  /** One cell per option, in the options' order. */
  cells: { verdict: Verdict; text: string }[];
}

export interface MarketingCompareProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  options?: CompareOption[];
  rows?: CompareRow[];
  /** The closing "best for" line under each column, in the options' order. */
  bestFor?: string[];
}

const DEFAULT_OPTIONS: CompareOption[] = [
  { id: "beacon", name: "Beacon", ours: true },
  { id: "sheets", name: "Spreadsheets" },
  { id: "legacy", name: "Legacy BI suite" },
];

const DEFAULT_ROWS: CompareRow[] = [
  {
    id: "first-chart",
    criterion: "Time to a first chart",
    icon: Clock,
    cells: [
      { verdict: "yes", text: "Minutes. Connect a warehouse, ask in plain words." },
      { verdict: "yes", text: "Minutes, when the data is already in the file." },
      { verdict: "no", text: "Weeks. A semantic model comes first." },
    ],
  },
  {
    id: "freshness",
    criterion: "Data is live",
    icon: RefreshCw,
    cells: [
      { verdict: "yes", text: "Queries run against the warehouse on open." },
      { verdict: "no", text: "A copy from whenever someone last pasted." },
      { verdict: "partly", text: "Scheduled extracts, usually nightly." },
    ],
  },
  {
    id: "one-truth",
    criterion: "One definition of a metric",
    icon: Database,
    cells: [
      { verdict: "yes", text: "Metrics are defined once and reused everywhere." },
      { verdict: "no", text: "Every tab has its own formula." },
      { verdict: "yes", text: "The strongest part of a governed model." },
    ],
  },
  {
    id: "collab",
    criterion: "Working together",
    icon: Users,
    cells: [
      { verdict: "yes", text: "Comment on a chart; share a link, not a file." },
      { verdict: "partly", text: "Fine until two people edit the same cell." },
      { verdict: "partly", text: "Dashboards yes, ad-hoc questions no." },
    ],
  },
  {
    id: "offline",
    criterion: "Works without a connection",
    icon: WifiOff,
    cells: [
      { verdict: "no", text: "No. Beacon needs the warehouse." },
      { verdict: "yes", text: "Yes, anywhere the file is." },
      { verdict: "partly", text: "Cached views only." },
    ],
  },
  {
    id: "access",
    criterion: "Row-level access control",
    icon: Lock,
    cells: [
      { verdict: "yes", text: "Inherited from the warehouse policies." },
      { verdict: "no", text: "Whoever has the file has all of it." },
      { verdict: "yes", text: "Yes, configured per report." },
    ],
  },
  {
    id: "integrations",
    criterion: "Plays with the rest of the stack",
    icon: Puzzle,
    cells: [
      { verdict: "yes", text: "40 native sources, Slack, and a REST API." },
      { verdict: "partly", text: "Imports from almost anything, exports to CSV." },
      { verdict: "partly", text: "Deep for its own vendor, thin elsewhere." },
    ],
  },
  {
    id: "cost",
    criterion: "Cost for a team of 25",
    icon: Wallet,
    cells: [
      { verdict: "partly", text: "$1,200 a month. Not free." },
      { verdict: "yes", text: "Usually already paid for." },
      { verdict: "no", text: "$4,000 a month plus an admin." },
    ],
  },
];

const VERDICT: Record<Verdict, { icon: Glyph; label: string; className: string }> = {
  yes: { icon: Check, label: "Yes", className: "bg-success/10 text-success" },
  partly: { icon: CircleDot, label: "Partly", className: "bg-warning/10 text-warning" },
  no: { icon: Minus, label: "No", className: "bg-muted text-muted-foreground" },
};

function VerdictMark({ verdict }: { verdict: Verdict }) {
  const { icon: Icon, label, className } = VERDICT[verdict];
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full",
        className,
      )}
      data-verdict={verdict}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{label}:</span>
    </span>
  );
}

/**
 * Us against the alternatives, honestly — a row per criterion with a yes / partly / no mark
 * and a sentence of verdict per column, including the rows where a spreadsheet wins. The
 * last row says who each option is best for. A table when there is room, one card per
 * criterion when there is not.
 */
export function MarketingCompare({
  eyebrow = "Compare",
  title = "How Beacon compares with what you use today",
  description = "We win most rows, not all of them. If a spreadsheet does the job, keep the spreadsheet.",
  options = DEFAULT_OPTIONS,
  rows = DEFAULT_ROWS,
  bestFor = [
    "Teams that ask new questions of live data every day.",
    "One-off analysis by one person, done by Friday.",
    "Regulated reporting where every number is signed off.",
  ],
}: MarketingCompareProps) {
  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-compare"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} title={title} />

      <div className="hidden @2xl:block" data-slot="marketing-compare-table">
        <Table>
          <caption className="sr-only">Criteria by option</caption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[22%]" scope="col">
                Criterion
              </TableHead>
              {options.map((option) => (
                <TableHead
                  className={cn("w-[26%]", option.ours && "bg-primary/5")}
                  key={option.id}
                  scope="col"
                >
                  <span className="inline-flex items-center gap-2">
                    {option.name}
                    {option.ours ? <Badge className="normal-case tracking-normal">Us</Badge> : null}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <TableRow key={row.id}>
                  <TableHead className="h-auto bg-transparent py-4 align-top" scope="row">
                    <span className="flex items-start gap-2 text-body font-medium normal-case tracking-normal text-foreground">
                      <Icon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      />
                      {row.criterion}
                    </span>
                  </TableHead>
                  {options.map((option, index) => {
                    const cell = row.cells[index];
                    if (!cell) return <TableCell key={option.id} />;
                    return (
                      <TableCell
                        className={cn("py-4 align-top", option.ours && "bg-primary/5")}
                        key={option.id}
                      >
                        <span className="flex items-start gap-2.5">
                          <VerdictMark verdict={cell.verdict} />
                          <span className="text-body text-pretty">{cell.text}</span>
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
            <TableRow className="bg-surface-muted/50 hover:bg-surface-muted/50">
              <TableHead className="h-auto bg-transparent py-4 align-top" scope="row">
                <span className="block text-body font-medium normal-case tracking-normal text-foreground">
                  Best for
                </span>
              </TableHead>
              {options.map((option, index) => (
                <TableCell
                  className={cn("py-4 align-top", option.ours && "bg-primary/5")}
                  key={option.id}
                >
                  <span className="text-body font-medium text-pretty">{bestFor[index]}</span>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-4 @2xl:hidden" data-slot="marketing-compare-cards">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.id}>
              <Card>
                <CardContent className="flex flex-col gap-4 p-5">
                  <h3 className="flex items-center gap-2 text-subtitle font-semibold">
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    {row.criterion}
                  </h3>
                  <dl className="flex flex-col gap-3">
                    {options.map((option, index) => {
                      const cell = row.cells[index];
                      if (!cell) return null;
                      return (
                        <div className="flex items-start gap-2.5" key={option.id}>
                          <VerdictMark verdict={cell.verdict} />
                          <div className="flex min-w-0 flex-col">
                            <dt className="flex items-center gap-2 text-caption font-medium text-muted-foreground">
                              {option.name}
                              {option.ours ? <Badge>Us</Badge> : null}
                            </dt>
                            <dd className="text-body text-pretty">{cell.text}</dd>
                          </div>
                        </div>
                      );
                    })}
                  </dl>
                </CardContent>
              </Card>
            </li>
          );
        })}
        <li>
          <Card className="bg-surface-muted">
            <CardContent className="flex flex-col gap-3 p-5">
              <h3 className="text-subtitle font-semibold">Best for</h3>
              <dl className="flex flex-col gap-2">
                {options.map((option, index) => (
                  <div className="flex flex-col" key={option.id}>
                    <dt className="text-caption font-medium text-muted-foreground">
                      {option.name}
                    </dt>
                    <dd className="text-body">{bestFor[index]}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </li>
      </ul>
    </section>
  );
}
