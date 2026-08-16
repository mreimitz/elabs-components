// KaTeX styling — consumers must import this once at their app entry. The story
// imports it so the `Math` stories render correctly in Storybook.
import "katex/dist/katex.min.css";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { MarkdownPreview } from "./markdown-preview";
import type { CitationData } from "../markdown-academic/citations";

const meta = {
  title: "Editor/MarkdownPreview/Academic",
  component: MarkdownPreview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The opt-in **academic layer** for `MarkdownPreview`: branded footnotes " +
          "(`footnotes`), `$…$` / `$$…$$` math via KaTeX (`math`), Pandoc / Better-BibTeX " +
          "citations + a generated bibliography (`resolveCitation`), and a generated `::toc` " +
          "(`toc`). The BibTeX/CSL database, the math engine, and CSL formatting stay in the " +
          "app — the library renders. Math requires the consumer to load KaTeX CSS once " +
          '(`import "katex/dist/katex.min.css"`).',
      },
    },
  },
} satisfies Meta<typeof MarkdownPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ------------------------------------------------------------------ */
/* A small in-app citation database (would be BibTeX/CSL in real apps). */
/* ------------------------------------------------------------------ */
const CITES: Record<string, CitationData> = {
  knuth1984: {
    author: "Knuth",
    year: 1984,
    title: "Literate Programming",
    container: "The Computer Journal",
    doi: "10.1093/comjnl/27.2.97",
  },
  dijkstra1968: {
    author: "Dijkstra",
    year: 1968,
    title: "Go To Statement Considered Harmful",
    container: "Communications of the ACM",
    url: "https://dl.acm.org/doi/10.1145/362929.362947",
  },
  turing1936: {
    author: "Turing",
    year: 1936,
    title: "On Computable Numbers",
    container: "Proc. London Math. Soc.",
  },
};
const resolveCitation = (key: string): CitationData | null => CITES[key] ?? null;

export const Footnotes: Story = {
  args: {
    footnotes: true,
    children: `# Field notes

The estate ran on nine legacy dashboards.[^scope] Consolidation cut that to one.[^win]

Both numbers were verified against the warehouse before sign-off.[^scope]

[^scope]: Counted from the migration manifest — see the [scope sheet](https://example.com/scope).
[^win]: Post-launch audit, 2026-Q1.`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("region", { name: "Footnotes" }, { timeout: 8000 }),
    ).toBeVisible();
  },
};

export const Math: Story = {
  args: {
    math: true,
    children: `# Cost model

The unit cost is $c = \\frac{f + v\\,n}{n}$, fixed cost $f$ amortized over $n$ runs.

Total spend over the window:

$$
S = \\sum_{i=1}^{N} c_i n_i = f N + v \\sum_{i=1}^{N} n_i
$$

So the marginal cost approaches $v$ as $n \\to \\infty$.`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Cost model" }, { timeout: 8000 });
    await expect(canvasElement.querySelectorAll('[role="math"]').length).toBeGreaterThan(0);
  },
};

export const CitationsNumeric: Story = {
  name: "Citations — numeric + bibliography",
  args: {
    resolveCitation,
    children: `# Related work

Literate programming [@knuth1984] reframed source as exposition, building on the
structured-programming turn [@dijkstra1968]. The theoretical floor was set decades
earlier [@turing1936, p. 230]. See also [@knuth1984; @dijkstra1968].

::bibliography`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("region", { name: "References" }, { timeout: 8000 }),
    ).toBeVisible();
  },
};

export const CitationsAuthorYear: Story = {
  name: "Citations — author-year",
  args: {
    resolveCitation,
    citationStyle: "author-year",
    children: `Knuth's literate programming [@knuth1984] inverts the usual order — see also
the earlier argument [-@dijkstra1968] for structure.

::references`,
  },
};

export const TableOfContents: Story = {
  name: "Generated TOC",
  args: {
    toc: true,
    children: `::toc

# Architecture

Overview prose.

## Data layer

How storage works.

## Service layer

How services compose.

# Operations

### Monitoring

Dashboards and alerts.`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = await canvas.findByRole("navigation", { name: "Contents" }, { timeout: 8000 });
    await expect(within(nav).getAllByRole("link").length).toBeGreaterThan(1);
  },
};

/**
 * Everything together — the shape of a short research note: a TOC, inline math,
 * a footnote, citations, and a generated bibliography in one document.
 */
export const AcademicPaper: Story = {
  args: {
    footnotes: true,
    math: true,
    toc: true,
    resolveCitation,
    children: `::toc

# Amortizing fixed cost

We model per-run cost as $c = \\frac{f + v n}{n}$, following the structured-cost
argument [@dijkstra1968].[^model] As $n \\to \\infty$, $c \\to v$.

$$
S = f N + v \\sum_{i=1}^{N} n_i
$$

## Prior art

Literate exposition of such models traces to Knuth [@knuth1984].

::bibliography

[^model]: Fixed cost $f$ is treated as constant across the window.`,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("navigation", { name: "Contents" }, { timeout: 8000 }),
    ).toBeVisible();
    await expect(canvas.getByRole("region", { name: "References" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Footnotes" })).toBeVisible();
  },
};
