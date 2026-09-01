/**
 * Comparison Table — the feature/plan matrix brand-ui was missing.
 *
 * shadcnblocks' Compare group is a real capability gap (zero coverage). This
 * block is the canonical plan/feature comparison: a sticky-ish header with one
 * featured column (badge + emphasis), feature rows with check / dash / value
 * cells, a price row, and a per-plan CTA row. Reuses brand-ui's strongest
 * assets — Table + Badge + Button — and stays token-only.
 *
 * Reads in every theme. Verify with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check, Minus } from "lucide-react";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./index";

interface Plan {
  id: string;
  name: string;
  price: string;
  per: string;
  cta: string;
  featured?: boolean;
}

const PLANS: Plan[] = [
  { id: "starter", name: "Starter", price: "$0", per: "free forever", cta: "Start free" },
  {
    id: "business",
    name: "Business",
    price: "$49",
    per: "per user / mo",
    cta: "Start trial",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    per: "contact us",
    cta: "Contact sales",
  },
];

type Cell = string | boolean;
const FEATURES: { label: string; values: [Cell, Cell, Cell] }[] = [
  { label: "Seats", values: ["Up to 3", "Up to 50", "Unlimited"] },
  { label: "Projects", values: ["3", "Unlimited", "Unlimited"] },
  { label: "Data history", values: ["7 days", "1 year", "Unlimited"] },
  { label: "SSO / SAML", values: [false, false, true] },
  { label: "Audit log", values: [false, true, true] },
  { label: "Priority support", values: [false, true, true] },
  { label: "Uptime SLA", values: [false, false, true] },
];

/** featured column gets a recessed wash so the eye lands on it. */
function colClass(featured?: boolean) {
  return featured ? "bg-surface-muted" : "";
}

function ValueCell({ value }: { value: Cell }) {
  if (typeof value === "boolean") {
    return value ? (
      <>
        <Check className="mx-auto size-4 text-success-text" aria-hidden="true" />
        <span className="sr-only">Included</span>
      </>
    ) : (
      <>
        <Minus className="mx-auto size-4 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-body text-foreground">{value}</span>;
}

function ComparisonTable() {
  return (
    <div className="bg-background p-6 text-foreground">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[34%] align-bottom">
                <span className="text-body font-medium text-muted-foreground">Compare plans</span>
              </TableHead>
              {PLANS.map((p) => (
                <TableHead
                  key={p.id}
                  className={`text-center align-bottom ${colClass(p.featured)}`}
                >
                  <div className="flex flex-col items-center gap-1 py-2">
                    {p.featured ? <Badge>Most popular</Badge> : null}
                    <span className="text-subtitle font-semibold text-foreground">{p.name}</span>
                    <span className="text-title font-semibold tabular-nums text-foreground">
                      {p.price}
                    </span>
                    <span className="text-meta text-muted-foreground">{p.per}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {FEATURES.map((f) => (
              <TableRow key={f.label}>
                <TableCell className="font-medium text-foreground">{f.label}</TableCell>
                {PLANS.map((p, i) => (
                  <TableCell key={p.id} className={`text-center ${colClass(p.featured)}`}>
                    <ValueCell value={f.values[i] ?? "—"} />
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {/* CTA row */}
            <TableRow className="hover:bg-transparent">
              <TableCell />
              {PLANS.map((p) => (
                <TableCell key={p.id} className={`text-center ${colClass(p.featured)}`}>
                  <Button
                    size="sm"
                    variant={p.featured ? "default" : "outline"}
                    className="my-2 w-full max-w-[12rem]"
                  >
                    {p.cta}
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const meta = {
  title: "Patterns/Blocks/Comparison Table",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The canonical plan/feature comparison matrix (brand-ui's Compare gap): a header with one featured column (badge + recessed wash), feature rows with check / dash / value cells, a price row, and a per-plan CTA row. Composes Table + Badge + Button; semantic tokens only; reads in every theme.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <ComparisonTable /> };
