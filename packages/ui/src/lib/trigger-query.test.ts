import { describe, expect, it } from "vitest";
import { findTriggerQuery, replaceTriggerRun } from "./trigger-query";

describe("findTriggerQuery — word boundary (default)", () => {
  it("finds a trigger + query run under the caret", () => {
    const text = "Hi @ada";
    expect(findTriggerQuery(text, text.length, "@")).toEqual({ start: 3, query: "ada" });
  });

  it("returns null when there is no trigger before the caret", () => {
    expect(findTriggerQuery("hello", 5, "@")).toBeNull();
  });

  it("returns null when the run contains whitespace (the query already closed)", () => {
    const text = "Hi @ada lovelace";
    expect(findTriggerQuery(text, text.length, "@")).toBeNull();
  });

  it("returns null when the trigger is not at a word boundary (inside a token)", () => {
    const text = "ping ada@example.com";
    const at = text.indexOf("@");
    expect(findTriggerQuery(text, at + 1, "@")).toBeNull();
  });

  it("allows the trigger at index 0", () => {
    expect(findTriggerQuery("@ada", 4, "@")).toEqual({ start: 0, query: "ada" });
  });

  it("allows the trigger right after '(' or '['", () => {
    expect(findTriggerQuery("see (@ada", 9, "@")).toEqual({ start: 5, query: "ada" });
    expect(findTriggerQuery("see [@ada", 9, "@")).toEqual({ start: 5, query: "ada" });
  });

  it("supports a multi-character trigger", () => {
    const text = "run ::deploy";
    expect(findTriggerQuery(text, text.length, "::")).toEqual({ start: 4, query: "deploy" });
  });
});

describe("findTriggerQuery — line-start boundary", () => {
  it("opens a query at the start of a line", () => {
    const text = "/help";
    expect(findTriggerQuery(text, text.length, "/", { boundary: "line-start" })).toEqual({
      start: 0,
      query: "help",
    });
  });

  it("opens a query right after a newline", () => {
    const text = "first line\n/help";
    expect(findTriggerQuery(text, text.length, "/", { boundary: "line-start" })).toEqual({
      start: 11,
      query: "help",
    });
  });

  it("does not open mid-line, even at a word boundary the 'word' boundary would accept", () => {
    const text = "cd /usr";
    expect(findTriggerQuery(text, text.length, "/", { boundary: "line-start" })).toBeNull();
  });
});

describe("findTriggerQuery — isTriggerConsumed veto", () => {
  it("returns null when the candidate trigger has already been consumed", () => {
    const text = "Hi @ada";
    const result = findTriggerQuery(text, text.length, "@", {
      isTriggerConsumed: (start) => start === 3,
    });
    expect(result).toBeNull();
  });

  it("returns the candidate when isTriggerConsumed reports false", () => {
    const text = "Hi @ada";
    const result = findTriggerQuery(text, text.length, "@", {
      isTriggerConsumed: () => false,
    });
    expect(result).toEqual({ start: 3, query: "ada" });
  });
});

describe("replaceTriggerRun", () => {
  it("splices the insert text over the trigger + query run", () => {
    const text = "Hi @ada how are you";
    const result = replaceTriggerRun(text, 3, 7, "@Ada Lovelace ");
    expect(result.text).toBe("Hi @Ada Lovelace  how are you");
    expect(result.caret).toBe(3 + "@Ada Lovelace ".length);
  });

  it("places the caret immediately after the inserted text", () => {
    const result = replaceTriggerRun("/help", 0, 5, "/deploy ");
    expect(result.text).toBe("/deploy ");
    expect(result.caret).toBe("/deploy ".length);
  });
});
