/**
 * theme-families.test.ts — the pure family/scheme grouping (ADR 0036).
 *
 * A family is METADATA over the flat registry: never inferred from a name, and
 * a registry with no `family` fields must group exactly as it did before the
 * field existed (each theme its own undeclared, single-scheme family).
 */
import { describe, expect, it } from "vitest";

import {
  BUILT_IN_THEME_DEFINITIONS,
  defineTheme,
  groupThemeFamilies,
  resolveThemeVariant,
  themeFamilyIdOf,
  themeSchemeOf,
} from "./index";

const oceanLight = defineTheme({
  value: "ocean-light",
  label: "Ocean light",
  dark: false,
  family: "ocean",
  familyLabel: "Ocean",
});
const oceanDark = defineTheme({
  value: "ocean-dark",
  label: "Ocean dark",
  dark: true,
  family: "ocean",
});
const dusk = defineTheme({
  value: "dusk",
  label: "Dusk",
  dark: true,
  family: "dusk",
  familyLabel: "Dusk",
});
const midnight = defineTheme({ value: "midnight", label: "Midnight", dark: true });
const daylight = defineTheme({ value: "daylight", label: "Daylight", dark: false });

describe("themeSchemeOf / themeFamilyIdOf", () => {
  it("reads the scheme off the dark flag", () => {
    expect(themeSchemeOf({ dark: true })).toBe("dark");
    expect(themeSchemeOf({ dark: false })).toBe("light");
  });

  it("uses the declared family, else the theme's own value", () => {
    expect(themeFamilyIdOf(oceanDark)).toBe("ocean");
    expect(themeFamilyIdOf(midnight)).toBe("midnight");
  });

  it("never infers a family from a -light/-dark name", () => {
    expect(themeFamilyIdOf({ value: "ocean-dark" })).toBe("ocean-dark");
  });
});

describe("groupThemeFamilies", () => {
  it("groups the built-ins into one declared Default family with both schemes", () => {
    const [family, ...rest] = groupThemeFamilies(BUILT_IN_THEME_DEFINITIONS);
    expect(rest).toEqual([]);
    expect(family).toMatchObject({ id: "default", label: "Default", declared: true });
    expect(family?.schemes).toEqual(["light", "dark"]);
    expect(family?.light?.value).toBe("light");
    expect(family?.dark?.value).toBe("dark");
  });

  it("keeps first-appearance order and supports single-scheme families", () => {
    const families = groupThemeFamilies([
      ...BUILT_IN_THEME_DEFINITIONS,
      oceanLight,
      oceanDark,
      dusk,
    ]);
    expect(families.map((f) => f.id)).toEqual(["default", "ocean", "dusk"]);
    expect(families[1]?.schemes).toEqual(["light", "dark"]);
    expect(families[2]?.schemes).toEqual(["dark"]);
  });

  it("treats undeclared themes as their own undeclared families, labelled by the theme", () => {
    const families = groupThemeFamilies([daylight, midnight]);
    expect(families.map((f) => [f.id, f.label, f.declared])).toEqual([
      ["daylight", "Daylight", false],
      ["midnight", "Midnight", false],
    ]);
  });

  it("fills a duplicate scheme slot with the FIRST member", () => {
    const oceanDark2 = defineTheme({
      value: "ocean-dark-2",
      label: "Ocean dark 2",
      dark: true,
      family: "ocean",
    });
    const [ocean] = groupThemeFamilies([oceanLight, oceanDark, oceanDark2]);
    expect(ocean?.dark?.value).toBe("ocean-dark");
  });

  it("uses the first familyLabel when members disagree", () => {
    const relabelled = { ...oceanDark, familyLabel: "Sea" };
    expect(groupThemeFamilies([oceanLight, relabelled])[0]?.label).toBe("Ocean");
  });

  it("groups the narrowed list, so dropping one variant makes a family single-scheme", () => {
    expect(groupThemeFamilies([oceanLight])[0]?.schemes).toEqual(["light"]);
  });
});

describe("resolveThemeVariant", () => {
  const families = groupThemeFamilies([...BUILT_IN_THEME_DEFINITIONS, oceanLight, oceanDark, dusk]);

  it("returns the requested scheme when the family has it", () => {
    expect(resolveThemeVariant(families, "ocean", "dark")).toBe("ocean-dark");
    expect(resolveThemeVariant(families, "default", "light")).toBe("light");
  });

  it("falls back to the family's only scheme", () => {
    expect(resolveThemeVariant(families, "dusk", "light")).toBe("dusk");
  });

  it("returns undefined for an unknown family", () => {
    expect(resolveThemeVariant(families, "nope", "light")).toBeUndefined();
  });
});
