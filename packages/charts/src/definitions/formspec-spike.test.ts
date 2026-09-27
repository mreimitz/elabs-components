/**
 * formspec-spike.test.ts — RM-200 (ADR 0042 §10, §13): a test-only spike.
 * Does the BarChart definition (ADR 0042 §5, `bar-chart.definition.ts`) map
 * onto `@elabs-ai/components-ui`'s `FormSpec` (`schema-form-spec.ts`), the
 * vocabulary `SchemaForm` renders?
 *
 * Nothing here ships: the mapper below is private to this test file,
 * `packages/ui/src/components/schema-form/**` is never touched, and there is
 * still no end-user property-panel editor (ADR 0042 §13 / §10: "FormSpec: a
 * test-only spike for BarChart; no editor").
 *
 * The mapper walks BAR_CHART's own `fields` plus its `groups`' fields — the
 * same merge `packages/ui/src/lib/definition/effective-fields.ts` does
 * internally (own field wins over a group field of the same key). That
 * module's `planOf` is deliberately not exported from the `/definition`
 * subpath, so the merge is reimplemented here, minimally — but `toSnapshot`
 * (which calls `planOf` internally) IS exported, and a test below asserts
 * this file's merged key set against `toSnapshot(BAR_CHART).fields`'s own
 * keys, so the reimplementation cannot silently drift from the real one.
 * Each `AnyField` converts to a FormSpec `FieldSpec` BY KIND. A kind
 * FormSpec cannot express is recorded as unmapped instead of guessed at.
 * Every essential-tier gap this turns up is written up in ADR 0042's
 * "FieldSpec gaps (RM-200 spike)" appendix.
 */
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  SchemaForm,
  fieldLabel,
  formSpecSchema,
  normalizeFormSpec,
  type FieldSpec,
  type FormSectionSpec,
  type FormSpec,
} from "@elabs-ai/components-ui";
import {
  toSnapshot,
  type AnyComponentDefinition,
  type AnyField,
  type AnyPropGroup,
  type FieldTier,
} from "@elabs-ai/components-ui/definition";

import { BAR_CHART } from "./bar-chart.definition";

// ── 1. Merge BAR_CHART's own fields with its groups' fields ────────────────

interface MergedField {
  readonly key: string;
  readonly field: AnyField;
  /** The group id the field came from; `null` for one of BAR_CHART's own fields. */
  readonly group: string | null;
}

function mergeDefinitionFields(def: AnyComponentDefinition): MergedField[] {
  const merged = new Map<string, MergedField>();
  for (const group of def.groups as readonly AnyPropGroup[]) {
    for (const [key, field] of Object.entries(group.fields)) {
      merged.set(key, { key, field, group: group.id });
    }
  }
  // An own field overrides a group field of the same key (ADR 0042 §3).
  for (const [key, field] of Object.entries(def.fields)) {
    if (field) merged.set(key, { key, field, group: null });
  }
  return [...merged.values()];
}

const BAR_CHART_DEFINITION_FIELDS = mergeDefinitionFields(BAR_CHART as AnyComponentDefinition);

function tierOf(field: AnyField): FieldTier {
  return field.tier ?? "advanced";
}

// ── 2. AnyField → FieldSpec, by kind ────────────────────────────────────────

type MapResult =
  | { readonly status: "mapped"; readonly spec: FieldSpec }
  | {
      readonly status: "unmapped";
      readonly reason: string;
    };

/** The kind default (ADR 0042 §3's resolution order, own-field-default fallback only — no group defaults, no context defaults: this spike never renders a real chart). */
function kindDefault(
  key: string,
  field: AnyField,
  kindDefaults: Readonly<Record<string, unknown>>,
): unknown {
  if (kindDefaults[key] !== undefined) return kindDefaults[key];
  if (field.default !== undefined && typeof field.default !== "function") return field.default;
  return undefined;
}

