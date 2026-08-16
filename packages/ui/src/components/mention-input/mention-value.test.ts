import { describe, expect, it } from "vitest";
import {
  defaultMentionFilter,
  insertMention,
  mentionAt,
  mentionEnd,
  remapMentions,
  serializeMentions,
  type MentionOption,
  type MentionValue,
} from "./mention-value";

const ada: MentionOption = { id: "u1", label: "Ada Lovelace", keywords: ["ada", "math"] };
const grace: MentionOption = { id: "u2", label: "Grace Hopper" };

/** "Hi @Ada Lovelace how are you" with the mention recorded at offset 3. */
const oneMention: MentionValue = {
  text: "Hi @Ada Lovelace how are you",
  mentions: [{ id: "u1", label: "Ada Lovelace", start: 3 }],
};

/** "@Ada Lovelace and @Grace Hopper ship" — two mentions, at 0 and 18. */
const twoMentions: MentionValue = {
  text: "@Ada Lovelace and @Grace Hopper ship",
  mentions: [
    { id: "u1", label: "Ada Lovelace", start: 0 },
    { id: "u2", label: "Grace Hopper", start: 18 },
  ],
};

// ---------------------------------------------------------------------------
// T1 — remapMentions offset algebra
// ---------------------------------------------------------------------------

