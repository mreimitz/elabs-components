import type { StyleIssue, StyleProfile } from "./types";
type Rule =
  | "string"
  | "color"
  | "boolean"
  | { enum: readonly unknown[] }
  | { min: number; max: number }
  | { array: Rule; max: number }
  | { record: Rule }
  | { fields: Record<string, Rule>; optional?: readonly string[] };
const choice = (...values: unknown[]): Rule => ({ enum: values });
const object = (fields: Record<string, Rule>, optional?: readonly string[]): Rule => ({
  fields,
  optional,
});
const paint = object({ fill: "color", text: "color", stroke: "color" });
const flow = object({
  stroke: "color",
  width: { min: 0.5, max: 8 },
  dash: choice("none", "6 4", "6 5"),
  marker: choice("arrow", "none"),
});
/** The same closed structural contract validates inheritance input and final resolved profiles. */
export const PROFILE_SCHEMA: Rule = object(
  {
    profile: "string",
    schemaVersion: choice(1),
    lens: choice("technical", "visual"),
    title: "string",
    extends: "string",
    vendor: "string",
    fidelity: choice("verified", "approximate", "unverified"),
    source: "string",
    ground: object({ fill: "color", followTheme: "boolean" }),
    typography: object({
      text: "color",
      muted: "color",
      family: choice("inherit", "Inter"),
      emphasis: choice("weight"),
    }),
    roles: object(
      Object.fromEntries(["hero", "other", "generic", "sub", "zone"].map((key) => [key, paint])),
    ),
    owners: object(
      Object.fromEntries(
        ["customer", "saas", "hosted", "partner", "unowned"].map((key) => [key, paint]),
      ),
    ),
    zones: object({
      radius: { min: 0, max: 32 },
      accentHeight: { min: 0, max: 12 },
      accents: object(
        Object.fromEntries(
          ["vendor-cloud", "sources", "customer-managed", "customer-vpc", "targets"].map((key) => [
            key,
            "color",
          ]),
        ),
      ),
    }),
    boxes: object({
      anatomy: choice("capability-list"),
      title: object({ weight: choice(400, 500, 600, 700), align: choice("left", "center") }),
      items: object({ icon: choice("mono", "brand"), bullet: choice("ring", "none") }),
    }),
    pills: object({
      enabled: "boolean",
      fill: "color",
      text: "color",
      vocabulary: { array: "string", max: 32 },
      fromTags: { record: "string" },
    }),
    flows: object({
      data: flow,
      control: flow,
      routing: choice("orthogonal"),
      arrowheads: choice("target-only", "both-when-bidirectional", "none"),
    }),
    layout: object({
      direction: choice("LR", "TB"),
      controlPlane: choice("top"),
      lanes: { array: "string", max: 16 },
      grid: { min: 1, max: 64 },
    }),
    forbid: {
      array: choice(
        "per-node-colour",
        "accent-as-fill",
        "diagonal-edges",
        "coloured-arrows",
        "new-pill-labels",
      ),
      max: 5,
    },
  },
  ["extends", "vendor"],
);
const SAFE_COLOR =
  /^(?:#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|var\(--[a-z][a-z\d-]*\)|none|transparent|currentColor)$/i;
export function profileIssues(value: unknown, partial = false): StyleIssue[] {
  const issues: StyleIssue[] = [];
  const fail = (path: (string | number)[], message: string) => {
    issues.push({ code: "style-profile", path, message });
  };
  function visit(value: unknown, rule: Rule, path: (string | number)[]) {
    if (typeof rule === "string") {
      const valid =
        rule === "boolean"
          ? typeof value === "boolean"
          : typeof value === "string" &&
            value.length > 0 &&
            value.length <= 512 &&
            (rule !== "color" || SAFE_COLOR.test(value));
      if (!valid)
        fail(path, `Expected ${rule === "color" ? "a safe color or semantic token" : rule}.`);
    } else if ("enum" in rule) {
      if (!rule.enum.includes(value)) fail(path, `Expected one of ${rule.enum.join(", ")}.`);
    } else if ("min" in rule) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < rule.min ||
        value > rule.max
      )
        fail(path, `Expected a number from ${rule.min} to ${rule.max}.`);
    } else if ("array" in rule) {
      if (!Array.isArray(value) || value.length > rule.max)
        fail(path, `Expected an array with at most ${rule.max} items.`);
      else value.forEach((item, index) => visit(item, rule.array, [...path, index]));
    } else if (!value || typeof value !== "object" || Array.isArray(value))
      fail(path, "Expected an object.");
    else {
      const entries = Object.entries(value);
      if (entries.length > 100) {
        fail(path, "Too many fields.");
        return;
      }
      for (const [key, item] of entries) {
        if (["__proto__", "constructor", "prototype"].includes(key)) {
          fail([...path, key], "Unsafe field.");
          continue;
        }
        const child =
          "record" in rule
            ? rule.record
            : Object.hasOwn(rule.fields, key)
              ? rule.fields[key]
              : undefined;
        if (!child) fail([...path, key], "Unknown field.");
        else visit(item, child, [...path, key]);
      }
      if ("fields" in rule && !partial)
        for (const key of Object.keys(rule.fields))
          if (!(key in value) && !rule.optional?.includes(key))
            fail([...path, key], "Required field.");
    }
  }
  visit(value, PROFILE_SCHEMA, []);
  if (!issues.length && !partial) {
    const profile = value as StyleProfile;
    for (const [tag, pill] of Object.entries(profile.pills.fromTags))
      if (!profile.pills.vocabulary.includes(pill))
        fail(["pills", "fromTags", tag], "Pill must belong to the profile vocabulary.");
  }
  return issues;
}
