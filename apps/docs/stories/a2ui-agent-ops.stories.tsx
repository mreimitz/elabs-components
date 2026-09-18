import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { useState } from "react";
import {
  A2UI_CATALOG_SCHEMA,
  A2uiSurface,
  UI_CATALOG_BINDINGS,
  createA2uiCatalog,
  defineA2uiType,
  type A2uiAction,
  type A2uiActionContext,
  type A2uiSurfaceSpec,
} from "@elabs-ai/components-ai";
import { CHARTS_A2UI_BINDINGS, CHARTS_A2UI_CATALOG_SCHEMA } from "@elabs-ai/components-charts";
import {
  DERIVED_AT,
  NOW,
  decisionRecord,
  headlineKpis,
  heldItems,
  insights,
  leadScore,
  type Evidence,
  type Insight,
  type ProvenanceKpi,
} from "@/components/agent-ops-parts/data/atlas-ops";
import { DecisionRecord } from "@/components/decision-record-01/decision-record";
import { InsightFeed } from "@/components/insight-feed-01/insight-feed";
import { KpiProvenanceStrip } from "@/components/kpi-provenance-strip-01/kpi-provenance-strip";
import { ScoreExplanation } from "@/components/score-explanation-01/score-explanation";

/**
 * The agent-ops blocks as **agent-designed surfaces**: an ops copilot answers
 * "what changed while I was away?" and "why did you hold this?" with JSON,
 * validated against the app's catalog, rendered by `<A2uiSurface>`. Same
 * adapter pattern as the analytics catalog — the agent emits FACTS (a figure,
 * its source, when it was read; an insight, its evidence, its confidence)
 * and the block derives deltas, provenance lines and layout. Dates travel as
 * ISO strings because a surface is JSON; the adapter turns them into `Date`s.
 */

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

interface KpiFacts extends Omit<ProvenanceKpi, "refreshedAt"> {
  /** ISO 8601 — a surface is JSON. */
  refreshedAt: string;
}

function ProvenanceKpis({
  kpis,
  now,
  title,
  locale,
}: {
  kpis: KpiFacts[];
  now: string;
  title?: string;
  locale?: string;
}) {
  return (
    <KpiProvenanceStrip
      kpis={kpis.map((k) => ({ ...k, refreshedAt: new Date(k.refreshedAt) }))}
      locale={locale}
      now={new Date(now)}
      title={title}
    />
  );
}

function Insights({
  items,
  held,
  onAction,
  locale,
}: {
  items: Insight[];
  held?: typeof heldItems;
  onAction?: (payload: { id: string; action: "primary" | "secondary" }) => void;
  locale?: string;
}) {
  return (
    <InsightFeed
      held={held ?? []}
      items={items}
      locale={locale}
      onAction={(insight, action) => onAction?.({ id: insight.id, action })}
    />
  );
}

function Decision({
  record,
  onDecide,
  locale,
}: {
  record: Omit<typeof decisionRecord, "at"> & { at: string };
  onDecide?: (choice: "approve" | "dismiss") => void;
  locale?: string;
}) {
  return (
    <DecisionRecord
      locale={locale}
      onDecide={onDecide}
      record={{ ...record, at: new Date(record.at) }}
    />
  );
}

const EVIDENCE_DOC = "[{ kind: email|meeting|call|invoice|event|note|filing, label }]";

const agentOpsCatalog = createA2uiCatalog(
  {
    ...UI_CATALOG_BINDINGS,
    ...CHARTS_A2UI_BINDINGS,
    ProvenanceKpis,
    Insights,
    Decision,
    ScoreExplanation,
  },
  {
    ...A2UI_CATALOG_SCHEMA,
    ...CHARTS_A2UI_CATALOG_SCHEMA,
    ProvenanceKpis: defineA2uiType({
      summary:
        "Headline figures that each name their source and freshness. Emit the figure, its prior, its source and when it was read — the block derives the delta and the provenance line.",
      props: {
        kpis: {
          type: "array",
          required: true,
          description:
            "[{ id, label, value, unit: currency|percent|count, prior, higherIsBetter, source, refreshedAt (ISO), derivedFrom?, currency? }]",
        },
        now: { type: "string", required: true, description: "ISO 8601 snapshot moment." },
        title: { type: "string" },
        locale: { type: "string" },
      },
    }),
    Insights: defineA2uiType({
      summary:
        "What changed while you were away: numbered facts with a why, evidence, confidence and two actions. Omit confidence for a conflict — the block prints “No verdict — a person decides”.",
      props: {
        items: {
          type: "array",
          required: true,
          description: `[{ id, kind: applied|adjusted|conflict, headline, explanation, evidence: ${EVIDENCE_DOC}, confidence? (0–1), subject, primaryAction, secondaryAction }]`,
        },
        held: {
          type: "array",
          description:
            "[{ id, tone: destructive|warning, title, note }] — what stopped and waits for a person.",
        },
        locale: { type: "string" },
      },
      events: { action: "onAction" },
    }),
    Decision: defineA2uiType({
      summary:
        "A decision record: what it did, what it looked at, what rule applied, how confident (null = declined to say), how to reverse it; the checks and the proposal. Nothing is actioned until a person approves.",
      props: {
        record: {
          type: "object",
          required: true,
          description:
            "{ id, entry, at (ISO), durationMs, subject, amount, currency, verdict, verdictDetail, whatItDid, whatItLookedAt: evidence[], lookedAtDetail, rule, ruleDetail, confidence|null, confidenceDetail, howToReverse, checks: [{ id, label, detail, confirmed }], proposes: string[] }",
        },
        locale: { type: "string" },
      },
      events: { decide: "onDecide" },
    }),
    ScoreExplanation: defineA2uiType({
      summary:
        "Why a score is what it is: signed contributions in points, one bar per signal, plus how many weaker signals were left out.",
      props: {
        score: { type: "number", required: true },
        signals: {
          type: "array",
          required: true,
          description: "[{ id, label, points (signed) }]",
        },
        omittedSignals: { type: "number", default: 0 },
        omittedThreshold: { type: "number", default: 2 },
        subject: { type: "string", default: "the score" },
        locale: { type: "string" },
      },
    }),
  },
);

