/**
 * Unit tests for the shared slugify helpers (#273).
 *
 * The key invariant: slugifyHeading + uniqueSlug must produce IDENTICAL ids to
 * parseMarkdownOutline so that scrollToHeading(slug) finds the right ProseMirror
 * node when called with an id from the outline.
 */
import { describe, expect, test } from "vitest";

import { parseMarkdownOutline } from "../../markdown-outline/markdown-outline";
import { plainText, slugifyHeading, uniqueSlug } from "./slugify";

// ---------------------------------------------------------------------------
// plainText
// ---------------------------------------------------------------------------

describe("plainText", () => {
  test("strips inline code backticks", () => {
    expect(plainText("`foo`")).toBe("foo");
  });

  test("strips links, keeps text", () => {
    expect(plainText("[My Section](https://example.com)")).toBe("My Section");
  });

  test("strips images, keeps alt", () => {
    expect(plainText("![alt text](img.png)")).toBe("alt text");
  });

  test("strips bold/italic markers", () => {
    expect(plainText("**bold** and _italic_")).toBe("bold and italic");
  });

  test("trims surrounding whitespace", () => {
    expect(plainText("  hello  ")).toBe("hello");
  });
});

// ---------------------------------------------------------------------------
// slugifyHeading
// ---------------------------------------------------------------------------

describe("slugifyHeading", () => {
  test("lowercases and replaces spaces with hyphens", () => {
    expect(slugifyHeading("Hello World")).toBe("hello-world");
  });

  test("strips punctuation that is not letter/number/hyphen", () => {
    expect(slugifyHeading("Hello, World!")).toBe("hello-world");
  });

  test("preserves hyphens", () => {
    expect(slugifyHeading("step-by-step")).toBe("step-by-step");
  });

  test("falls back to 'section' for empty text", () => {
    expect(slugifyHeading("")).toBe("section");
    expect(slugifyHeading("!!!")).toBe("section");
  });

  test("handles unicode letters", () => {
    // Unicode letter characters should be kept
    const slug = slugifyHeading("Über die Änderungen");
    expect(slug).toContain("ber");
  });
});

// ---------------------------------------------------------------------------
// uniqueSlug — deduplication
// ---------------------------------------------------------------------------

describe("uniqueSlug", () => {
  test("first occurrence is the bare slug", () => {
    const used = new Map<string, number>();
    expect(uniqueSlug("intro", used)).toBe("intro");
  });

  test("second occurrence gets -1 suffix", () => {
    const used = new Map<string, number>();
    uniqueSlug("intro", used);
    expect(uniqueSlug("intro", used)).toBe("intro-1");
  });

  test("third occurrence gets -2 suffix", () => {
    const used = new Map<string, number>();
    uniqueSlug("intro", used);
    uniqueSlug("intro", used);
    expect(uniqueSlug("intro", used)).toBe("intro-2");
  });

  test("different base slugs dedupe independently", () => {
    const used = new Map<string, number>();
    expect(uniqueSlug("a", used)).toBe("a");
    expect(uniqueSlug("b", used)).toBe("b");
    expect(uniqueSlug("a", used)).toBe("a-1");
    expect(uniqueSlug("b", used)).toBe("b-1");
  });
});

// ---------------------------------------------------------------------------
// Invariant: slugifyHeading + uniqueSlug == parseMarkdownOutline ids
// ---------------------------------------------------------------------------

describe("slug invariant — shared helpers match parseMarkdownOutline ids", () => {
  /**
   * Simulate exactly what parseMarkdownOutline does, using the shared helpers.
   * Must produce identical id sequences.
   */
  function simulateSlugs(headingTexts: string[]): string[] {
    const used = new Map<string, number>();
    return headingTexts.map((text) => uniqueSlug(slugifyHeading(plainText(text)), used));
  }

  test("unique headings produce matching slugs", () => {
    const markdown = `# Introduction\n\n## Getting Started\n\n### Advanced Usage\n`;
    const outline = parseMarkdownOutline(markdown);
    const simulated = simulateSlugs(["Introduction", "Getting Started", "Advanced Usage"]);
    expect(outline.map((i) => i.id)).toEqual(simulated);
  });

  test("duplicate headings get -1, -2 suffixes in both paths", () => {
    const markdown = `# Methods\n\n## Methods\n\n### Methods\n`;
    const outline = parseMarkdownOutline(markdown);
    const simulated = simulateSlugs(["Methods", "Methods", "Methods"]);
    expect(outline.map((i) => i.id)).toEqual(simulated);
    expect(outline[0]!.id).toBe("methods");
    expect(outline[1]!.id).toBe("methods-1");
    expect(outline[2]!.id).toBe("methods-2");
  });

  test("inline-markdown decorated headings produce matching slugs", () => {
    // parseMarkdownOutline strips inline markdown from the heading text
    const markdown = `# **Bold** Heading\n\n## [Link](https://example.com) Heading\n`;
    const outline = parseMarkdownOutline(markdown);
    const simulated = simulateSlugs(["**Bold** Heading", "[Link](https://example.com) Heading"]);
    expect(outline.map((i) => i.id)).toEqual(simulated);
  });

  test("headings inside fenced code blocks are ignored", () => {
    const markdown = `# Real\n\n\`\`\`\n# Not a heading\n\`\`\`\n\n## Also Real\n`;
    const outline = parseMarkdownOutline(markdown);
    expect(outline).toHaveLength(2);
    expect(outline[0]!.id).toBe("real");
    expect(outline[1]!.id).toBe("also-real");
  });

  test("frontmatter headings are excluded, stripped-line coordinates are correct", () => {
    const markdown = `---\ntitle: Doc\n---\n\n# First\n\n## Second\n`;
    const outline = parseMarkdownOutline(markdown);
    // 3 lines frontmatter (---\ntitle\n---) + blank = offset 4
    // But parseMarkdownOutline operates on the stripped body, so lines start at 1
    expect(outline[0]!.id).toBe("first");
    expect(outline[1]!.id).toBe("second");
    expect(outline[0]!.line).toBe(2); // blank line 1, heading line 2 in stripped body
  });
});
