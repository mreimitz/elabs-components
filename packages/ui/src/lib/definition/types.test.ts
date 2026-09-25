/**
 * Type-level guarantees of the definition base. Each `@ts-expect-error` is a
 * mistake the compiler must catch; `pnpm typecheck` fails if one stops being
 * an error.
 */

import { describe, expectTypeOf, it } from "vitest";

import {
  assertDefinitionComplete,
  defineComponent,
  definePropGroup,
  field,
  headerGroup,
  type FieldValue,
  type SpecIssue,
  type UnaccountedProps,
  type ValidationResult,
} from "./index";
import type { SpecPlaygroundError } from "../../components/spec-playground/spec-playground";

interface MotionFixtureProps {
  animationDuration?: number;
  animationEasing?: "ease" | "linear";
}

interface SeriesFixtureProps {
  title: string;
  series?: string[];
  gap?: number;
  mode?: "a" | "b";
  onPick?: (id: string) => void;
}

describe("field builders", () => {
  it("carry their value types", () => {
    const _text = field.string();
    expectTypeOf<FieldValue<typeof _text>>().toEqualTypeOf<string>();
    const _mode = field.enum({ values: ["a", "b"] });
    expectTypeOf<FieldValue<typeof _mode>>().toEqualTypeOf<"a" | "b">();
    const _nullable = field.number({ nullable: true });
    expectTypeOf<FieldValue<typeof _nullable>>().toEqualTypeOf<number | null>();
    const _list = field.array({ of: field.string() });
    expectTypeOf<FieldValue<typeof _list>>().toEqualTypeOf<readonly string[]>();
    const _size = field.responsive({ of: field.number(), breakpoints: ["narrow"] });
    expectTypeOf<FieldValue<typeof _size>>().toEqualTypeOf<
      number | { readonly base: number; readonly narrow?: number }
    >();
  });

  it("reject a default of the wrong type", () => {
    // @ts-expect-error a number field takes a number default
    field.number({ default: "wide" });
    // @ts-expect-error an enum default must be one of its values
    field.enum({ values: ["a", "b"], default: "c" });
    // @ts-expect-error an array default must hold the item type
    field.array({ of: field.number(), default: ["x"] });
  });
});

describe("definePropGroup", () => {
  it("types defaults as const, leaving out context defaults", () => {
    const motion = definePropGroup<MotionFixtureProps>()({
      id: "motion",
      fields: {
        animationDuration: field.number({ default: 1100, unit: "ms" }),
        animationEasing: field.enum({ values: ["ease", "linear"], default: () => "ease" as const }),
      },
    });
    expectTypeOf(motion.defaults).toEqualTypeOf<{ readonly animationDuration: 1100 }>();
    expectTypeOf(motion.id).toEqualTypeOf<"motion">();
  });

  it("needs a field for every prop, of the prop's type, and nothing else", () => {
    definePropGroup<MotionFixtureProps>()({
      id: "motion",
      // @ts-expect-error animationEasing has no field
      fields: { animationDuration: field.number() },
    });
    definePropGroup<MotionFixtureProps>()({
      id: "motion",
      fields: {
        // @ts-expect-error a string field for a number prop
        animationDuration: field.string(),
        animationEasing: field.enum({ values: ["ease", "linear"] }),
      },
    });
    definePropGroup<MotionFixtureProps>()({
      id: "motion",
      fields: {
        animationDuration: field.number(),
        // @ts-expect-error the enum is missing a value the prop allows
        animationEasing: field.enum({ values: ["ease"] }),
      },
    });
    definePropGroup<MotionFixtureProps>()({
      id: "motion",
      fields: {
        animationDuration: field.number(),
        animationEasing: field.enum({ values: ["ease", "linear"] }),
        // @ts-expect-error not a prop of the group
        stagger: field.number(),
      },
    });
  });
});

describe("defineComponent", () => {
  it("accepts a mutable array default without readonly friction", () => {
    const def = defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      fields: {
        title: field.string({ required: true }),
        series: field.array({ of: field.string() }),
        gap: field.number(),
        mode: field.enum({ values: ["a", "b"] }),
      },
      codeOnly: ["onPick"],
      defaults: { series: ["revenue", "cost"], mode: "a" },
      targets: [],
    });
    expectTypeOf<UnaccountedProps<typeof def>>().toEqualTypeOf<never>();
    const series: string[] | undefined = def.defaults?.series;
    expectTypeOf(series).toEqualTypeOf<string[] | undefined>();
  });

  it("catches fields, defaults and codeOnly keys that do not match the props", () => {
    defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      fields: {
        // @ts-expect-error a required prop needs `required: true`
        title: field.string(),
      },
      codeOnly: [],
      targets: [],
    });
    defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      fields: {
        // @ts-expect-error a number prop described as a boolean
        gap: field.boolean(),
      },
      codeOnly: [],
      targets: [],
    });
    defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      fields: {},
      // @ts-expect-error not a prop
      codeOnly: ["onHover"],
      targets: [],
    });
    defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      fields: {},
      codeOnly: [],
      // @ts-expect-error a default of the wrong type
      defaults: { gap: "wide" },
      targets: [],
    });
    defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      // @ts-expect-error "width" is not a prop
      fields: { width: field.number() },
      codeOnly: [],
      targets: [],
    });
    // @ts-expect-error defaultsNotInProps: "width" is not a prop
    defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      fields: {},
      codeOnly: [],
      defaults: { gap: 2, width: 4 },
      targets: [],
    });
    // @ts-expect-error groupFieldsNotMatchingProps: the header group's subtitle/description are not props
    defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [headerGroup],
      fields: { title: field.string({ required: true }) },
      codeOnly: [],
      targets: [],
    });
  });

  it("makes an unaccounted prop a compile error at the completeness check", () => {
    const partial = defineComponent<SeriesFixtureProps>()({
      id: "series",
      version: 1,
      label: "Series",
      groups: [],
      fields: { title: field.string({ required: true }) },
      codeOnly: ["onPick"],
      defaults: {},
      targets: [],
    });
    expectTypeOf<UnaccountedProps<typeof partial>>().toEqualTypeOf<"series" | "gap" | "mode">();
    const check = () =>
      // @ts-expect-error unaccountedProps: "series" | "gap" | "mode"
      assertDefinitionComplete(partial);
    expectTypeOf(check).toBeFunction();
  });
});

describe("SpecIssue", () => {
  it("fits the spec playground's error shape", () => {
    expectTypeOf<SpecIssue>().toExtend<SpecPlaygroundError>();
    const issues: ValidationResult<unknown>["issues"] = [];
    const errors: readonly SpecPlaygroundError[] = issues;
    expectTypeOf(errors).toEqualTypeOf<readonly SpecPlaygroundError[]>();
  });
});
