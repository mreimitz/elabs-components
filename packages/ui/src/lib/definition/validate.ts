/**
 * validate — checks untrusted input (an agent's JSON, a saved spec) against a
 * definition. Never throws: every problem becomes a `SpecIssue`.
 *
 * Checked: the input is an object, every key is a described prop, a
 * `codeOnly` prop or an old alias name; values have the field's kind, enum
 * values are listed, numbers and lengths are in range; required props are
 * present. Deprecated props and alias names pass with a warning.
 *
 * React-free.
 */

import type { AnyComponentDefinition, PropsOf } from "./component-definition";
import { planOf } from "./effective-fields";
import type { AnyField } from "./field";
import type { SpecIssue, ValidationResult } from "./issues";

export interface ValidateOptions {
  /** Prefix for every issue path (`"charts[0]"`), when the input sits inside a larger document. */
  readonly path?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function join(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}

function quote(path: string): string {
  return path ? `"${path}"` : "The input";
}

function listValues(values: readonly unknown[]): string {
  return values.map((v) => JSON.stringify(v)).join(", ");
}

function expectation(f: AnyField): string {
  let text: string;
  switch (f.kind) {
    case "string":
      text = "a string";
      break;
    case "number":
      text = "a number";
      break;
    case "integer":
      text = "a whole number";
      break;
    case "boolean":
      text = "true or false";
      break;
    case "enum":
      text = `one of ${listValues(f.values)}`;
      break;
    case "color":
      text = "a colour string";
      break;
    case "responsive":
      text = `${expectation(f.of)}, or an object with "base" and per-breakpoint values`;
      break;
    case "object":
      text = "an object";
      break;
    case "array":
      text = "a list";
      break;
    case "union":
      text = f.of.map(expectation).join(", or ");
      break;
  }
  return f.nullable ? `${text}, or null` : text;
}

function rangeIssue(
  path: string,
  what: string,
  actual: number,
  min: number | undefined,
  max: number | undefined,
  issues: SpecIssue[],
): void {
  if ((min === undefined || actual >= min) && (max === undefined || actual <= max)) return;
  const bound =
    min !== undefined && max !== undefined
      ? `between ${min} and ${max}`
      : min !== undefined
        ? `at least ${min}`
        : `at most ${max}`;
  issues.push({
    path,
    code: "out-of-range",
    message: `${quote(path)} must have ${what} ${bound}.`,
  });
}

function wrongType(f: AnyField, path: string, issues: SpecIssue[]): void {
  issues.push({ path, code: "wrong-type", message: `${quote(path)} must be ${expectation(f)}.` });
}

function hasError(issues: readonly SpecIssue[]): boolean {
  return issues.some((issue) => issue.severity !== "warning");
}

function checkValue(f: AnyField, value: unknown, path: string, issues: SpecIssue[]): void {
  if (value === null) {
    if (!f.nullable) wrongType(f, path, issues);
    return;
  }
  switch (f.kind) {
    case "string":
    case "color":
      if (typeof value !== "string") return wrongType(f, path, issues);
      if (f.kind === "string") rangeIssue(path, "a length", value.length, f.min, f.max, issues);
      return;
    case "number":
    case "integer":
      if (typeof value !== "number" || !Number.isFinite(value)) return wrongType(f, path, issues);
      if (f.kind === "integer" && !Number.isInteger(value)) return wrongType(f, path, issues);
      rangeIssue(path, "a value", value, f.min, f.max, issues);
      return;
    case "boolean":
      if (typeof value !== "boolean") wrongType(f, path, issues);
      return;
    case "enum":
      if (!f.values.includes(value as string | number | boolean)) {
        issues.push({
          path,
          code: "not-in-enum",
          message: `${quote(path)} must be one of ${listValues(f.values)}.`,
        });
      }
      return;
    case "responsive": {
      if (!isRecord(value) || !("base" in value)) return checkValue(f.of, value, path, issues);
      for (const key of Object.keys(value)) {
        if (value[key] === undefined) continue;
        if (key !== "base" && !f.breakpoints.includes(key)) {
          issues.push({
            path: join(path, key),
            code: "unknown-prop",
            message: `"${key}" is not a breakpoint here; use "base" or one of ${listValues(f.breakpoints)}.`,
          });
          continue;
        }
        checkValue(f.of, value[key], join(path, key), issues);
      }
      return;
    }
    case "object": {
      if (!isRecord(value)) return wrongType(f, path, issues);
      for (const key of Object.keys(f.fields)) {
        const sub = f.fields[key];
        if (!sub) continue;
        if (value[key] === undefined) {
          if (sub.required) {
            issues.push({
              path: join(path, key),
              code: "missing-prop",
              message: `"${join(path, key)}" is required.`,
            });
          }
          continue;
        }
        checkValue(sub, value[key], join(path, key), issues);
      }
      if (!f.open) {
        for (const key of Object.keys(value)) {
          if (Object.hasOwn(f.fields, key) || value[key] === undefined) continue;
          issues.push({
            path: join(path, key),
            code: "unknown-prop",
            message: `"${key}" is not a key of ${quote(path)}.`,
          });
        }
      }
      return;
    }
    case "array":
      if (!Array.isArray(value)) return wrongType(f, path, issues);
      rangeIssue(path, "a number of items", value.length, f.min, f.max, issues);
      value.forEach((item, index) => checkValue(f.of, item, `${path}[${index}]`, issues));
      return;
    case "union": {
      for (const member of f.of) {
        const scratch: SpecIssue[] = [];
        checkValue(member, value, path, scratch);
        if (!hasError(scratch)) return;
      }
      wrongType(f, path, issues);
      return;
    }
  }
}

/**
 * Validates `input` against `def`. Never throws. `ok` is true when no issue
 * is an error; `value` is then `input` itself (defaults are not filled — use
 * `resolveProps` for that).
 */
export function validateProps<D extends AnyComponentDefinition>(
  def: D,
  input: unknown,
  options: ValidateOptions = {},
): ValidationResult<PropsOf<D>> {
  const base = options.path ?? "";
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          path: base,
          code: "not-an-object",
          message: `${quote(base)} must be an object of props.`,
        },
      ],
    };
  }
  const plan = planOf(def);
  const issues: SpecIssue[] = [];

  for (const key of Object.keys(input)) {
    const value = input[key];
    if (value === undefined || plan.codeOnly.has(key)) continue;
    const path = join(base, key);
    const effective = plan.byKey.get(key);
    if (effective) {
      const deprecated = effective.field.deprecated;
      if (deprecated) {
        const use = deprecated.replacement ? ` Use "${deprecated.replacement}".` : "";
        issues.push({
          path,
          code: "deprecated-prop",
          severity: "warning",
          message: `"${key}" is deprecated since ${deprecated.since} and will be removed in ${deprecated.removeIn}.${use}`,
        });
      }
      checkValue(effective.field, value, path, issues);
      continue;
    }
    const alias = plan.aliasByFrom.get(key);
    if (alias) {
      const since = alias.since ? ` since ${alias.since}` : "";
      issues.push({
        path,
        code: "deprecated-prop",
        severity: "warning",
        message: `"${key}" is deprecated${since} and will be removed in ${alias.removeIn}. Use "${alias.to}".`,
      });
      const target = plan.byKey.get(alias.to);
      if (alias.transform === "identity") {
        if (target) checkValue(target.field, value, path, issues);
      } else if (typeof value !== "boolean") {
        issues.push({ path, code: "wrong-type", message: `${quote(path)} must be true or false.` });
      }
      continue;
    }
    issues.push({
      path,
      code: "unknown-prop",
      message: `"${key}" is not a prop of ${def.label}.`,
    });
  }

  for (const f of plan.fields) {
    if (!f.field.required || f.field.deprecated || input[f.key] !== undefined) continue;
    const viaAlias = plan.aliases.some((row) => row.to === f.key && input[row.from] !== undefined);
    if (viaAlias) continue;
    const path = join(base, f.key);
    issues.push({ path, code: "missing-prop", message: `"${path}" is required.` });
  }

  return hasError(issues)
    ? { ok: false, issues }
    : { ok: true, value: input as PropsOf<D>, issues };
}