function toVisibleWhen(field: AnyField): FieldSpec["visibleWhen"] {
  const appliesWhen = field.appliesWhen;
  if (!appliesWhen) return undefined;
  // FormSpec's `visibleWhen` is `{ field, equals }` only — the `{ field, in }`
  // form of `AppliesWhen` has no FormSpec equivalent. BarChart never declares
  // one (`sort`/`stacked` are the closest, and neither uses `appliesWhen`
  // itself), so this spike does not need to invent a fallback for it; see the
  // ADR appendix.
  if ("equals" in appliesWhen) return { field: appliesWhen.field, equals: appliesWhen.equals };
  return undefined;
}

function toFieldSpec(
  key: string,
  field: AnyField,
  kindDefaults: Readonly<Record<string, unknown>>,
): MapResult {
  const rawDefault = kindDefault(key, field, kindDefaults);
  const visibleWhen = toVisibleWhen(field);
  const base = {
    name: key,
    ...(field.description ? { description: field.description } : {}),
    ...(field.required ? { required: true as const } : {}),
    ...(visibleWhen ? { visibleWhen } : {}),
  };

  switch (field.kind) {
    case "string":
      return {
        status: "mapped",
        spec: {
          type: "string",
          ...base,
          ...(field.min !== undefined ? { minLength: field.min } : {}),
          ...(field.max !== undefined ? { maxLength: field.max } : {}),
          ...(typeof rawDefault === "string" ? { default: rawDefault } : {}),
        },
      };
    case "number":
    case "integer":
      return {
        status: "mapped",
        spec: {
          type: field.kind,
          ...base,
          ...(field.min !== undefined ? { min: field.min } : {}),
          ...(field.max !== undefined ? { max: field.max } : {}),
          ...(typeof rawDefault === "number" ? { default: rawDefault } : {}),
        },
      };
    case "boolean":
      return {
        status: "mapped",
        spec: {
          type: "boolean",
          ...base,
          ...(typeof rawDefault === "boolean" ? { default: rawDefault } : {}),
        },
      };
    case "enum": {
      const nonStringValues = field.values.filter((v) => typeof v !== "string");
      if (nonStringValues.length > 0) {
        return {
          status: "unmapped",
          reason:
            `enum has non-string values (${nonStringValues.map((v) => JSON.stringify(v)).join(", ")}); ` +
            "FormSpec's `EnumOption` const (schema-form-spec.ts) is a string only",
        };
      }
      const options = field.values as string[];
      return {
        status: "mapped",
        spec: {
          type: "enum",
          ...base,
          options,
          ...(typeof rawDefault === "string" ? { default: rawDefault } : {}),
        },
      };
    }
    case "color":
      return { status: "unmapped", reason: "colour — FieldSpec has no `color` kind" };
    case "responsive":
      return {
        status: "unmapped",
        reason:
          "Responsive<T> (`{ base, medium?, narrow? }`) — FieldSpec has no per-breakpoint kind",
      };
    case "object":
      return {
        status: "unmapped",
        reason:
          "object — FormSpec's `FormValue` has no object type (schema-form-spec.ts:340-347); " +
          "every field's value lives in one flat object keyed by name, walked across the WHOLE " +
          "tree including nested group branches (:389-396), and names must be unique across " +
          "that whole tree or the colliding field is dropped (:421-430 — a plain `colorBy.key` " +
          "beside a plain `comparison.key` would collide once flattened); `group` doesn't fit " +
          "either — a branch is chosen by a STRING key, never populated with a value shaped " +
          "like this object's fields",
      };
    case "array": {
      const of = field.of;
      // An array of a plain, all-string enum is FormSpec's `multi-enum`; an array of
      // plain strings is its `list`. Anything else — an array of a richer field, most of
      // BarChart's `array` fields — stays the object-array gap FormSpec has no kind for.
      if (of.kind === "enum") {
        const nonStringValues = of.values.filter((v) => typeof v !== "string");
        if (nonStringValues.length === 0) {
          const options = of.values as string[];
          return {
            status: "mapped",
            spec: {
              type: "multi-enum",
              ...base,
              options,
              ...(Array.isArray(rawDefault) ? { default: rawDefault as string[] } : {}),
            },
          };
        }
      }
      if (of.kind === "string") {
        return {
          status: "mapped",
          spec: {
            type: "list",
            ...base,
            ...(Array.isArray(rawDefault) ? { default: rawDefault as string[] } : {}),
          },
        };
      }
      return {
        status: "unmapped",
        reason:
          `object-array (array of "${of.kind}") — FieldSpec's \`list\` holds strings only ` +
          "and `key-value` is a fixed { key, value } row",
      };
    }
    case "union":
      return {
        status: "unmapped",
        reason:
          "union — the same root cause as object: FormSpec's flat, name-keyed `FormValues` " +
          '(schema-form-spec.ts:340-347, :389-396) has no slot for "one of several shapes"; ' +
          "a `group`'s branch is picked by a string key (:421-430), never populated with a " +
          "value shaped like one of this union's own members",
      };
    /* v8 ignore next 2 -- exhaustiveness guard, not a real BarChart field kind */
    default:
      return { status: "unmapped", reason: `unhandled field kind "${(field as AnyField).kind}"` };
  }
}

