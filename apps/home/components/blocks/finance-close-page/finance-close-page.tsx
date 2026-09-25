// registry: finance-close-page — copied 2026-09-25
/**
 * Month-end close — a controller runs the September close in one workspace.
 *
 * What it shows a copier: two DataGrids doing real finance work inside the
 * workspace shell. The journal-entry grid opens grouped by account with sums
 * and a totals row; status and memo are edited in place (only until an entry
 * is posted, and only approved entries can be posted — `meta.validate`), saved
 * views are versioned `GridState`s, and "Export to Excel" writes exactly the
 * view on screen. "Post approved" is a bulk action with Undo. Below it, the
 * `grid-cost-tree-01` block runs the re-forecast by cost centre, and the
 * summoned assistant briefs from the same numbers.
 */
"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  BookCheck,
  CalendarCheck,
  Check,
  Eye,
  FilePen,
  FileSpreadsheet,
  Landmark,
  Lock,
  PieChart,
  Receipt,
  Scale,
} from "lucide-react";
import { MetricCard, MetricGrid } from "@elabs-ai/components-charts";
import {
  DataGrid,
  XLSX_MIME,
  applyCellChanges,
  tableToXlsx,
  type ColumnDef,
} from "@elabs-ai/components-data";
import { Badge, Button, Toaster, toast } from "@elabs-ai/components-ui";
import { CostTree } from "../grid-cost-tree-01/cost-tree";
import { downloadFile } from "../grid-parts/grid-kit";
import { SavedViewsMenu, useSavedViews, type SavedView } from "../grid-parts/saved-views";
import { WorkspaceAssistant } from "../workspace-shell/workspace-assistant";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";
import { ENTRY_STATUSES, makeJournal, type EntryStatus, type JournalEntry } from "./data/journal";

const NAV: WorkspaceNavGroup[] = [
  {
    label: "Close",
    items: [
      { id: "close", label: "September close", href: "#close", icon: CalendarCheck },
      { id: "journal", label: "Journal entries", href: "#journal", icon: BookCheck, badge: "64" },
      { id: "reconciliations", label: "Reconciliations", href: "#recs", icon: Scale },
      { id: "forecast", label: "Re-forecast", href: "#forecast", icon: PieChart },
    ],
  },
  {
    label: "Ledger",
    items: [
      { id: "accounts", label: "Chart of accounts", href: "#accounts", icon: Landmark },
      { id: "payables", label: "Payables", href: "#payables", icon: Receipt },
    ],
  },
];

const STATUS: Record<
  EntryStatus,
  {
    variant: "outline" | "info" | "success" | "secondary";
    icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  }
> = {
  Draft: { variant: "outline", icon: FilePen },
  "In review": { variant: "info", icon: Eye },
  Approved: { variant: "success", icon: Check },
  Posted: { variant: "secondary", icon: Lock },
};

function StatusBadge({ status }: { status: EntryStatus }) {
  const { variant, icon: Icon } = STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden={true} className="size-3" />
      {status}
    </Badge>
  );
}

const notPosted = (row: unknown) => (row as JournalEntry).status !== "Posted";

const COLUMNS: ColumnDef<JournalEntry>[] = [
  { accessorKey: "id", header: "Entry", size: 110 },
  { accessorKey: "date", header: "Date", size: 120 },
  { accessorKey: "account", header: "Account", size: 230, meta: { filter: "set" } },
  { accessorKey: "entity", header: "Entity", size: 120, meta: { filter: "set" } },
  { accessorKey: "type", header: "Type", size: 140, meta: { filter: "set" } },
  {
    accessorKey: "amount",
    header: "Amount (EUR)",
    size: 170,
    meta: {
      numeric: true,
      format: {
        style: "currency",
        currency: "EUR",
        abbreviate: false,
        decimals: 0,
        sign: "parens",
      },
      aggregate: "sum",
    },
  },
  { accessorKey: "preparer", header: "Preparer", size: 130, meta: { filter: "set" } },
  {
    accessorKey: "status",
    header: "Status",
    size: 140,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    meta: {
      filter: "set",
      editable: notPosted,
      options: ENTRY_STATUSES,
      validate: (value, row) =>
        value === "Posted" && (row as JournalEntry).status !== "Approved"
          ? "Only approved entries can be posted."
          : null,
    },
  },
  {
    accessorKey: "memo",
    header: "Memo",
    size: 300,
    meta: {
      editable: notPosted,
      validate: (value) => (String(value ?? "").trim() ? null : "A memo is required."),
    },
  },
];

const VIEWS: SavedView[] = [
  {
    id: "by-account",
    name: "By account",
    builtIn: true,
    state: { version: 1, grouping: ["account"], sorting: [{ id: "date", desc: true }] },
  },
  {
    id: "review",
    name: "Waiting for my review",
    builtIn: true,
    state: {
      version: 1,
      columnFilters: [{ id: "status", value: { type: "set", values: ["In review"] } }],
      sorting: [{ id: "amount", desc: true }],
    },
  },
  {
    id: "entity",
    name: "By entity and type",
    builtIn: true,
    state: { version: 1, grouping: ["entity", "type"] },
  },
];

const eur = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface FinanceClosePageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
}

