import { describe, expect, it } from "vitest";
import { defaultSlashCommandFilter, stepIndex, type SlashCommand } from "./slash-command";

describe("defaultSlashCommandFilter", () => {
  const command: SlashCommand = { name: "help", keywords: ["support", "docs"] };

  it("matches everything on an empty query", () => {
    expect(defaultSlashCommandFilter(command, "")).toBe(true);
  });

  it("matches a case-insensitive prefix of the name", () => {
    expect(defaultSlashCommandFilter(command, "HEL")).toBe(true);
  });

  it("does not match a substring that is not a prefix", () => {
    expect(defaultSlashCommandFilter(command, "elp")).toBe(false);
  });

  it("falls back to a prefix match on a keyword", () => {
    expect(defaultSlashCommandFilter(command, "doc")).toBe(true);
  });

  it("rejects a query matching neither the name nor a keyword", () => {
    expect(defaultSlashCommandFilter(command, "deploy")).toBe(false);
  });
});

describe("stepIndex", () => {
  it("returns -1 for an empty list", () => {
    expect(stepIndex(0, 0, 1)).toBe(-1);
  });

  it("moves forward by one", () => {
    expect(stepIndex(3, 0, 1)).toBe(1);
  });

  it("wraps forward past the end", () => {
    expect(stepIndex(3, 2, 1)).toBe(0);
  });

  it("wraps backward past the start", () => {
    expect(stepIndex(3, 0, -1)).toBe(2);
  });
});