// ── 3. Map every field, split essential vs. advanced ────────────────────────

interface MappedEntry {
  readonly key: string;
  readonly tier: FieldTier;
  readonly group: string | null;
  readonly spec: FieldSpec;
}
interface UnmappedEntry {
  readonly key: string;
  readonly tier: FieldTier;
  readonly reason: string;
}

const BAR_CHART_KIND_DEFAULTS = (BAR_CHART.defaults ?? {}) as Readonly<Record<string, unknown>>;

const MAPPED: MappedEntry[] = [];
const UNMAPPED: UnmappedEntry[] = [];
for (const { key, field, group } of BAR_CHART_DEFINITION_FIELDS) {
  const tier = tierOf(field);
  const result = toFieldSpec(key, field, BAR_CHART_KIND_DEFAULTS);
  if (result.status === "mapped") MAPPED.push({ key, tier, group, spec: result.spec });
  else UNMAPPED.push({ key, tier, reason: result.reason });
}

/**
 * Every essential-tier BarChart field that does NOT map, with the FieldSpec
 * kind it needs. The completeness test below asserts this list's key set,
 * exactly, against the essential-tier keys the mapper itself leaves
 * unmapped — an invented key here that names no real field, or a real
 * field's key that has since started mapping (or stopped being essential),
 * fails that assertion. It is the TEST's assertion that cannot go stale
 * silently, not this list on its own, nor the prose table in ADR 0042's
 * appendix that mirrors it.
 */
const UNMAPPED_ESSENTIAL: Readonly<Record<string, string>> = {
  data: "object-array — an array of open, arbitrary-key row objects",
  stacked: 'enum with non-string values (false | true | "percent" | "diverging")',
  sort: 'union ("none" | "asc" | "desc" | { by, dir })',
  legend: "union (boolean | legend config, the object branch also nests Responsive<T>)",
  plotHeight: "Responsive<T> of number | { aspect }",
};

// ── 4. Sections (ADR 0042 prop groups → FormSpec sections) ─────────────────

// "main" is deliberately not labelled "Bar chart" — the form's own title
// (`BAR_CHART.label`) already prints that text once.
const SECTION_LABELS: Readonly<Record<string, string>> = {
  main: "General",
  "category-navigator": "Category navigator",
};

