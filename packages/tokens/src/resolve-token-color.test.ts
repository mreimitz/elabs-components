import { describe, expect, it } from "vitest";

import { labToHex, oklchToHex } from "./resolve-token-color";

describe("oklchToHex", () => {
  it("converts white and black", () => {
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff");
    expect(oklchToHex("oklch(0 0 0)")).toBe("#000000");
  });

  it("converts a chromatic color to a plausible green", () => {
    const hex = oklchToHex("oklch(0.6 0.14 150)");
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const g = parseInt(hex!.slice(3, 5), 16);
    const r = parseInt(hex!.slice(1, 3), 16);
    expect(g).toBeGreaterThan(r);
  });

  it("appends an alpha byte for translucent colors", () => {
    expect(oklchToHex("oklch(1 0 0 / 0.5)")).toMatch(/^#ffffff[0-9a-f]{2}$/);
  });

  it("supports percentage lightness, deg hue, and percentage alpha", () => {
    expect(oklchToHex("oklch(100% 0 90deg)")).toBe("#ffffff");
    expect(oklchToHex("oklch(1 0 0 / 50%)")).toBe("#ffffff80");
  });

  it("parses Chromium's computed-style serialization (percent L, leading-dot decimals)", () => {
    // getComputedStyle re-serializes `oklch(0.92 0.008 264)` as
    // `oklch(92% .008 264)` — the exact form MapLibre rejected when the strict
    // parser fell through to raw passthrough (maps cross-theme sweep finding).
    expect(oklchToHex("oklch(92% .008 264)")).toMatch(/^#[0-9a-f]{6}$/);
    expect(oklchToHex("oklch(20.5% .012 254)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("clamps out-of-gamut chroma instead of producing NaN", () => {
    expect(oklchToHex("oklch(0.5 0.4 30)")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns null for non-oklch input", () => {
    expect(oklchToHex("#ff0000")).toBeNull();
    expect(oklchToHex("rgb(1, 2, 3)")).toBeNull();
    expect(oklchToHex("var(--primary)")).toBeNull();
    expect(oklchToHex("")).toBeNull();
  });
});

describe("labToHex", () => {
  it("converts white, black and mid grey", () => {
    expect(labToHex("lab(100% 0 0)")).toBe("#ffffff");
    expect(labToHex("lab(0 0 0)")).toBe("#000000");
    expect(labToHex("lab(53.585% 0 0)")).toBe("#808080");
  });

  it("converts what a CSS build step leaves for a green oklch token (negative a)", () => {
    // The exact value MapLibre rejected: Lightning CSS lowers the token's oklch() to lab().
    const hex = labToHex("lab(49.0713% -45.4403 30.0506)");
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex!.slice(i, i + 2), 16));
    expect(g).toBeGreaterThan(r!);
    expect(g).toBeGreaterThan(b!);
  });

  it("appends an alpha byte for translucent colors", () => {
    expect(labToHex("lab(100% 0 0 / 0.5)")).toBe("#ffffff80");
    expect(labToHex("lab(100 0 0 / 50%)")).toBe("#ffffff80");
  });

  it("returns null for non-lab input", () => {
    expect(labToHex("oklch(1 0 0)")).toBeNull();
    expect(labToHex("#00ff00")).toBeNull();
  });
});
