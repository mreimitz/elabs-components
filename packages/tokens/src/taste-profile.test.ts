/**
 * taste-profile.test.ts — the taste profile's PURE surface (#108).
 *
 * Locks the two things a consumer/audit depends on: the restrained defaults
 * (expressive is opt-in) and the register guard rejecting junk. The RENDERED
 * half — `useTasteProfile()` inside a real `<ThemeProvider>`, and the
 * `data-register` attribute — lives in `packages/ui/src/taste-profile.test.tsx`
 * because this package's vitest environment is `node` (no DOM, no React) by
 * design; see packages/tokens/vitest.config.ts.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DECORATION_LEVEL,
  DEFAULT_DENSITY,
  DEFAULT_MOTION_PREFERENCE,
  DEFAULT_TASTE_PROFILE,
  DEFAULT_TASTE_REGISTER,
  isTasteRegister,
  TASTE_REGISTER_META,
  TASTE_REGISTERS,
} from "./theme-types";

describe("taste register", () => {
  it("defaults to the restrained register", () => {
    expect(DEFAULT_TASTE_REGISTER).toBe("product");
    expect(TASTE_REGISTERS).toEqual(["product", "brand"]);
  });

  it("has meta for every register (label + description)", () => {
    for (const r of TASTE_REGISTERS) {
      expect(TASTE_REGISTER_META[r]).toMatchObject({ value: r });
      expect(TASTE_REGISTER_META[r].label.length).toBeGreaterThan(0);
      expect(TASTE_REGISTER_META[r].description.length).toBeGreaterThan(0);
    }
  });

  it("isTasteRegister narrows real values and rejects junk", () => {
    expect(isTasteRegister("product")).toBe(true);
    expect(isTasteRegister("brand")).toBe(true);
    for (const junk of ["Product", "marketing", "", null, undefined, 0, {}, ["brand"]]) {
      expect(isTasteRegister(junk)).toBe(false);
    }
  });
});

describe("DEFAULT_TASTE_PROFILE", () => {
  it("is restrained on every axis — expressive is opt-in", () => {
    expect(DEFAULT_TASTE_PROFILE).toEqual({
      register: "product",
      density: "comfortable",
      motion: "system",
      expressiveness: 0,
    });
  });

  it("reuses the shipped dial defaults rather than re-declaring them", () => {
    expect(DEFAULT_TASTE_PROFILE.register).toBe(DEFAULT_TASTE_REGISTER);
    expect(DEFAULT_TASTE_PROFILE.density).toBe(DEFAULT_DENSITY);
    expect(DEFAULT_TASTE_PROFILE.motion).toBe(DEFAULT_MOTION_PREFERENCE);
    // `expressiveness` IS the decoration dial — never a fourth knob (ADR 0020).
    expect(DEFAULT_TASTE_PROFILE.expressiveness).toBe(DEFAULT_DECORATION_LEVEL);
  });
});
