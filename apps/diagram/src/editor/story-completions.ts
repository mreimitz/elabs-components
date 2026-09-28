import { parseDocument } from "yaml";
import { normalizeArch } from "../spec/dialect/normalize";
import { parseArchYaml } from "../spec/dialect/parse";

/** Use the current buffer, so a newly added flow is suggested before the next draw. */
export function storyFlowCompletions(text: string): { value: string; label?: string }[] {
  // Read only flows: an unfinished story scalar must not remove complete flow suggestions.
  // toJS can reject an unresolved alias while the user is typing; that buffer has no candidates.
  let raw: unknown;
  try {
    raw = parseDocument(text).toJS();
  } catch {
    return [];
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const source = parseArchYaml('diagram: "1"\n');
  const ast = normalizeArch(
    { diagram: "1", flows: (raw as Record<string, unknown>).flows ?? [] },
    source.sourceMap,
  ).ast;
  const entries = new Map<string, { value: string; label?: string }[]>();
  for (const flow of ast?.flows ?? []) {
    const arrow = flow.direction === "back" ? "<-" : flow.direction === "both" ? "<->" : "->";
    const value = `${flow.from} ${arrow} ${flow.to}`;
    const ends =
      flow.direction === "both"
        ? [flow.from, flow.to].sort()
        : flow.direction === "back"
          ? [flow.to, flow.from]
          : [flow.from, flow.to];
    const identity = JSON.stringify([flow.direction === "both" ? "both" : "forward", ...ends]);
    entries.set(identity, [...(entries.get(identity) ?? []), { value, label: flow.label }]);
  }
  // An endpoint expression cannot distinguish parallel flows. Do not suggest an ambiguous target.
  return [...entries.values()].filter((items) => items.length === 1).map((items) => items[0]!);
}

export const STORY_STEP_SNIPPET =
  "title: ${1:Step title}\ntargets: [${2:node}]\ntext: ${3:Explain this step.}\nduration: 8$0";
