/**
 * DG-23 — which diagrams use a component (`ref: ws/components/<file name>`), and the small pure
 * reads the components panel needs. React-free (`conventions/logic-modules`); `component-panel.tsx`
 * turns this into UI.
 *
 * Usage comes from a TEXT scan across every diagram file (dialect v1's reference form; the
 * retired `use:` key is not scanned for). This is independent of whether the file compiles —
 * dialect v1 does not compile until DG-26, so `component.description` is also read as plain YAML
 * (`yaml`'s `parseDocument`), not through the app's dialect-versioned compiler.
 */
import { parseDocument } from "yaml";
import { fileTitle } from "../shell/mode-store";
import { readFile, type WorkspaceTree } from "../workspace/client";

/**
 * A `ref:` naming a component (dialect v1, `ws/components/<name>[.yaml|.yml]`), matched at line
 * start (optionally after a list dash) or inline after `{`/`,` (a flow-style node), quoted or
 * not. Component names may contain spaces (dialect v1 allows them); an unquoted value ends at
 * `,`, `}`, `#` or end of line. A commented-out line (`# ref: …`) matches neither anchor.
 */
const REF_LINE =
  /(?:^[\t ]*(?:-[\t ]+)?|[{,][\t ]*)ref:[\t ]*(?:"ws\/components\/([^"]+)"|'ws\/components\/([^']+)'|ws\/components\/([^,}#\r\n]+))/gm;

/** `components/qlik-cloud-tenant.yaml` → `qlik-cloud-tenant` (what a `ref:` target names). */
export function componentStem(path: string): string {
  return path.replace(/^components\//, "").replace(/\.ya?ml$/i, "");
}

/** The distinct component targets a diagram's text names; a repeated `ref:` counts once. */
export function refTargets(text: string): Set<string> {
  const targets = new Set<string>();
  for (const match of text.matchAll(REF_LINE)) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (raw !== "") targets.add(raw.replace(/\.ya?ml$/i, ""));
  }
  return targets;
}

/** The top-level `component.description`, read as plain YAML (no dialect-version check). */
export function componentDescription(text: string): string {
  try {
    const raw = parseDocument(text).toJS() as { component?: { description?: unknown } } | null;
    const description = raw?.component?.description;
    return typeof description === "string" ? description.trim() : "";
  } catch {
    return "";
  }
}

/** One diagram that a component's `ref:` line names. */
export interface ComponentUsage {
  path: string;
  title: string;
}

export interface ComponentEntry {
  path: string;
  title: string;
  description: string;
  hasThumb: boolean;
  mtime: number;
  /** Diagrams whose text has a `ref:` naming this component, in tree order; never a duplicate. */
  usedIn: ComponentUsage[];
}

async function readText(path: string): Promise<string> {
  try {
    return (await readFile(path)).text;
  } catch {
    // Unreadable (gone between /tree and the read): treated as empty — no description, no refs.
    return "";
  }
}

/** Every file under `components/`: its description, thumbnail, and which diagrams use it. */
export async function buildComponentEntries(tree: WorkspaceTree): Promise<ComponentEntry[]> {
  const componentFiles = tree.files.filter((file) => file.kind === "component");
  const diagramFiles = tree.files.filter((file) => file.kind === "diagram");
  const [componentTexts, diagramTexts] = await Promise.all([
    Promise.all(componentFiles.map((file) => readText(file.path))),
    Promise.all(diagramFiles.map((file) => readText(file.path))),
  ]);
  const usedIn = new Map<string, ComponentUsage[]>();
  diagramFiles.forEach((file, i) => {
    const title = file.title?.trim() || fileTitle(file.path);
    for (const target of refTargets(diagramTexts[i] ?? "")) {
      usedIn.set(target, [...(usedIn.get(target) ?? []), { path: file.path, title }]);
    }
  });
  return componentFiles.map((file, i) => ({
    path: file.path,
    title: file.title?.trim() || fileTitle(file.path),
    description: componentDescription(componentTexts[i] ?? ""),
    hasThumb: file.hasThumb,
    mtime: file.mtime,
    usedIn: usedIn.get(componentStem(file.path)) ?? [],
  }));
}