export default function FinanceClosePage({ frame = "viewport" }: FinanceClosePageProps) {
  const [entries, setEntries] = useState(makeJournal);
  const saved = useSavedViews(VIEWS);

  const counts = useMemo(() => {
    const by = Object.fromEntries(ENTRY_STATUSES.map((s) => [s, 0])) as Record<EntryStatus, number>;
    for (const entry of entries) by[entry.status] += 1;
    return by;
  }, [entries]);
  const unposted = entries
    .filter((entry) => entry.status !== "Posted")
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const approvedIds = entries.filter((e) => e.status === "Approved").map((e) => e.id);

  const postApproved = () => {
    const before = entries;
    setEntries((current) =>
      current.map((e) => (e.status === "Approved" ? { ...e, status: "Posted" } : e)),
    );
    toast.success(`${approvedIds.length} entries posted to the ledger`, {
      action: { label: "Undo", onClick: () => setEntries(before) },
    });
  };

  return (
    <>
      <WorkspaceShell
        activeId="close"
        dock={{
          title: "Close assistant",
          description: "Reads the journal and the re-forecast on this screen.",
          showLabel: "Show the close assistant",
          hideLabel: "Hide the close assistant",
          defaultOpen: false,
          defaultWidth: 380,
          children: (
            <WorkspaceAssistant
              brief={[
                {
                  title: `${counts["In review"]} entries wait for review`,
                  body: `${counts.Approved} are approved and ready to post; ${counts.Draft} are still drafts.`,
                },
                {
                  title: `${eur.format(unposted)} not yet posted`,
                  body: "Gross amount of every entry that is not in the ledger yet.",
                },
              ]}
              prompts={[
                {
                  prompt: "What blocks the close?",
                  answer:
                    "The **FX revaluation** entries for Acme Ltd are still in review, and two **professional fees** accruals are drafts without a KPMG estimate. Everything else can be posted today.",
                },
                {
                  prompt: "Why is Cloud hosting over budget?",
                  answer:
                    "The Platform team’s forecast assumes the August usage spike continues. Reserved-instance renewals in October take roughly 12 % off that run-rate — ask Tomás Silva to re-forecast before the tree is locked.",
                },
              ]}
            />
          ),
        }}
        frame={frame}
        nav={NAV}
        notifications={[
          {
            id: "1",
            fallback: "LO",
            text: "Luis Ortega sent 6 accruals for review",
            time: "25m ago",
          },
          {
            id: "2",
            fallback: "MS",
            text: "Mina Sato approved the FX revaluation",
            time: "2h ago",
          },
        ]}
        orgName="Acme Group"
        productName="Finance"
        trail={[
          { href: "#finance", label: "Finance" },
          { href: "#close", label: "September close" },
        ]}
        user={{ name: "Clara Wendt", email: "clara@acme-group.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-title font-semibold">September close</h1>
              <p className="text-body text-muted-foreground">
                Working day 3 of 5. Review and post the journal, then lock the re-forecast.
              </p>
            </div>
            <Badge variant="info">Close due 2 October</Badge>
          </div>

          <section aria-label="Close progress">
            <MetricGrid columns={4}>
              <MetricCard
                description={`of ${entries.length} journal entries`}
                label="Posted"
                value={String(counts.Posted)}
              />
              <MetricCard
                description="Approved, ready to post"
                label="Ready"
                value={String(counts.Approved)}
              />
              <MetricCard
                description="Waiting for a reviewer"
                label="In review"
                value={String(counts["In review"])}
              />
              <MetricCard
                description="Gross, not yet in the ledger"
                label="Unposted"
                value={eur.format(unposted)}
              />
            </MetricGrid>
          </section>

          <section aria-labelledby="journal-title" className="flex flex-col gap-3" id="journal">
            <div className="flex flex-col gap-1">
              <h2 className="text-subtitle font-semibold" id="journal-title">
                Journal entries
              </h2>
              <p className="text-meta text-muted-foreground">
                Edit status and memo in place until an entry is posted. Only approved entries can be
                posted.
              </p>
            </div>
            <DataGrid
              initialView={saved.initialView}
              key={saved.gridKey}
              caption="September journal entries"
              columns={COLUMNS}
              data={entries}
              enableGrouping
              exportFileName="journal-september"
              getRowId={(entry) => entry.id}
              onCellEdit={(changes) =>
                setEntries((current) => applyCellChanges(current, changes, (e) => e.id))
              }
              showTotals
              toolbar={(table) => (
                <div className="flex flex-wrap items-center gap-2">
                  <SavedViewsMenu
                    activeId={saved.active?.id}
                    onApply={saved.apply}
                    onSave={saved.save}
                    table={table}
                    views={saved.views}
                  />
                  <Button
                    onClick={() =>
                      downloadFile(
                        tableToXlsx(table, { sheetName: "Journal" }),
                        "journal-september.xlsx",
                        XLSX_MIME,
                      )
                    }
                    size="sm"
                    variant="outline"
                  >
                    <FileSpreadsheet aria-hidden="true" />
                    Export to Excel
                  </Button>
                  <Button disabled={approvedIds.length === 0} onClick={postApproved} size="sm">
                    <Lock aria-hidden="true" />
                    Post approved ({approvedIds.length})
                  </Button>
                </div>
              )}
            />
          </section>

          <div id="forecast">
            <CostTree />
          </div>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
