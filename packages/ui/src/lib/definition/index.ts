/**
 * `@elabs-ai/components-ui/definition` — the shared, React-free definition
 * base: fields, prop groups, component definitions, defaults resolution,
 * aliases, validation, and JSON Schema / snapshot generation. Charts
 * definitions, flow's node types and the CLI build on it.
 */

export {
  field,
  isContextDefault,
  type AnyField,
  type AppliesWhen,
  type ArrayFieldOptions,
  type ArrayFieldShape,
  type BooleanFieldOptions,
  type BooleanFieldShape,
  type BuiltField,
  type ColorFieldOptions,
  type ColorFieldShape,
  type CompleteFieldMap,
  type DefaultFromContext,
  type EnumFieldOptions,
  type EnumFieldShape,
  type Field,
  type FieldDeprecation,
  type FieldFor,
  type FieldKind,
  type FieldMap,
  type FieldOptions,
  type FieldPrimitive,
  type FieldTier,
  type FieldUnit,
  type FieldValue,
  type KnownKey,
  type KnownProps,
  type NormalizedValue,
  type NumberFieldOptions,
  type NumberFieldShape,
  type ObjectFieldOptions,
  type ObjectFieldShape,
  type ObjectValue,
  type ResponsiveFieldOptions,
  type ResponsiveFieldShape,
  type ResponsiveValue,
  type StringFieldOptions,
  type StringFieldShape,
  type UnionFieldOptions,
  type UnionFieldShape,
} from "./field";
export {
  definePropGroup,
  type AnyPropGroup,
  type GroupDefaults,
  type PropGroup,
} from "./prop-group";
export {
  defineComponent,
  type AliasFromKeys,
  type AnyComponentDefinition,
  type ComponentDefinition,
  type DefinedComponent,
  type DefinitionChecks,
  type GroupFieldKeys,
  type PropsOf,
  type TargetDescriptor,
} from "./component-definition";
export { resolveProps, type DefaultedKeys, type ResolvedProps } from "./resolve-props";
export {
  ALIAS_TRANSFORMS,
  applyAliases,
  normalizeAliases,
  type AliasInput,
  type AliasPrecedence,
  type AliasRow,
  type AliasShorthandVersions,
  type AliasSource,
  type AliasTransform,
  type AliasTransformId,
  type NormalizedAliasRow,
} from "./aliases";
export { resetWarnOnce, warnOnce } from "./warn-once";
export type { SpecIssue, SpecIssueSeverity, ValidationResult } from "./issues";
export { validateProps, type ValidateOptions } from "./validate";
export { headerGroup, type HeaderGroupProps } from "./groups/header";
export { a11yGroup, type A11yGroupProps } from "./groups/a11y";
export { statusGroup, type StatusGroupProps } from "./groups/status";
export { toJsonSchema, type JsonSchema } from "./generate/json-schema";
export { toSnapshot, type DefinitionSnapshot, type SnapshotValue } from "./generate/snapshot";
export {
  assertDefinitionComplete,
  type AssertDefinitionOptions,
  type DefinitionIsComplete,
  type UnaccountedProps,
} from "./testing/assert-definition-complete";
