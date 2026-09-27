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
 * internally (that module is deliberately not exported from the
 * `/definition` subpath, so it is reimplemented here, minimally, for an own
 * field to still win over a group field of the same key) — and converts each
 * `AnyField` to a FormSpec `FieldSpec` BY KIND. A kind FormSpec cannot
 * express is recorded as unmapped instead of guessed at. Every essential-tier
 * gap this turns up is written up in ADR 0042's "FieldSpec gaps (RM-200
 * spike)" appendix.
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
import type {
  AnyComponentDefinition,
  AnyField,
  AnyPropGroup,
  FieldTier,
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
          "object — FieldSpec has no generic nested-object kind; `group` only holds NAMED " +
          "alternative branches (Onyx's tab/advanced), not an arbitrary field map",
      };
    case "array":
      return {
        status: "unmapped",
        reason:
          `object-array (array of "${field.of.kind}") — FieldSpec's \`list\` holds strings ` +
          "only and `key-value` is a fixed { key, value } row",
      };
    case "union":
      return {
        status: "unmapped",
        reason:
          'union — FieldSpec has no kind for "one of several shapes"; a discriminated ' +
          "`group` needs a shared named branch key, which this union's members don't have",
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
 * kind it needs. An essential field missing from BOTH this list and `MAPPED`
 * fails the completeness test below; a field listed here that actually maps
 * fails it too, so the list can't quietly go stale.
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
    label: SECTION_LABELS[id] ?? id,
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

const BAR_CHART_FORM_SPEC: FormSpec = {
  formName: "bar-chart",
  title: BAR_CHART.label,
  description: BAR_CHART.description,
  fields: [...ESSENTIAL_MAPPED.map((entry) => entry.spec), ADVANCED_GROUP_FIELD],
  sections: sectionsFor(ESSENTIAL_MAPPED),
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

    for (const key of essentialKeys) {
      const isMapped = MAPPED.some((entry) => entry.key === key && entry.tier === "essential");
      const isListed = key in UNMAPPED_ESSENTIAL;
      expect(
        isMapped || isListed,
        `essential field "${key}" is neither mapped nor in UNMAPPED_ESSENTIAL`,
      ).toBe(true);
      expect(
        !(isMapped && isListed),
        `essential field "${key}" maps AND is listed in UNMAPPED_ESSENTIAL — drop it from the list`,
      ).toBe(true);
    }
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

  it("renders every mapped essential field with the real SchemaForm", () => {
    render(createElement(SchemaForm, { spec: BAR_CHART_FORM_SPEC }));
    expect(screen.getByText("Bar chart")).toBeInTheDocument();
    for (const entry of ESSENTIAL_MAPPED) {
      expect(screen.getByText(fieldLabel(entry.spec))).toBeInTheDocument();
    }
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
