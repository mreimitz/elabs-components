import type { Meta, StoryObj } from "@storybook/react-vite";

import { DecisionCard } from "./decision-card";
import { EntityCard, EntityChip } from "./entity";
import { KnowledgeCard, type KnowledgeSourceResolver } from "./knowledge-card";

/* ------------------------------------------------------------------ */
/* DecisionCard                                                         */
/* ------------------------------------------------------------------ */

const decisionMeta = {
  title: "Editor/AiObjects/DecisionCard",
  component: DecisionCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof DecisionCard>;

export default decisionMeta;
type DecisionStory = StoryObj<typeof decisionMeta>;

export const Accepted: DecisionStory = {
  args: {
    status: "accepted",
    date: "2026-06-15",
    alternatives: "Redis cache, in-memory map, SQLite",
    children: (
      <p>
        PostgreSQL was chosen because it already runs in production, supports JSONB for flexible
        schemas, and the team has operational expertise with it. Introducing a second data store for
        caching would add operational burden that outweighs the latency gain at current scale.
      </p>
    ),
  },
};

export const Proposed: DecisionStory = {
  args: {
    status: "proposed",
    date: "2026-07-01",
    children: <p>Migrate the report pipeline to streaming to reduce time-to-first-byte by ~40%.</p>,
  },
};

export const Rejected: DecisionStory = {
  args: {
    status: "rejected",
    date: "2026-05-10",
    alternatives: "Micro-frontend shell, Module federation",
    children: <p>Full micro-frontend split was rejected due to excessive coordination overhead.</p>,
  },
};

export const Superseded: DecisionStory = {
  args: {
    status: "superseded",
    date: "2025-11-01",
    children: (
      <p>
        Original caching strategy (Redis) was superseded by the PostgreSQL materialized-view
        approach in ADR-0014.
      </p>
    ),
  },
};

/** No rationale body — header-only layout. */
export const NoBody: DecisionStory = {
  args: {
    status: "accepted",
    date: "2026-06-01",
  },
};

/** Unrecognised status degrades to "proposed". */
export const UnknownStatus: DecisionStory = {
  args: {
    status: "in-review",
    date: "2026-06-15",
    children: <p>Unknown status values fall back to the "proposed" state.</p>,
  },
};

/** Long alternatives list — chips wrap. */
export const ManyAlternatives: DecisionStory = {
  args: {
    status: "accepted",
    date: "2026-06-15",
    alternatives: "Option A, Option B, Option C, Option D, Option E, Option F, Option G, Option H",
    children: <p>Chose the simplest path that could possibly work.</p>,
  },
};

/* ------------------------------------------------------------------ */
/* EntityChip (inline)                                                  */
/* ------------------------------------------------------------------ */

export const EntityChipDefault: StoryObj = {
  name: "EntityChip / Default",
  render: () => (
    <p className="max-w-prose text-body text-foreground">
      The contract was signed between <EntityChip kind="org">Acme Corp</EntityChip> and{" "}
      <EntityChip kind="person">Jane Smith</EntityChip> at the{" "}
      <EntityChip kind="place">London office</EntityChip>. The{" "}
      <EntityChip kind="product">DataBridge SDK</EntityChip> was the primary deliverable, and the{" "}
      <EntityChip kind="concept">data sovereignty</EntityChip> requirement shaped every clause.
    </p>
  ),
  parameters: { layout: "padded" },
};

export const EntityChipKinds: StoryObj = {
  name: "EntityChip / All kinds",
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <EntityChip kind="org">Acme Corp</EntityChip>
      <EntityChip kind="person">Jane Smith</EntityChip>
      <EntityChip kind="place">London</EntityChip>
      <EntityChip kind="product">DataBridge</EntityChip>
      <EntityChip kind="concept">Data Sovereignty</EntityChip>
      <EntityChip>Unknown kind</EntityChip>
    </div>
  ),
  parameters: { layout: "padded" },
};

/* ------------------------------------------------------------------ */
/* EntityCard (block)                                                   */
/* ------------------------------------------------------------------ */

export const EntityCardOrg: StoryObj = {
  name: "EntityCard / Organisation",
  render: () => (
    <EntityCard kind="org" name="Acme Corp">
      <p>
        Acme Corp is the primary vendor for the data integration layer. Founded 2014, HQ Berlin.
      </p>
    </EntityCard>
  ),
  parameters: { layout: "padded" },
};

export const EntityCardPerson: StoryObj = {
  name: "EntityCard / Person",
  render: () => (
    <EntityCard kind="person" name="Jane Smith">
      <p>Jane Smith is the lead architect on the platform migration project.</p>
    </EntityCard>
  ),
  parameters: { layout: "padded" },
};

export const EntityCardNoBody: StoryObj = {
  name: "EntityCard / No body",
  render: () => <EntityCard kind="product" name="DataBridge SDK" />,
  parameters: { layout: "padded" },
};

/* ------------------------------------------------------------------ */
/* KnowledgeCard                                                        */
/* ------------------------------------------------------------------ */

const resolve: KnowledgeSourceResolver = (path) => {
  const map: Record<string, { href: string; title: string }> = {
    "notes/adr-0012.md": { href: "#adr-0012", title: "ADR-0012: Caching strategy" },
    "notes/perf-report.md": { href: "#perf-report", title: "Q1 Performance Report" },
  };
  return map[path] ?? null;
};

export const KnowledgeCardResolved: StoryObj = {
  name: "KnowledgeCard / Resolved sources",
  render: () => (
    <KnowledgeCard sources="notes/adr-0012.md, notes/perf-report.md" resolve={resolve}>
      <p>
        The PostgreSQL materialized-view approach reduces p95 query latency by 38% compared to the
        Redis cache measured in Q1 2026.
      </p>
    </KnowledgeCard>
  ),
  parameters: { layout: "padded" },
};

export const KnowledgeCardPartialResolve: StoryObj = {
  name: "KnowledgeCard / Partial resolve (one stale link)",
  render: () => (
    <KnowledgeCard
      sources="notes/adr-0012.md, notes/deleted-note.md, notes/perf-report.md"
      resolve={resolve}
    >
      <p>
        Stale links degrade to plain labels — the card never shows a broken anchor or throws an
        error.
      </p>
    </KnowledgeCard>
  ),
  parameters: { layout: "padded" },
};

export const KnowledgeCardNoResolve: StoryObj = {
  name: "KnowledgeCard / No resolver (all labels)",
  render: () => (
    <KnowledgeCard sources="notes/a.md, notes/b.md">
      <p>Without a resolver every source path renders as a plain label.</p>
    </KnowledgeCard>
  ),
  parameters: { layout: "padded" },
};

export const KnowledgeCardNoSources: StoryObj = {
  name: "KnowledgeCard / No sources",
  render: () => (
    <KnowledgeCard>
      <p>A knowledge card with no sources attribute — the footer is omitted entirely.</p>
    </KnowledgeCard>
  ),
  parameters: { layout: "padded" },
};

export const KnowledgeCardLongFact: StoryObj = {
  name: "KnowledgeCard / Long fact body",
  render: () => (
    <KnowledgeCard sources="notes/adr-0012.md" resolve={resolve}>
      <p>
        The decision to adopt PostgreSQL materialized views was driven by three factors: the
        operational simplicity of a single data store, the 38% latency reduction observed in Q1
        benchmarks, and the team&rsquo;s existing expertise with PostgreSQL query planning. The
        Redis alternative was estimated to add 1.5 FTE of operational overhead annually, which the
        engineering leadership deemed unacceptable given current headcount constraints.
      </p>
    </KnowledgeCard>
  ),
  parameters: { layout: "padded" },
};
