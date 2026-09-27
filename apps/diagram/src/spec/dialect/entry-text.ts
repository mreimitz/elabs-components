/**
 * DG-35 — new list items as YAML text for `appendEntries`, in the forms a person writes:
 * a node as a block map, a flow as `- a -> b`, `- a -> b: Label` or
 * `- a -> b: { label: …, kind: … }`. React-free.
 */
import { yamlScalar } from "./write-back";

export type NewEntryValue = string | number | boolean | readonly string[];

function value(v: NewEntryValue, flow: boolean): string {
  if (Array.isArray(v)) return `[${v.map((item) => yamlScalar(item, true)).join(", ")}]`;
  return yamlScalar(v as string | number | boolean, flow);
}

/** `{ id: "api", title: "API", badges: ["pii"] }` → `- id: api\n  title: API\n  badges: [pii]\n` (id first). */
export function nodeItem(fields: Readonly<Record<string, NewEntryValue>>): string {
  const keys = Object.keys(fields).sort((a, b) => Number(b === "id") - Number(a === "id"));
  return keys
    .map(
      (key, i) => `${i === 0 ? "- " : "  "}${key}: ${value(fields[key] as NewEntryValue, false)}\n`,
    )
    .join("");
}

export interface NewFlow {
  from: string;
  to: string;
  /** `both` writes `<->`. */
  direction?: "forward" | "both";
  label?: string;
  [key: string]: NewEntryValue | undefined;
}

/** A flow in the shortest form that holds its keys. */
export function flowItem(flow: NewFlow): string {
  const { from, to, direction, label, ...rest } = flow;
  const arrow = `${from} ${direction === "both" ? "<->" : "->"} ${to}`;
  const keys = Object.entries(rest).filter(
    (entry): entry is [string, NewEntryValue] => entry[1] !== undefined,
  );
  if (keys.length === 0)
    return label === undefined ? `- ${arrow}\n` : `- ${arrow}: ${value(label, false)}\n`;
  const all: [string, NewEntryValue][] = label === undefined ? keys : [["label", label], ...keys];
  return `- ${arrow}: { ${all.map(([k, v]) => `${k}: ${value(v, true)}`).join(", ")} }\n`;
}
