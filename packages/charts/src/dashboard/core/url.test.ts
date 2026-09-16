import { describe, expect, it } from "vitest";

import {
  DASHBOARD_URL_STATE_MAX_LENGTH,
  decodeDashboardState,
  type DecodedState,
  encodeDashboardState,
} from "./url";

// Deterministic, dependency-free PRNG (mulberry32) — this is a *.test.ts file, so the
// `charts-honesty` rule's `Math.random` ban (stories in scope; tests exempt) does not apply;
// a seeded generator is still used so a failure reproduces from the printed seed.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNICODE_SAMPLES = ["EMEA", "Ünïcödé", "日本語", "R&D / Ops", "emoji 🎯", "a.b.c", "a:b"];
const FIELD_SAMPLES = ["Region", "Segment", "Prod.Line", "field:with:colons", "unicode 字段"];

function randomState(rng: () => number, index: number): DecodedState {
  const fieldCount = Math.floor(rng() * 3); // 0–2 fields
  const selection: Record<string, (string | number)[]> = {};
  for (let f = 0; f < fieldCount; f++) {
    const field = `${FIELD_SAMPLES[Math.floor(rng() * FIELD_SAMPLES.length)]}-${f}`;
    const valueCount = 1 + Math.floor(rng() * 3);
    const values: (string | number)[] = [];
    for (let v = 0; v < valueCount; v++) {
      if (rng() < 0.5) values.push(Math.round((rng() - 0.5) * 100000) / 10);
      else values.push(UNICODE_SAMPLES[Math.floor(rng() * UNICODE_SAMPLES.length)] as string);
    }
    selection[field] = values;
  }

  const variables: Record<string, string | number | boolean> = {};
  const varCount = Math.floor(rng() * 3);
  for (let v = 0; v < varCount; v++) {
    const name = `var${v}-${index}`;
    const roll = rng();
    if (roll < 0.25) variables[name] = Math.round((rng() - 0.5) * 100000) / 10;
    else if (roll < 0.5) variables[name] = rng() < 0.5;
    else if (roll < 0.75) {
      // an ISO-8601 date-only string (`VariableSpec.type === "date"`, analysis §5.1)
      const day = 1 + Math.floor(rng() * 27);
      const month = 1 + Math.floor(rng() * 12);
      variables[name] = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    } else variables[name] = UNICODE_SAMPLES[Math.floor(rng() * UNICODE_SAMPLES.length)] as string;
  }

  const state: DecodedState = { selection, variables };
  if (rng() < 0.3) state.bookmarkId = `bm-${index}`;
  if (rng() < 0.3) state.sheetId = `sheet-${index}`;
  return state;
}

describe("encodeDashboardState / decodeDashboardState", () => {
  it("round-trips the empty state", () => {
    const encoded = encodeDashboardState({});
    expect(encoded).toBe("v1");
    expect(decodeDashboardState(encoded)).toEqual({ selection: {}, variables: {} });
  });

  it("produces a deterministic, sorted-key string regardless of input key order", () => {
    const a = encodeDashboardState({
      selection: { Segment: ["Enterprise"], Region: ["EMEA", "APAC"] },
      variables: { threshold: 42, flag: true },
    });
    const b = encodeDashboardState({
      selection: { Region: ["EMEA", "APAC"], Segment: ["Enterprise"] },
      variables: { flag: true, threshold: 42 },
    });
    expect(a).toBe(b);
    expect(a).toBe(
      "v1;s.Region=s:EMEA|s:APAC;s.Segment=s:Enterprise;v.flag=b:true;v.threshold=n:42",
    );
  });

  it.each<[string, DecodedState]>([
    ["numbers and strings", { selection: { id: [1, 2, "3"] }, variables: {} }],
    ["unicode values", { selection: { region: ["日本語", "Ünïcödé", "emoji 🎯"] }, variables: {} }],
    ["a value containing dots and colons", { selection: { f: ["a.b.c", "a:b"] }, variables: {} }],
    [
      "typed variables",
      {
        selection: {},
        variables: { threshold: 42, enabled: true, asOf: "2026-09-16", label: "Q3 EMEA" },
      },
    ],
    [
      "bookmark and sheet ids",
      { selection: { Region: ["EMEA"] }, variables: {}, bookmarkId: "bm1", sheetId: "sheet-2" },
    ],
    ["a field name with a dot", { selection: { "Prod.Line": ["A"] }, variables: {} }],
  ])("round-trips a fixture: %s", (_name, fixture) => {
    const encoded = encodeDashboardState(fixture);
    expect(decodeDashboardState(encoded)).toEqual(fixture);
  });

  it("round-trips 200 seeded random states", () => {
    const rng = mulberry32(20260916);
    for (let i = 0; i < 200; i++) {
      const state = randomState(rng, i);
      const encoded = encodeDashboardState(state);
      const decoded = decodeDashboardState(encoded);
      expect(decoded, `seed 20260916, case ${i}: ${encoded}`).toEqual(state);
    }
  });

  it('decode("garbage") is null', () => {
    expect(decodeDashboardState("garbage")).toBeNull();
    expect(decodeDashboardState("")).toBeNull();
    expect(decodeDashboardState("v2;s.Region=s:EMEA")).toBeNull();
  });

  it("never throws on malformed percent-encoding", () => {
    expect(() => decodeDashboardState("v1;s.Region=s:%")).not.toThrow();
    expect(decodeDashboardState("v1;s.Region=s:%")).toEqual({ selection: {}, variables: {} });
  });

  it("ignores unknown segments (forward compatible)", () => {
    expect(decodeDashboardState("v1;x.future=1;s.Region=s:EMEA")).toEqual({
      selection: { Region: ["EMEA"] },
      variables: {},
    });
  });

  it("rejects a 9 kB string", () => {
    const huge = `v1;s.f=${"x".repeat(9 * 1024 - 7)}`;
    expect(huge.length).toBe(9 * 1024);
    expect(decodeDashboardState(huge)).toBeNull();
  });

  it(`enforces the ${DASHBOARD_URL_STATE_MAX_LENGTH}-byte guard exactly at the boundary`, () => {
    const filler = "a".repeat(DASHBOARD_URL_STATE_MAX_LENGTH - "v1;s.f=s:".length);
    const atLimit = `v1;s.f=s:${filler}`;
    expect(atLimit.length).toBe(DASHBOARD_URL_STATE_MAX_LENGTH);
    expect(decodeDashboardState(atLimit)).not.toBeNull();
    expect(decodeDashboardState(`${atLimit}x`)).toBeNull();
  });

  it("stays well under the size budget for a 40-tile sheet's worth of selections (5 fields)", () => {
    // A sheet with many tiles rarely drives more than a handful of *distinct* selected
    // fields at once (the tiles re-render off the same selection) — this is that shape:
    // 5 fields, 4 values each, realistic label lengths.
    const selection: Record<string, string[]> = {};
    for (let f = 0; f < 5; f++) selection[`Field${f}`] = ["North America", "EMEA", "APAC", "LATAM"];
    const encoded = encodeDashboardState({ selection });
    expect(encoded.length).toBeLessThan(500);
    expect(encoded.length).toBeLessThan(DASHBOARD_URL_STATE_MAX_LENGTH);
  });
});
