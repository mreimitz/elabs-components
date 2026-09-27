/**
 * DG-23 — the components panel (R1 scope box, kept): every file under `workspace/components/`,
 * its thumbnail, its `component.description` when the file has one, and "Used in N diagrams".
 *
 * Usage comes from a TEXT scan for `ref: ws/components/<file name>` across every diagram file
 * (dialect v1's reference form; the retired `use:` key is not scanned for). This is independent
 * of whether the file compiles — dialect v1 does not compile until DG-26, so a component's own
 * `component.description` is also read as plain YAML (`yaml`'s `parseDocument`), not through the
 * app's dialect-versioned compiler.
 */
import { useEffect, useState } from "react";
import { parseDocument } from "yaml";
import {
  Image,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatePanel,
  Text,
} from "@elabs-ai/components-ui";
import { Boxes } from "lucide-react";
import { toHash } from "../routes/use-hash";
import { fileTitle } from "../shell/mode-store";
import { readFile, type WorkspaceTree } from "../workspace/client";
import { useWorkspace } from "../workspace/workspace-store";
import { thumbSrc } from "./thumbnail";

/** The panel's strings, in one place (`conventions/i18n-strings`). */
export const COMPONENTS_LABELS = {
  empty: "No components yet",
  emptyHint: "A diagram saved under components/ becomes a component that other diagrams can reuse.",
  usedIn: (n: number) => (n === 1 ? "Used in 1 diagram" : `Used in ${n} diagrams`),
  usedInNone: "Not used yet",
  usedInHeading: (name: string) => `Diagrams using ${name}`,
} as const;

/** A `ref:` line naming a component (dialect v1, `ws/components/<name>[.yaml|.yml]`, quoted or not). */
const REF_LINE = /^[\t ]*(?:-[\t ]+)?ref:[\t ]*["']?ws\/components\/([^"'\s#]+)/gm;

/** `components/qlik-cloud-tenant.yaml` → `qlik-cloud-tenant` (what a `ref:` target names). */
function componentStem(path: string): string {
  return path.replace(/^components\//, "").replace(/\.ya?ml$/i, "");
}

function refTargets(text: string): string[] {
  return [...text.matchAll(REF_LINE)].map((match) => (match[1] ?? "").replace(/\.ya?ml$/i, ""));
}

/** The top-level `component.description`, read as plain YAML (no dialect-version check). */
function componentDescription(text: string): string {
  try {
    const raw = parseDocument(text).toJS() as { component?: { description?: unknown } } | null;
    const description = raw?.component?.description;
    return typeof description === "string" ? description.trim() : "";
  } catch {
    return "";
  }
}

export interface ComponentEntry {
  path: string;
  title: string;
  description: string;
  hasThumb: boolean;
  mtime: number;
  /** Diagram paths whose text has a `ref:` naming this component. */
  usedIn: string[];
}

async function readText(path: string): Promise<string> {
  try {
    return (await readFile(path)).text;
  } catch {
    // Unreadable (gone between /tree and the read): treated as empty — no description, no refs.
    return "";
  }
}

async function buildComponentEntries(tree: WorkspaceTree): Promise<ComponentEntry[]> {
  const componentFiles = tree.files.filter((file) => file.kind === "component");
  const diagramFiles = tree.files.filter((file) => file.kind === "diagram");
  const [componentTexts, diagramTexts] = await Promise.all([
    Promise.all(componentFiles.map((file) => readText(file.path))),
    Promise.all(diagramFiles.map((file) => readText(file.path))),
  ]);
  const usedIn = new Map<string, string[]>();
  diagramFiles.forEach((file, i) => {
    for (const target of refTargets(diagramTexts[i] ?? "")) {
      usedIn.set(target, [...(usedIn.get(target) ?? []), file.path]);
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

/** The components panel's data: rebuilt whenever the tree changes (live reload refreshes it). */
function useComponentEntries(): { loading: boolean; entries: ComponentEntry[] } {
  const tree = useWorkspace((s) => s.tree);
  const [state, setState] = useState<{ loading: boolean; entries: ComponentEntry[] }>({
    loading: true,
    entries: [],
  });
  useEffect(() => {
    if (!tree) return;
    let cancelled = false;
    void buildComponentEntries(tree).then((entries) => {
      if (!cancelled) setState({ loading: false, entries });
    });
    return () => {
      cancelled = true;
    };
  }, [tree]);
  return state;
}

function UsedIn({ entry }: { entry: ComponentEntry }) {
  const count = entry.usedIn.length;
  if (count === 0) {
    return (
      <Text variant="meta" tone="muted">
        {COMPONENTS_LABELS.usedInNone}
      </Text>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-fit rounded-sm text-meta text-primary-text hover:underline focus-ring"
        >
          {COMPONENTS_LABELS.usedIn(count)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <Text variant="caption" tone="muted" className="mb-2">
          {COMPONENTS_LABELS.usedInHeading(entry.title)}
        </Text>
        <ul className="flex flex-col gap-1">
          {entry.usedIn.map((path) => (
            <li key={path}>
              <a
                href={toHash({ kind: "doc", path })}
                className="rounded-sm text-body text-foreground hover:text-primary-text focus-ring"
              >
                {fileTitle(path)}
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function ComponentThumb({ entry }: { entry: ComponentEntry }) {
  return (
    <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
      <Image
        src={thumbSrc(entry.path, entry.hasThumb, entry.mtime)}
        alt=""
        aspectRatio={1}
        fit="contain"
        loading="lazy"
        decoding="async"
        fallback={
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Boxes aria-hidden="true" className="size-6" />
          </span>
        }
      />
    </div>
  );
}

/** `StatePanel kind="empty"` with no components; else a list — thumbnail, name, "Used in N". */
export function ComponentsPanel() {
  const { loading, entries } = useComponentEntries();
  if (loading) return <StatePanel kind="loading" titleAs="h3" />;
  if (entries.length === 0) {
    return (
      <StatePanel
        kind="empty"
        icon={<Boxes aria-hidden="true" />}
        titleAs="h3"
        title={COMPONENTS_LABELS.empty}
        description={COMPONENTS_LABELS.emptyHint}
      />
    );
  }
  return (
    <ul className="divide-y divide-border-strong">
      {entries.map((entry) => (
        <li key={entry.path} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
          <ComponentThumb entry={entry} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <a
              href={toHash({ kind: "doc", path: entry.path })}
              className="w-fit truncate rounded-sm text-body font-medium text-foreground focus-ring"
            >
              {entry.title}
            </a>
            {entry.description !== "" ? (
              <Text variant="caption" tone="muted" className="line-clamp-2">
                {entry.description}
              </Text>
            ) : null}
            <UsedIn entry={entry} />
          </div>
        </li>
      ))}
    </ul>
  );
}