describe("T1 remapMentions — offset algebra", () => {
  it("is idempotent when the text is unchanged", () => {
    expect(remapMentions(oneMention, oneMention.text)).toEqual(oneMention.mentions);
  });

  it("shifts a mention when text is inserted BEFORE it", () => {
    // "Hi " -> "Oh Hi " (3 chars inserted at 0)
    const next = "Oh Hi @Ada Lovelace how are you";
    expect(remapMentions(oneMention, next)).toEqual([
      { id: "u1", label: "Ada Lovelace", start: 6 },
    ]);
  });

  it("holds the offset when text is inserted AFTER it", () => {
    const next = "Hi @Ada Lovelace how are you today";
    expect(remapMentions(oneMention, next)).toEqual([
      { id: "u1", label: "Ada Lovelace", start: 3 },
    ]);
  });

  it("holds the first and shifts the second when text is inserted BETWEEN them", () => {
    const next = "@Ada Lovelace and also @Grace Hopper ship";
    expect(remapMentions(twoMentions, next)).toEqual([
      { id: "u1", label: "Ada Lovelace", start: 0 },
      { id: "u2", label: "Grace Hopper", start: 23 },
    ]);
  });

  it("shifts every mention when text is removed before both", () => {
    // Drop the leading "Hi " from a two-mention value.
    const prev: MentionValue = {
      text: "Hi @Ada Lovelace and @Grace Hopper",
      mentions: [
        { id: "u1", label: "Ada Lovelace", start: 3 },
        { id: "u2", label: "Grace Hopper", start: 21 },
      ],
    };
    expect(remapMentions(prev, "@Ada Lovelace and @Grace Hopper")).toEqual([
      { id: "u1", label: "Ada Lovelace", start: 0 },
      { id: "u2", label: "Grace Hopper", start: 18 },
    ]);
  });

  it("DROPS a mention when the edit intersects its range", () => {
    // Delete one character out of the middle of "@Ada Lovelace".
    const next = "Hi @Ada Loveace how are you";
    expect(remapMentions(oneMention, next)).toEqual([]);
  });

  it("DROPS a mention when a character is inserted inside its range", () => {
    const next = "Hi @Adda Lovelace how are you";
    expect(remapMentions(oneMention, next)).toEqual([]);
  });

  it("keeps a mention when a character is inserted flush against its end", () => {
    const next = "Hi @Ada Lovelace! how are you";
    expect(remapMentions(oneMention, next)).toEqual([
      { id: "u1", label: "Ada Lovelace", start: 3 },
    ]);
  });

  it("survives a multi-mention paste that replaces a middle span", () => {
    // Replace " and " (between the two mentions) with " plus ".
    const next = "@Ada Lovelace plus @Grace Hopper ship";
    expect(remapMentions(twoMentions, next)).toEqual([
      { id: "u1", label: "Ada Lovelace", start: 0 },
      { id: "u2", label: "Grace Hopper", start: 19 },
    ]);
  });

  it("drops every mention when the whole text is replaced", () => {
    expect(remapMentions(twoMentions, "totally different text")).toEqual([]);
  });

  it("re-validates survivors against the new text (a shifted offset that no longer spells the token is dropped)", () => {
    // A hand-crafted value whose recorded offset is a lie: re-validation must
    // reject it rather than trusting the arithmetic.
    const lying: MentionValue = {
      text: "Hi @Ada Lovelace",
      mentions: [{ id: "u1", label: "Grace Hopper", start: 3 }],
    };
    expect(remapMentions(lying, "Hi! @Ada Lovelace")).toEqual([]);
  });

  it("honours a non-default trigger character", () => {
    const hash: MentionValue = {
      text: "see #Roadmap now",
      mentions: [{ id: "t1", label: "Roadmap", start: 4 }],
    };
    expect(remapMentions(hash, "please see #Roadmap now", "#")).toEqual([
      { id: "t1", label: "Roadmap", start: 11 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// T2 — serializeMentions shape
// ---------------------------------------------------------------------------

describe("T2 serializeMentions — the consumer contract", () => {
  it("returns { text, mentionedIds }", () => {
    expect(serializeMentions(twoMentions)).toEqual({
      text: "@Ada Lovelace and @Grace Hopper ship",
      mentionedIds: ["u1", "u2"],
    });
  });

  it("returns an empty id list for a mention-free value", () => {
    expect(serializeMentions({ text: "just words", mentions: [] })).toEqual({
      text: "just words",
      mentionedIds: [],
    });
  });

  it("dedupes ids — two mentions of the same person yield one id", () => {
    const twice: MentionValue = {
      text: "@Ada Lovelace and @Ada Lovelace",
      mentions: [
        { id: "u1", label: "Ada Lovelace", start: 0 },
        { id: "u1", label: "Ada Lovelace", start: 18 },
      ],
    };
    expect(serializeMentions(twice).mentionedIds).toEqual(["u1"]);
  });

  it("emits ids in DOCUMENT order, not insertion order", () => {
    const outOfOrder: MentionValue = {
      text: "@Ada Lovelace and @Grace Hopper",
      mentions: [
        { id: "u2", label: "Grace Hopper", start: 18 },
        { id: "u1", label: "Ada Lovelace", start: 0 },
      ],
    };
    expect(serializeMentions(outOfOrder).mentionedIds).toEqual(["u1", "u2"]);
  });
});

// ---------------------------------------------------------------------------
// insertMention
// ---------------------------------------------------------------------------

describe("insertMention", () => {
  it("replaces trigger+query with trigger+label+space and reports the caret after the space", () => {
    const value: MentionValue = { text: "Hi @ad", mentions: [] };
    const result = insertMention(value, ada, "@", 3, 6);
    expect(result.value.text).toBe("Hi @Ada Lovelace ");
    expect(result.value.mentions).toEqual([{ id: "u1", label: "Ada Lovelace", start: 3 }]);
    expect(result.caret).toBe(17);
  });

  it("keeps text that follows the caret and shifts later mentions", () => {
    const value: MentionValue = {
      text: "@gr ping @Ada Lovelace",
      mentions: [{ id: "u1", label: "Ada Lovelace", start: 9 }],
    };
    const result = insertMention(value, grace, "@", 0, 3);
    expect(result.value.text).toBe("@Grace Hopper  ping @Ada Lovelace");
    expect(result.value.mentions).toEqual([
      { id: "u2", label: "Grace Hopper", start: 0 },
      { id: "u1", label: "Ada Lovelace", start: 20 },
    ]);
  });

  it("records mentions sorted by document order", () => {
    const value: MentionValue = {
      text: "@Grace Hopper @ad",
      mentions: [{ id: "u2", label: "Grace Hopper", start: 0 }],
    };
    const result = insertMention(value, ada, "@", 14, 17);
    expect(result.value.mentions.map((m) => m.id)).toEqual(["u2", "u1"]);
  });
});

// ---------------------------------------------------------------------------
// mentionAt / mentionEnd — the basis for chip atomicity
// ---------------------------------------------------------------------------

describe("mentionAt / mentionEnd", () => {
  it("mentionEnd covers trigger + label", () => {
    expect(mentionEnd(oneMention.mentions[0]!, "@")).toBe(16);
  });

  it("finds the mention containing an index inside its range", () => {
    expect(mentionAt(oneMention, 3)?.id).toBe("u1");
    expect(mentionAt(oneMention, 10)?.id).toBe("u1");
    expect(mentionAt(oneMention, 15)?.id).toBe("u1");
  });

  it("treats the range as half-open — the end offset is OUTSIDE", () => {
    expect(mentionAt(oneMention, 16)).toBeUndefined();
    expect(mentionAt(oneMention, 2)).toBeUndefined();
  });

  it("returns undefined for a mention-free value", () => {
    expect(mentionAt({ text: "nothing here", mentions: [] }, 4)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// defaultMentionFilter
// ---------------------------------------------------------------------------

describe("defaultMentionFilter", () => {
  it("matches everything on an empty query", () => {
    expect(defaultMentionFilter(ada, "")).toBe(true);
    expect(defaultMentionFilter(grace, "")).toBe(true);
  });

  it("matches the label case-insensitively, as a substring", () => {
    expect(defaultMentionFilter(ada, "love")).toBe(true);
    expect(defaultMentionFilter(ada, "ADA")).toBe(true);
    expect(defaultMentionFilter(ada, "zz")).toBe(false);
  });

  it("matches extra keywords", () => {
    expect(defaultMentionFilter(ada, "math")).toBe(true);
    expect(defaultMentionFilter(grace, "math")).toBe(false);
  });
});