/** A group id with no entry in `SECTION_LABELS` gets a title-cased fallback — never the raw, lowercase, hyphenated id (e.g. `"palette"` becomes "Palette", not "palette"). */
function humanizeSectionId(id: string): string {
  return id
    .split("-")
    .map((word) => (word.length > 0 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function sectionsFor(entries: readonly MappedEntry[]): FormSectionSpec[] {
  const bySection = new Map<string, string[]>();
  for (const entry of entries) {
    const id = entry.group ?? "main";
    const names = bySection.get(id) ?? [];
    names.push(entry.key);
    bySection.set(id, names);
  }
  return [...bySection.entries()].map(([id, fields]) => ({
    id,
    label: SECTION_LABELS[id] ?? humanizeSectionId(id),
    fields,
  }));
}

// ── 5. The FormSpec: essential fields at top level (grouped into sections by
//      their ADR 0042 prop group), every advanced field behind one
//      `variant: "advanced"` group/disclosure ────────────────────────────────

const ESSENTIAL_MAPPED = MAPPED.filter((entry) => entry.tier === "essential");
const ADVANCED_MAPPED = MAPPED.filter((entry) => entry.tier === "advanced");

const ADVANCED_GROUP_FIELD: FieldSpec = {
  type: "group",
  name: "advanced",
  label: "Advanced",
  variant: "advanced",
  groups: [{ key: "advanced", label: "Advanced", fields: ADVANCED_MAPPED.map((e) => e.spec) }],
};

// `SchemaForm` renders every field named by NO section before any section
// (schema-form.tsx:884-913), so leaving `advanced` out of `sections`
// entirely — as this spike first did — puts it FIRST, ahead of every
// essential section. Giving it a section of its own, listed last, is what
// makes it render last instead. That section's own label deliberately does
// NOT say "Advanced" too: the `advanced` field is itself a `variant:
// "advanced"` group, which already renders its OWN "Advanced" disclosure
// trigger nested inside this section's — the same word on both would leave
// two same-named buttons on screen with no way to tell them apart by
// accessible name alone.
const ADVANCED_SECTION: FormSectionSpec = {
  id: "advanced-section",
  label: "More settings",
  fields: ["advanced"],
};

const BAR_CHART_FORM_SPEC: FormSpec = {
  formName: "bar-chart",
  title: BAR_CHART.label,
  description: BAR_CHART.description,
  fields: [...ESSENTIAL_MAPPED.map((entry) => entry.spec), ADVANCED_GROUP_FIELD],
  sections: [...sectionsFor(ESSENTIAL_MAPPED), ADVANCED_SECTION],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RM-200 — BarChart definition → FormSpec (test-only spike)", () => {
  it("maps or lists every essential-tier field exactly once", () => {
    const essentialKeys = BAR_CHART_DEFINITION_FIELDS.filter(
      (entry) => tierOf(entry.field) === "essential",
    ).map((entry) => entry.key);
    // Sanity on the fixture itself: BarChart declares exactly the essential
    // fields this spike was written against. A future essential-tier field
    // (or one losing its tier) must land here as a deliberate edit, not slip
    // through silently.
    expect(essentialKeys.sort()).toStrictEqual(
      [
        "data",
        "legend",
        "orientation",
        "palette",
        "plotHeight",
        "scrollbar",
        "sort",
        "stacked",
        "tooltip",
        "xDataKey",
      ].sort(),
    );

    // `UNMAPPED_ESSENTIAL` must name EXACTLY the essential keys the mapper
    // itself leaves unmapped — an exact-SET assertion, not a per-key loop
    // over `essentialKeys` alone: a loop scoped to `essentialKeys` can never
    // see a bogus/invented key that names no real field (it would just never
    // come up), and can't see an essential field the mapper stopped mapping
    // (or a formerly essential field demoted to advanced — it silently drops
    // out of `essentialKeys` too, so a stale `UNMAPPED_ESSENTIAL` entry for
    // it would never be visited by a loop that only walks `essentialKeys`).
    // Comparing the two SETS catches both: a name on one side with no match
    // on the other fails `toStrictEqual` regardless of which side it's on.
    const essentialUnmappedKeys = UNMAPPED.filter((entry) => entry.tier === "essential")
      .map((entry) => entry.key)
      .sort();
    expect(Object.keys(UNMAPPED_ESSENTIAL).sort()).toStrictEqual(essentialUnmappedKeys);
  });

  it("pins the full unmapped set, both tiers — the counts ADR 0042 Appendix B states describe this exact list", () => {
    // 53 fields total (essential + advanced, asserted above); every key
    // below is one the mapper did NOT turn into a FieldSpec. A field
    // starting or stopping mapping moves its key into or out of this array —
    // a deliberate, reviewable edit here, not a silent drift between the
    // mapper's real behaviour and the ADR's hand-counted prose.
    expect(UNMAPPED.map((entry) => entry.key).sort()).toStrictEqual(
      [
        "analytics",
        "annotations",
        "colorBy",
        "comparison",
        "data",
        "defaultWindow",
        "enterTransition",
        "legend",
        "margin",
        "maxVisibleItems",
        "overlays",
        "plotHeight",
        "sort",
        "stacked",
        "track",
        "window",
      ].sort(),
    );
  });

  it("merges the same field set the ui `/definition` subpath's own toSnapshot does", () => {
    // `toSnapshot` calls the real, unexported `planOf` (`effective-fields.ts`)
    // internally — this cross-check is what keeps this file's own
    // reimplemented merge (§1 above) from silently drifting away from it.
    const snapshot = toSnapshot(BAR_CHART as AnyComponentDefinition);
    const snapshotFields = snapshot.fields as Readonly<Record<string, unknown>>;
    const snapshotKeys = Object.keys(snapshotFields).sort();
    const mergedKeys = BAR_CHART_DEFINITION_FIELDS.map((entry) => entry.key).sort();
    expect(mergedKeys).toStrictEqual(snapshotKeys);
  });

  it("validates as a FormSpec — the schema-form module's own runtime validator", () => {
    expect(() => formSpecSchema.parse(BAR_CHART_FORM_SPEC)).not.toThrow();
    const normalized = normalizeFormSpec(BAR_CHART_FORM_SPEC);
    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      // Every essential field survived normalization (none was silently dropped
      // as malformed) — top-level, plus the ones inside the advanced group.
      const topLevelNames = normalized.spec.fields.map((f) => f.name);
      for (const entry of ESSENTIAL_MAPPED) expect(topLevelNames).toContain(entry.key);
    }
  });

  it("renders every mapped essential field with the real SchemaForm, advanced group last", () => {
    const { container } = render(createElement(SchemaForm, { spec: BAR_CHART_FORM_SPEC }));
    expect(screen.getByText("Bar chart")).toBeInTheDocument();
    for (const entry of ESSENTIAL_MAPPED) {
      // Accessible-name query, not `getByText`: a humanized section label and
      // a field's own label can read identically ("Palette" names both the
      // `palette` section's heading AND the `palette` field's own label) —
      // `getByLabelText` matches only the labelled CONTROL, never a heading.
      expect(screen.getByLabelText(fieldLabel(entry.spec))).toBeInTheDocument();
    }

    // schema-form.tsx renders every field named by NO section BEFORE any
    // section (schema-form.tsx:884-913); `ADVANCED_SECTION` is placed last
    // in `sections` so its own trigger is the last section trigger on
    // screen — a future real generator needs the same placement, or its
    // "advanced" group renders first instead of last (ADR 0042 Appendix B.3).
    const sectionTriggers = container.querySelectorAll('[data-slot="schema-form-section-trigger"]');
    expect(sectionTriggers.length).toBeGreaterThan(0);
    expect(sectionTriggers[sectionTriggers.length - 1]).toHaveTextContent("More settings");
  });

  it("hides and reveals an appliesWhen-gated field via visibleWhen (divergingCenter, gated on stacked)", () => {
    const divergingCenter = ADVANCED_MAPPED.find((entry) => entry.key === "divergingCenter");
    if (!divergingCenter) throw new Error("expected divergingCenter to map (a string field)");
    expect(divergingCenter.spec.visibleWhen).toStrictEqual({
      field: "stacked",
      equals: "diverging",
    });

    // `stacked` itself is UNMAPPED (UNMAPPED_ESSENTIAL), so it never becomes a
    // rendered FieldSpec — `visibleWhen` reads the flat `values` object by
    // name regardless, so a controlled `values.stacked` still gates it.
    const { rerender } = render(
      createElement(SchemaForm, { spec: BAR_CHART_FORM_SPEC, values: { stacked: "percent" } }),
    );
    expect(screen.getByRole("button", { name: /advanced/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    rerender(
      createElement(SchemaForm, { spec: BAR_CHART_FORM_SPEC, values: { stacked: "diverging" } }),
    );
    // divergingCenter now holds a validation-free empty optional value, so the
    // advanced disclosure does not auto-open on its own — open it explicitly.
    fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
    expect(screen.getByText(fieldLabel(divergingCenter.spec))).toBeInTheDocument();

    rerender(
      createElement(SchemaForm, { spec: BAR_CHART_FORM_SPEC, values: { stacked: "percent" } }),
    );
    expect(screen.queryByText(fieldLabel(divergingCenter.spec))).not.toBeInTheDocument();
  });
});
