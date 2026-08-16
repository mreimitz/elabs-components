import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { cn } from "../../lib/cn";
import { PROSE_HEADING_REM, ProseHeading } from "./prose";
import { Heading, TEXT_ROLE_REM, Text } from "./typography";

afterEach(cleanup);

describe("Text", () => {
  it("maps variants to type roles (kpi bundles tabular-nums, code bundles mono)", () => {
    render(
      <>
        <Text>body</Text>
        <Text variant="kpi">42</Text>
        <Text variant="code">cn()</Text>
        <Text variant="lead">lead</Text>
      </>,
    );
    expect(screen.getByText("body")).toHaveClass("text-body", "text-foreground");
    expect(screen.getByText("42")).toHaveClass("text-kpi", "tabular-nums");
    expect(screen.getByText("cn()")).toHaveClass("text-code", "font-mono");
    // lead == the subtitle rung at body weight (research 07 §B.3).
    expect(screen.getByText("lead")).toHaveClass("text-subtitle", "font-normal");
  });

  it("applies tone and renders as p / span / asChild", () => {
    render(
      <>
        <Text tone="muted">muted</Text>
        <Text as="span" data-testid="span-text">
          span
        </Text>
        <Text asChild>
          <em>emphasized</em>
        </Text>
      </>,
    );
    expect(screen.getByText("muted")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("muted").tagName).toBe("P");
    expect(screen.getByTestId("span-text").tagName).toBe("SPAN");
    expect(screen.getByText("emphasized").tagName).toBe("EM");
    expect(screen.getByText("emphasized")).toHaveClass("text-body");
  });

  it("merges className last (a caller's role wins over the variant's)", () => {
    render(<Text className="text-title">override</Text>);
    const el = screen.getByText("override");
    expect(el).toHaveClass("text-title");
    expect(el).not.toHaveClass("text-body");
  });
});

describe("Heading", () => {
  it("derives the tag and the default size from level (1→display, 2-3→title, 4-6→subtitle)", () => {
    render(
      <>
        <Heading level={1}>one</Heading>
        <Heading level={3}>three</Heading>
        <Heading level={5}>five</Heading>
      </>,
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.tagName).toBe("H1");
    expect(h1).toHaveClass("text-display", "font-display", "text-balance");
    const h3 = screen.getByRole("heading", { level: 3 });
    expect(h3.tagName).toBe("H3");
    expect(h3).toHaveClass("text-title");
    const h5 = screen.getByRole("heading", { level: 5 });
    expect(h5.tagName).toBe("H5");
    expect(h5).toHaveClass("text-subtitle");
  });

  it("size overrides the visual rung while keeping the tag", () => {
    render(
      <Heading level={2} size="subtitle">
        small h2
      </Heading>,
    );
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.tagName).toBe("H2");
    expect(h2).toHaveClass("text-subtitle");
    expect(h2).not.toHaveClass("text-title");
  });

  it("supports asChild (the child element becomes the heading root)", () => {
    render(
      <Heading level={2} asChild>
        <a href="#section">linked heading</a>
      </Heading>,
    );
    const a = screen.getByRole("link", { name: "linked heading" });
    expect(a).toHaveClass("text-title");
  });
});

describe("cn() role merging (lib/cn extension)", () => {
  it("keeps a role alongside a text color, and lets later role/raw sizes win", () => {
    // Without the font-size registration tailwind-merge classifies text-<role>
    // as a COLOR and `text-foreground` would silently drop `text-kpi`.
    expect(cn("text-kpi", "tabular-nums", "text-foreground")).toBe(
      "text-kpi tabular-nums text-foreground",
    );
    expect(cn("text-body", "text-title")).toBe("text-title");
    expect(cn("text-sm", "text-body")).toBe("text-body");
  });
});

describe("type-role rems (drift guards)", () => {
  it("TEXT_ROLE_REM mirrors the --text-<role> tokens in themes.css", () => {
    // vitest runs with cwd = packages/ui.
    const css = readFileSync(resolve(process.cwd(), "../tokens/src/themes.css"), "utf8");
    for (const [role, rem] of Object.entries(TEXT_ROLE_REM)) {
      // Since #340 the rem LITERAL lives one layer down, in themes.css
      // § TYPE SCALE BASE, so the density dial can scale from it (density.css);
      // `--text-<role>` aliases it. Both halves are pinned here: the mirror must
      // track the literal, AND the role must still resolve to that literal —
      // a role re-inlined or re-pointed elsewhere would silently detach the
      // runtime mirror @qlik-coe-emea/qlabs-components-editor's markdown scale reads.
      expect(css).toContain(`--type-size-${role}: ${rem}rem;`);
      expect(css).toContain(`--text-${role}: var(--type-size-${role});`);
    }
  });

  it("the prose reading scale keeps the canonical markdown rems (issue #18 contract)", () => {
    expect(PROSE_HEADING_REM).toEqual({ 1: 1.5, 2: 1.25, 3: 1.125, 4: 1, 5: 0.875, 6: 0.875 });
  });
});

describe("ProseHeading", () => {
  it("renders the heading element for the given level with the role class", () => {
    render(<ProseHeading level={4}>Doc title</ProseHeading>);
    const h = screen.getByRole("heading", { level: 4, name: "Doc title" });
    expect(h.tagName).toBe("H4");
    expect(h).toHaveClass("text-subtitle");
  });
});
