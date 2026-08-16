/**
 * Integration tests: ai-object directives wired into MarkdownPreview via
 * `extensions.directives`. Verifies the full parse → render pipeline for all
 * three directive types without forking the engine.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "../markdown-preview/markdown-preview";
import { aiObjectDirectives } from "./directives";
import type { KnowledgeSourceResolver } from "./knowledge-card";

afterEach(cleanup);

const resolve: KnowledgeSourceResolver = (path) => {
  if (path === "notes/a.md") return { href: "/notes/a", title: "Note A" };
  return null;
};

const extensions = { directives: aiObjectDirectives({ resolveKnowledge: resolve }) };

describe("MarkdownPreview + aiObjectDirectives — :::decision", () => {
  it("renders the status badge and rationale body", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`:::decision{status=accepted date=2026-06-15}\nWe chose PostgreSQL.\n:::`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Accepted")).toBeInTheDocument());
    expect(screen.getByText("We chose PostgreSQL.")).toBeInTheDocument();
    expect(screen.getByText("2026-06-15")).toBeInTheDocument();
  });

  it("renders alternatives from the attribute", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`:::decision{status=accepted alternatives="Redis, SQLite"}\nBody.\n:::`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Accepted")).toBeInTheDocument());
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("SQLite")).toBeInTheDocument();
  });

  it("degrades an unknown status to 'proposed' without errors", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`:::decision{status=unknown}\nBody.\n:::`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Proposed")).toBeInTheDocument());
    expect(screen.queryByText(/Unknown block/)).toBeNull();
  });
});

describe("MarkdownPreview + aiObjectDirectives — :::entity (block)", () => {
  it("renders the entity name and kind label", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`:::entity{kind=org name="Acme Corp"}\nPrimary vendor.\n:::`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    expect(screen.getByText("Organisation")).toBeInTheDocument();
    expect(screen.getByText("Primary vendor.")).toBeInTheDocument();
  });
});

describe("MarkdownPreview + aiObjectDirectives — :entity[…] (inline chip)", () => {
  it("renders the chip inside the paragraph text flow", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`Owner :entity[Acme]{kind=org} ships it.`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());
    // The chip must live inside a <p> — no block wrapper around it.
    const chip = screen.getByRole("mark", { name: /Acme \(Organisation\)/i });
    expect(chip).toBeInTheDocument();
    expect(chip.closest("p")).not.toBeNull();
  });

  it("renders an inline chip for an unknown kind without errors", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`See :entity[Widget]{kind=thing} for details.`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Widget")).toBeInTheDocument());
    expect(screen.queryByText(/Unknown block/)).toBeNull();
  });
});

describe("MarkdownPreview + aiObjectDirectives — :::knowledge", () => {
  it("renders the fact body and a resolved source link", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`:::knowledge{sources="notes/a.md"}\nPostgreSQL reduced latency by 38%.\n:::`}
      </MarkdownPreview>,
    );
    await waitFor(() =>
      expect(screen.getByText("PostgreSQL reduced latency by 38%.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: /Source: Note A/i })).toBeInTheDocument();
  });

  it("degrades an unresolved source to a plain label (no broken link)", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`:::knowledge{sources="notes/missing.md"}\nfact\n:::`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("fact")).toBeInTheDocument());
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("notes/missing.md")).toBeInTheDocument();
  });

  it("renders mixed resolved/unresolved sources without errors", async () => {
    render(
      <MarkdownPreview extensions={extensions}>
        {`:::knowledge{sources="notes/a.md, notes/missing.md"}\nfact\n:::`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("fact")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Note A/i })).toBeInTheDocument();
    expect(screen.getByText("notes/missing.md")).toBeInTheDocument();
  });
});
