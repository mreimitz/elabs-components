/**
 * DG-23 — the components panel (R1 scope box, kept): every file under `workspace/components/`,
 * its thumbnail, its `component.description` when the file has one, and "Used in N diagrams".
 * The usage scan itself is `component-usage.ts` (React-free); this file is the view on top of it.
 */
import { useEffect, useId, useState } from "react";
import {
  Image,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatePanel,
  Text,
} from "@elabs-ai/components-ui";
import { Boxes, ChevronDown } from "lucide-react";
import { buildComponentEntries, type ComponentEntry } from "./component-usage";
import { NoPreview } from "./no-preview";
import { RECENT_LABELS } from "./recent-card";
import { thumbSrc } from "./thumbnail";
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
  const headingId = useId();
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
        {/* Colour alone (text-primary-text) does not tell this apart from the static "Not used
            yet" line above — a chevron and an at-rest underline are the second, non-colour cue. */}
        <button
          type="button"
          className="flex w-fit min-h-6 items-center gap-1 rounded-sm text-meta text-primary-text underline decoration-from-font underline-offset-2 focus-ring"
        >
          {COMPONENTS_LABELS.usedIn(count)}
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-labelledby={headingId}>
        <Text id={headingId} variant="caption" tone="muted" className="mb-2">
          {COMPONENTS_LABELS.usedInHeading(entry.title)}
        </Text>
        <ul className="flex flex-col gap-1">
          {entry.usedIn.map((usage) => (
            <li key={usage.path}>
              <a
                href={toHash({ kind: "doc", path: usage.path })}
                className="block max-w-full rounded-sm text-body text-foreground hover:text-primary-text focus-ring"
              >
                <span className="line-clamp-2 break-words">{usage.title}</span>
                {/* The folder tells apart two same-titled diagrams — the same "Workspace" root
                    wording as `RecentCard`. A copy's own title also carries a "(copy)"/"(copy N)"
                    suffix (`titleWithCopySuffix`), so two copies in the same folder differ too. */}
                <Text as="span" variant="meta" tone="muted" className="block truncate">
                  {usage.folder === "" ? RECENT_LABELS.root : usage.folder}
                </Text>
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
    <div
      aria-hidden="true"
      className="aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-surface-muted"
    >
      <Image
        src={thumbSrc(entry.path, entry.hasThumb, entry.mtime)}
        alt=""
        aspectRatio={16 / 9}
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

/**
 * `StatePanel kind="empty"` with no components; else a list — thumbnail, name, "Used in N".
 * When the tree failed to load, this renders nothing: Home shows the one `TreeErrorPanel` for
 * the whole page once, not a second one per section.
 */
export function ComponentsPanel({ tree, treeError }: ComponentsPanelProps) {
  const { loading, entries } = useComponentEntries(tree);
  if (tree === null && treeError !== null) return null;
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
              className="w-fit max-w-full truncate rounded-sm text-body font-medium text-foreground focus-ring"
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
