import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DecisionCard } from "./decision-card";
import { EntityCard, EntityChip } from "./entity";
import { KnowledgeCard, type KnowledgeSourceResolver } from "./knowledge-card";

/* ------------------------------------------------------------------ */
/* DecisionCard                                                         */
/* ------------------------------------------------------------------ */

describe("DecisionCard", () => {
  it("renders the status badge and date", () => {
    render(
      <DecisionCard status="accepted" date="2026-06-15">
        <p>We chose PostgreSQL.</p>
      </DecisionCard>,
    );
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("2026-06-15")).toBeInTheDocument();
  });

  it("renders the rationale body (children)", () => {
    render(
      <DecisionCard status="accepted">
        <p>We chose PostgreSQL.</p>
      </DecisionCard>,
    );
    expect(screen.getByText("We chose PostgreSQL.")).toBeInTheDocument();
  });

  it("renders the alternatives section from the comma-separated attribute", () => {
    render(
      <DecisionCard status="accepted" alternatives="Redis, SQLite, DynamoDB">
        <p>body</p>
      </DecisionCard>,
    );
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("SQLite")).toBeInTheDocument();
    expect(screen.getByText("DynamoDB")).toBeInTheDocument();
  });

  it("omits the alternatives section when not provided", () => {
    render(<DecisionCard status="accepted">body</DecisionCard>);
    expect(screen.queryByText("Alternatives considered")).toBeNull();
  });

  it("degrades an unrecognised status to 'proposed'", () => {
    render(<DecisionCard status="in-review">body</DecisionCard>);
    expect(screen.getByText("Proposed")).toBeInTheDocument();
  });

  it("has an accessible section label derived from the status", () => {
    render(<DecisionCard status="rejected">body</DecisionCard>);
    expect(screen.getByRole("region", { name: /Decision: Rejected/i })).toBeInTheDocument();
  });

  it("renders without children (header-only layout)", () => {
    render(<DecisionCard status="accepted" date="2026-06-01" />);
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* EntityChip                                                           */
/* ------------------------------------------------------------------ */

describe("EntityChip", () => {
  it("renders the label text", () => {
    render(<EntityChip kind="org">Acme Corp</EntityChip>);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("carries an aria-label that names the entity and its kind", () => {
    render(<EntityChip kind="org">Acme Corp</EntityChip>);
    expect(screen.getByRole("mark", { name: /Acme Corp \(Organisation\)/i })).toBeInTheDocument();
  });

  it("is a <span> (inline element — valid inside <p>)", () => {
    const { container } = render(
      <p>
        Text <EntityChip kind="person">Jane</EntityChip> here
      </p>,
    );
    const chip = container.querySelector("span[role='mark']");
    expect(chip).not.toBeNull();
    expect(chip?.closest("p")).not.toBeNull();
  });

  it("renders all five known kinds without errors", () => {
    const kinds = ["org", "person", "place", "product", "concept"] as const;
    for (const kind of kinds) {
      render(<EntityChip kind={kind}>{kind}</EntityChip>);
      expect(screen.getAllByText(kind).length).toBeGreaterThan(0);
    }
  });

  it("gracefully renders an unknown kind without throwing", () => {
    render(<EntityChip kind="unknown-kind">X</EntityChip>);
    expect(screen.getByText("X")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* EntityCard                                                           */
/* ------------------------------------------------------------------ */

describe("EntityCard", () => {
  it("renders the entity name and kind label", () => {
    render(<EntityCard kind="org" name="Acme Corp" />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Organisation")).toBeInTheDocument();
  });

  it("renders the description body", () => {
    render(
      <EntityCard kind="person" name="Jane">
        <p>Lead architect.</p>
      </EntityCard>,
    );
    expect(screen.getByText("Lead architect.")).toBeInTheDocument();
  });

  it("has an accessible section label naming kind and entity", () => {
    render(<EntityCard kind="org" name="Acme Corp" />);
    expect(screen.getByRole("region", { name: /Organisation: Acme Corp/i })).toBeInTheDocument();
  });

  it("renders without a name (kind-only card)", () => {
    render(<EntityCard kind="concept" />);
    expect(screen.getByText("Concept")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* KnowledgeCard                                                        */
/* ------------------------------------------------------------------ */

describe("KnowledgeCard", () => {
  const resolve: KnowledgeSourceResolver = (path) => {
    if (path === "notes/a.md") return { href: "/notes/a", title: "Note A" };
    return null;
  };

  it("renders the fact body", () => {
    render(
      <KnowledgeCard>
        <p>PostgreSQL reduced p95 latency by 38%.</p>
      </KnowledgeCard>,
    );
    expect(screen.getByText("PostgreSQL reduced p95 latency by 38%.")).toBeInTheDocument();
  });

  it("renders a resolved source as a link with its title", () => {
    render(
      <KnowledgeCard sources="notes/a.md" resolve={resolve}>
        <p>fact</p>
      </KnowledgeCard>,
    );
    const link = screen.getByRole("link", { name: /Source: Note A/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/notes/a");
  });

  it("renders an unresolved source as a plain label (no link)", () => {
    render(
      <KnowledgeCard sources="notes/missing.md" resolve={resolve}>
        <p>fact</p>
      </KnowledgeCard>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("notes/missing.md")).toBeInTheDocument();
  });

  it("renders mixed resolved/unresolved sources without errors", () => {
    render(
      <KnowledgeCard sources="notes/a.md, notes/missing.md" resolve={resolve}>
        <p>fact</p>
      </KnowledgeCard>,
    );
    expect(screen.getByRole("link", { name: /Note A/i })).toBeInTheDocument();
    expect(screen.getByText("notes/missing.md")).toBeInTheDocument();
  });

  it("omits the sources section when no sources attribute is provided", () => {
    render(<KnowledgeCard>fact</KnowledgeCard>);
    expect(screen.queryByText("Sources")).toBeNull();
  });

  it("works without a resolver (all sources as plain labels)", () => {
    render(
      <KnowledgeCard sources="notes/a.md, notes/b.md">
        <p>fact</p>
      </KnowledgeCard>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("notes/a.md")).toBeInTheDocument();
    expect(screen.getByText("notes/b.md")).toBeInTheDocument();
  });

  it("has an accessible section label", () => {
    render(<KnowledgeCard>fact</KnowledgeCard>);
    expect(screen.getByRole("region", { name: /Knowledge fact/i })).toBeInTheDocument();
  });
});
