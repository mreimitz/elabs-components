import { describe, expect, it } from "vitest";

import { FILE_CATEGORY_ICONS, fileIconFor } from "./file-icon";
import type { FileCategory } from "./file-kind";

const CATEGORIES: FileCategory[] = [
  "image",
  "video",
  "audio",
  "document",
  "spreadsheet",
  "presentation",
  "code",
  "text",
  "data",
  "archive",
  "unknown",
];

describe("FILE_CATEGORY_ICONS", () => {
  it("covers every category", () => {
    for (const category of CATEGORIES) {
      expect(FILE_CATEGORY_ICONS[category], category).toBeDefined();
    }
    expect(Object.keys(FILE_CATEGORY_ICONS).sort()).toEqual([...CATEGORIES].sort());
  });

  it("gives each category a distinct glyph, so the icon is a real second channel", () => {
    const glyphs = new Set(Object.values(FILE_CATEGORY_ICONS));
    expect(glyphs.size).toBe(CATEGORIES.length);
  });
});

describe("fileIconFor", () => {
  it("resolves through the file kind", () => {
    expect(fileIconFor("a.png")).toBe(FILE_CATEGORY_ICONS.image);
    expect(fileIconFor("a.xlsx")).toBe(FILE_CATEGORY_ICONS.spreadsheet);
    expect(fileIconFor("download", "video/mp4")).toBe(FILE_CATEGORY_ICONS.video);
  });

  it("falls back to the generic glyph rather than throwing", () => {
    expect(fileIconFor("mystery.wat")).toBe(FILE_CATEGORY_ICONS.unknown);
    expect(fileIconFor("")).toBe(FILE_CATEGORY_ICONS.unknown);
  });
});
