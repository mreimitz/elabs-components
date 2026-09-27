/**
 * DG-23 — the components panel (R1 scope box, kept): every file under `workspace/components/`,
 * its thumbnail, its `component.description` when the file has one, and "Used in N diagrams".
 * The usage scan itself is `component-usage.ts` (React-free); this file is the view on top of it.
 */
import { useEffect, useState } from "react";
import {
  Image,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatePanel,
  Text,
} from "@elabs-ai/components-ui";
import { Boxes } from "lucide-react";
import { buildComponentEntries, type ComponentEntry } from "./component-usage";
import { NoPreview } from "./no-preview";
import { thumbSrc } from "./thumbnail";
import { TreeErrorPanel } from "./tree-error-panel";
import { toHash } from "../routes/use-hash";
import type { WorkspaceTree } from "../workspace/client";

/** The panel's strings, in one place (`conventions/i18n-strings`). */
export const COMPONENTS_LABELS = {
  empty: "No components yet",
  emptyHint: "A diagram saved under components/ becomes a component that other diagrams can reuse.",
  usedIn: (n: number) => (n === 1 ? "Used in 1 diagram" : `Used in ${n} diagrams`),
  usedInNone: "Not used yet",
  usedInHeading: (name: string) => `Diagrams using ${name}`,
} as const;

/** The panel's data: rebuilt whenever the tree changes (live reload refreshes it). */
function useComponentEntries(tree: WorkspaceTree | null): {
  loading: boolean;
  entries: ComponentEntry[];
} {
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
          {entry.usedIn.map((usage) => (
            <li key={usage.path}>
              <a
                href={toHash({ kind: "doc", path: usage.path })}
                className="rounded-sm text-body text-foreground hover:text-primary-text focus-ring"
              >
                {usage.title}
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
    <div className="size-24 shrink-0 overflow-hidden rounded-md bg-surface-muted">
      <Image
        src={thumbSrc(entry.path, entry.hasThumb, entry.mtime)}
        alt=""
        aspectRatio={1}
        fit="contain"
        loading="lazy"
        decoding="async"
        fallback={<NoPreview icon={Boxes} />}
      />
    </div>
  );
}

export interface ComponentsPanelProps {
  tree: WorkspaceTree | null;
  treeError: string | null;
}

/** `StatePanel kind="empty"` with no components; else a list — thumbnail, name, "Used in N". */
export function ComponentsPanel({ tree, treeError }: ComponentsPanelProps) {
  const { loading, entries } = useComponentEntries(tree);
  if (tree === null && treeError !== null) return <TreeErrorPanel message={treeError} />;
  if (tree === null || loading) return <StatePanel kind="loading" titleAs="h3" />;
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
