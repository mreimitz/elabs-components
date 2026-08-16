import type { Meta, StoryObj } from "@storybook/react-vite";

import { CalcBlock } from "./calc-block";
import type { CalcSheet, CalcTokenKind, EvaluateCalc } from "./types";

const meta = {
  title: "Editor/CalcBlock",
  component: CalcBlock,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof CalcBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

function tok(start: number, end: number, kind: CalcTokenKind, resolved = true) {
  return { start, end, kind, resolved };
}

// A hand-authored sheet stands in for the consumer's real evaluator (the math
// engine is app/domain logic and lives outside the design system).
const SOURCE = [
  "# Lisbon trip",
  "flights = 320 EUR",
  "hotel = 95 EUR * 4",
  "total = flights + hotel",
  "tax = 25% of total // estimate",
  "mystery = foo + 1",
].join("\n");

const SHEET: CalcSheet = {
  results: [
    { line: 1, tokens: [tok(0, 13, "comment")] },
    {
      line: 2,
      tokens: [tok(0, 7, "var-def"), tok(10, 13, "number"), tok(14, 17, "currency")],
      value: { kind: "currency", raw: 320, unit: "EUR", display: "€320.00" },
    },
    {
      line: 3,
      tokens: [
        tok(0, 5, "var-def"),
        tok(8, 10, "number"),
        tok(11, 14, "currency"),
        tok(15, 16, "operator"),
        tok(17, 18, "number"),
      ],
      value: { kind: "currency", raw: 380, unit: "EUR", display: "€380.00" },
    },
    {
      line: 4,
      tokens: [
        tok(0, 5, "var-def"),
        tok(8, 15, "var-ref"),
        tok(16, 17, "operator"),
        tok(18, 23, "var-ref"),
      ],
      value: { kind: "currency", raw: 700, unit: "EUR", display: "€700.00" },
    },
    {
      line: 5,
      tokens: [
        tok(0, 3, "var-def"),
        tok(6, 8, "number"),
        tok(8, 9, "operator"),
        tok(13, 18, "var-ref"),
        tok(19, 29, "comment"),
      ],
      value: { kind: "currency", raw: 175, unit: "EUR", display: "€175.00" },
    },
    {
      line: 6,
      tokens: [
        tok(0, 7, "var-def"),
        tok(10, 13, "unknown", false),
        tok(14, 15, "operator"),
        tok(16, 17, "number"),
      ],
      error: { message: 'Undefined symbol "foo"' },
    },
  ],
  total: { kind: "currency", raw: 1575, unit: "EUR", display: "€1,575.00" },
};

const evaluate: EvaluateCalc = () => SHEET;

/** The leading `# Lisbon trip` is lifted into the block's title bar. */
export const Default: Story = {
  args: { source: SOURCE, evaluate },
};

/** With no `# Heading` line, the header falls back to the neutral `calc` label. */
const UNTITLED_SOURCE = ["flights = 320 EUR", "hotel = 95 EUR * 4", "total = flights + hotel"].join(
  "\n",
);
const UNTITLED_SHEET: CalcSheet = {
  results: [
    {
      line: 1,
      tokens: [tok(0, 7, "var-def"), tok(10, 13, "number"), tok(14, 17, "currency")],
      value: { kind: "currency", raw: 320, unit: "EUR", display: "€320.00" },
    },
    {
      line: 2,
      tokens: [tok(0, 5, "var-def"), tok(8, 10, "number"), tok(11, 14, "currency")],
      value: { kind: "currency", raw: 380, unit: "EUR", display: "€380.00" },
    },
    {
      line: 3,
      tokens: [tok(0, 5, "var-def"), tok(8, 15, "var-ref"), tok(18, 23, "var-ref")],
      value: { kind: "currency", raw: 700, unit: "EUR", display: "€700.00" },
    },
  ],
  total: { kind: "currency", raw: 700, unit: "EUR", display: "€700.00" },
};

export const Untitled: Story = {
  args: { source: UNTITLED_SOURCE, evaluate: () => UNTITLED_SHEET },
};

export const WithoutTotal: Story = {
  args: { source: SOURCE, evaluate, showTotal: false },
};

// ── Row rules (dividers) ─────────────────────────────────────────────────────
// A line-item ledger: a single rule separates the items from the subtotal, a
// dotted rule sets off the adjustment, and a double rule precedes the total.
const RULES_SOURCE = [
  "# Invoice 0042",
  "design = 1,200 USD",
  "build = 3,400 USD",
  "subtotal = design + build",
  "discount = 10% of subtotal",
  "total = subtotal - discount",
].join("\n");

const RULES_SHEET: CalcSheet = {
  results: [
    { line: 1, tokens: [tok(0, 14, "comment")] },
    {
      line: 2,
      tokens: [tok(0, 6, "var-def"), tok(9, 14, "number"), tok(15, 18, "currency")],
      value: { kind: "currency", raw: 1200, unit: "USD", display: "$1,200.00" },
    },
    {
      line: 3,
      tokens: [tok(0, 5, "var-def"), tok(8, 13, "number"), tok(14, 17, "currency")],
      value: { kind: "currency", raw: 3400, unit: "USD", display: "$3,400.00" },
      rule: "single",
    },
    {
      line: 4,
      tokens: [
        tok(0, 8, "var-def"),
        tok(11, 17, "var-ref"),
        tok(18, 19, "operator"),
        tok(20, 25, "var-ref"),
      ],
      value: { kind: "currency", raw: 4600, unit: "USD", display: "$4,600.00" },
    },
    {
      line: 5,
      tokens: [tok(0, 8, "var-def"), tok(11, 14, "number"), tok(18, 26, "var-ref")],
      value: { kind: "currency", raw: -460, unit: "USD", display: "−$460.00" },
      rule: "double",
    },
    {
      line: 6,
      tokens: [
        tok(0, 5, "var-def"),
        tok(8, 16, "var-ref"),
        tok(17, 18, "operator"),
        tok(19, 27, "var-ref"),
      ],
      value: { kind: "currency", raw: 4140, unit: "USD", display: "$4,140.00" },
    },
  ],
  total: { kind: "currency", raw: 4140, unit: "USD", display: "$4,140.00" },
};

export const Rules: Story = {
  args: { source: RULES_SOURCE, evaluate: () => RULES_SHEET, showTotal: false },
};

// ── Row tints ────────────────────────────────────────────────────────────────
// Semantic status washes flag rows at a glance: on-track (success), watch
// (warning), over budget (destructive), and a neutral (muted) note row.
const TINTS_SOURCE = [
  "# Q3 budget",
  "marketing = 12,000 USD",
  "travel = 8,000 USD",
  "overage = 3,000 USD",
  "headcount = 5",
].join("\n");

const TINTS_SHEET: CalcSheet = {
  results: [
    { line: 1, tokens: [tok(0, 11, "comment")] },
    {
      line: 2,
      tokens: [tok(0, 9, "var-def"), tok(12, 18, "number"), tok(19, 22, "currency")],
      value: { kind: "currency", raw: 12000, unit: "USD", display: "$12,000.00" },
      tint: "success",
    },
    {
      line: 3,
      tokens: [tok(0, 6, "var-def"), tok(9, 14, "number"), tok(15, 18, "currency")],
      value: { kind: "currency", raw: 8000, unit: "USD", display: "$8,000.00" },
      tint: "warning",
    },
    {
      line: 4,
      tokens: [tok(0, 7, "var-def"), tok(10, 15, "number"), tok(16, 19, "currency")],
      value: { kind: "currency", raw: 3000, unit: "USD", display: "$3,000.00" },
      tint: "destructive",
    },
    {
      line: 5,
      tokens: [tok(0, 9, "var-def"), tok(12, 13, "number")],
      value: { kind: "number", raw: 5, display: "5" },
      tint: "muted",
    },
  ],
  total: { kind: "currency", raw: 23000, unit: "USD", display: "$23,000.00" },
};

export const Tints: Story = {
  args: { source: TINTS_SOURCE, evaluate: () => TINTS_SHEET },
};

// ── Author markers (what a writer types) ─────────────────────────────────────
// The same tints/rules as above, but driven by trailing `@markers` the WRITER
// types in the calc text — CalcBlock strips them before `evaluate` runs, so this
// evaluator is marker-agnostic and sets NO tint/rule fields itself.
const AUTHORED_SOURCE = [
  "# Q3 budget",
  "marketing = 12,000 USD @success",
  "travel = 8,000 USD @warning",
  "overage = 3,000 USD @danger",
  "subtotal = marketing + travel + overage @line",
  "note: review with finance @muted",
].join("\n");

// Token columns are relative to the marker-stripped text CalcBlock passes here.
const AUTHORED_SHEET: CalcSheet = {
  results: [
    { line: 1, tokens: [tok(0, 11, "comment")] },
    {
      line: 2,
      tokens: [tok(0, 9, "var-def"), tok(12, 18, "number"), tok(19, 22, "currency")],
      value: { kind: "currency", raw: 12000, unit: "USD", display: "$12,000.00" },
    },
    {
      line: 3,
      tokens: [tok(0, 6, "var-def"), tok(9, 14, "number"), tok(15, 18, "currency")],
      value: { kind: "currency", raw: 8000, unit: "USD", display: "$8,000.00" },
    },
    {
      line: 4,
      tokens: [tok(0, 7, "var-def"), tok(10, 15, "number"), tok(16, 19, "currency")],
      value: { kind: "currency", raw: 3000, unit: "USD", display: "$3,000.00" },
    },
    {
      line: 5,
      tokens: [
        tok(0, 8, "var-def"),
        tok(11, 20, "var-ref"),
        tok(23, 29, "var-ref"),
        tok(32, 39, "var-ref"),
      ],
      value: { kind: "currency", raw: 23000, unit: "USD", display: "$23,000.00" },
    },
    { line: 6, tokens: [tok(0, 4, "var-def"), tok(6, 25, "comment")] },
  ],
  total: { kind: "currency", raw: 23000, unit: "USD", display: "$23,000.00" },
};

export const AuthoredMarkers: Story = {
  args: { source: AUTHORED_SOURCE, evaluate: () => AUTHORED_SHEET },
};

/**
 * Override the footer total and its label — e.g. show a budget remaining the
 * evaluator surfaced separately, rather than the auto running total.
 */
export const TotalOverride: Story = {
  args: {
    source: SOURCE,
    evaluate,
    totalLabel: "Budget left",
    total: { kind: "currency", raw: 425, unit: "EUR", display: "€425.00" },
  },
};

export const Empty: Story = {
  args: { source: "", evaluate: () => ({ results: [] }) },
};