// ---------------------------------------------------------------------------
// The facts an agent would have pulled — serialisable, plain.
// ---------------------------------------------------------------------------
const kpiFacts: KpiFacts[] = headlineKpis.map((k) => ({
  ...k,
  refreshedAt: k.refreshedAt.toISOString(),
}));
const evidence = (e: Evidence[]) => e.map(({ kind, label }) => ({ kind, label }));

/** "What changed while I was away?" */
const WHILE_AWAY: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "While you were away",
  root: {
    type: "Stack",
    props: { gap: "lg" },
    children: [
      {
        type: "SectionHeader",
        props: {
          eyebrow: "Briefing · Thursday 31 August",
          title: "Northwind moved forward, Arden went quiet, and one seat count needs you",
          description: `Derived ${DERIVED_AT.toISOString().slice(11, 16)} from 1,284 signals across 6 sources. 403 fields updated on their own; 9 need you.`,
        },
      },
      {
        type: "ProvenanceKpis",
        props: { kpis: kpiFacts, now: NOW.toISOString() },
      },
      {
        type: "Insights",
        props: {
          items: insights.map((i) => ({ ...i, evidence: evidence(i.evidence) })),
          held: heldItems,
        },
        on: { action: { name: "insight" } },
      },
      {
        type: "Stack",
        props: { direction: "row", gap: "sm" },
        children: [
          {
            type: "Button",
            props: { variant: "outline" },
            children: ["Show the pipeline"],
            on: { click: { name: "open", payload: { view: "pipeline" } } },
          },
          {
            type: "Button",
            props: { variant: "outline" },
            children: ["What did the agents spend?"],
            on: { click: { name: "open", payload: { view: "agents" } } },
          },
        ],
      },
    ],
  },
};

/** "Why did you hold the Blue Bottle receipt?" */
const WHY_HELD: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Why the receipt was held",
  root: {
    type: "Stack",
    props: { gap: "lg" },
    children: [
      {
        type: "SectionHeader",
        props: {
          eyebrow: "Queue · txn_9f2c41ab",
          title: "The receipt does not match the charge, so nothing moved",
          description:
            "One of five checks confirmed. The card network authorised $12.40; the receipt claims $38.75 and carries generation artefacts.",
        },
      },
      {
        type: "Decision",
        props: {
          record: {
            ...decisionRecord,
            at: decisionRecord.at.toISOString(),
            whatItLookedAt: evidence(decisionRecord.whatItLookedAt),
          },
        },
        on: { decide: { name: "decide", payload: { id: decisionRecord.id } } },
      },
      {
        type: "ScoreExplanation",
        props: {
          score: leadScore.score,
          signals: leadScore.signals,
          omittedSignals: leadScore.omittedSignals,
          omittedThreshold: leadScore.omittedThreshold,
          subject: "the lead score",
        },
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Host chrome
// ---------------------------------------------------------------------------
function ActionLog({ entries }: { entries: string[] }) {
  return (
    <div
      aria-live="polite"
      className="rounded-md bg-surface-muted p-3 text-caption text-muted-foreground"
      data-testid="action-log"
    >
      {entries.length ? (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li className="font-mono" key={e}>
              {e}
            </li>
          ))}
        </ul>
      ) : (
        "Actions the surface sends to the host appear here."
      )}
    </div>
  );
}

function Answer({ surface }: { surface: A2uiSurfaceSpec }) {
  const [log, setLog] = useState<string[]>([]);
  const onAction = (action: A2uiAction, ctx: A2uiActionContext) =>
    setLog((l) => [
      ...l,
      `${l.length + 1}. ${ctx.event} → ${action.name} ${JSON.stringify(action.payload ?? ctx.value ?? "")}`,
    ]);
  return (
    <div className="flex flex-col gap-4">
      <A2uiSurface catalog={agentOpsCatalog} onAction={onAction} surface={surface} />
      <ActionLog entries={log} />
    </div>
  );
}

const meta = {
  title: "AI/A2UI Agent Ops",
  component: A2uiSurface,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof A2uiSurface>;
export default meta;

type Story = StoryObj<typeof meta>;

/** "What changed while I was away?" — provenance KPIs, the insight feed with its actions, next questions. */
export const WhileYouWereAway: Story = {
  args: { surface: WHILE_AWAY },
  render: (args) => <Answer surface={args.surface as A2uiSurfaceSpec} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Where the business stands")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Open deal" }));
    await expect(canvas.getByTestId("action-log")).toHaveTextContent(
      'action → insight {"id":"northwind-negotiation","action":"primary"}',
    );
  },
};

/** "Why did you hold this?" — the decision record with approve/dismiss reaching the host, and the score explained. */
export const WhyItWasHeld: Story = {
  args: { surface: WHY_HELD },
  render: (args) => <Answer surface={args.surface as A2uiSurfaceSpec} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(canvas.getByTestId("action-log")).toHaveTextContent(
      'decide → decide {"id":"txn_9f2c41ab"}',
    );
  },
};
