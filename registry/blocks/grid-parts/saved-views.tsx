/**
 * Saved views for any DataGrid — the "Views" menu an analyst expects.
 *
 * A view is a versioned `GridState` document (`serializeGridState`), so the same
 * JSON can live in a database row, a URL or an agent's reply. Applying one runs
 * it through `parseGridState` (which migrates old snapshots and drops what no
 * longer fits) and remounts the grid with it as `initialView` — the grid stays
 * uncontrolled, and the current view is read back from the toolbar's table.
 */
"use client";

import { useCallback, useState } from "react";
import { Bookmark, Check, ChevronDown, Copy, Save } from "lucide-react";
import {
  parseGridState,
  serializeGridState,
  type DataTableViewState,
  type GridState,
  type Table,
} from "@elabs-ai/components-data";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  toast,
} from "@elabs-ai/components-ui";

export interface SavedView {
  id: string;
  name: string;
  /** A `GridState` document — or any older snapshot `parseGridState` can migrate. */
  state: GridState | Record<string, unknown>;
  /** Shipped with the screen (cannot be overwritten by "Save"). */
  builtIn?: boolean;
}

/** The view slices worth saving — layout and query, never transient focus. */
const VIEW_KEYS = [
  "sorting",
  "columnFilters",
  "columnVisibility",
  "columnOrder",
  "columnPinning",
  "columnSizing",
  "grouping",
  "globalFilter",
] as const;

/** Reads the current view off the toolbar's table instance as a `GridState`. */
export function currentGridState<T extends object>(table: Table<T>): GridState {
  const all = table.getState() as unknown as Record<string, unknown>;
  const view: Record<string, unknown> = {};
  for (const key of VIEW_KEYS) if (all[key] !== undefined) view[key] = all[key];
  return serializeGridState(view as unknown as DataTableViewState);
}

/**
 * Holds the view list and which one is applied. Give the DataGrid
 * `key={gridKey}` (it remounts when a view is applied) and
 * `initialView={initialView}` (which seeds it).
 */
export function useSavedViews(initial: readonly SavedView[], initialId = initial[0]?.id) {
  const [views, setViews] = useState<SavedView[]>(() => [...initial]);
  const [activeId, setActiveId] = useState(initialId);
  const [revision, setRevision] = useState(0);
  const active = views.find((view) => view.id === activeId);

  const apply = useCallback((id: string) => {
    setActiveId(id);
    setRevision((r) => r + 1);
  }, []);

  const save = useCallback((name: string, state: GridState) => {
    const id = `view-${Date.now().toString(36)}`;
    setViews((current) => [...current, { id, name, state }]);
    setActiveId(id);
  }, []);

  const parsed = active ? parseGridState(active.state) : undefined;
  return {
    views,
    active,
    apply,
    save,
    /** Slices the saved view had to drop (e.g. a column that no longer exists). */
    dropped: parsed?.dropped ?? [],
    /** Pass as the DataGrid's `key`: it changes when a view is applied, which remounts the grid. */
    gridKey: `${activeId}:${revision}`,
    /** Pass as the DataGrid's `initialView`. */
    initialView: parsed?.state,
  };
}

export interface SavedViewsMenuProps<T extends object> {
  table: Table<T>;
  views: readonly SavedView[];
  activeId?: string;
  onApply: (id: string) => void;
  onSave: (name: string, state: GridState) => void;
}

export function SavedViewsMenu<T extends object>({
  table,
  views,
  activeId,
  onApply,
  onSave,
}: SavedViewsMenuProps<T>) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const active = views.find((view) => view.id === activeId);

  const copyJson = async () => {
    const json = JSON.stringify(currentGridState(table), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast.success("View copied as JSON", {
        description: "A versioned GridState — paste it into a saved-views table or a prompt.",
      });
    } catch {
      toast.error("Could not reach the clipboard");
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, currentGridState(table));
    setNaming(false);
    setName("");
    toast.success(`Saved “${trimmed}”`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" data-slot="saved-views-trigger">
            <Bookmark aria-hidden="true" />
            <span className="max-w-40 truncate">{active?.name ?? "Views"}</span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-60">
          <DropdownMenuLabel>Saved views</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={activeId} onValueChange={onApply}>
            {views.map((view) => (
              <DropdownMenuRadioItem key={view.id} value={view.id}>
                {view.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNaming(true)}>
            <Save aria-hidden="true" />
            Save current view…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={copyJson}>
            <Copy aria-hidden="true" />
            Copy view as JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Save view</DialogTitle>
              <DialogDescription>
                Keeps the sort, filters, grouping and column layout you have now.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="saved-view-name">Name</Label>
              <Input
                id="saved-view-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Open items over $10k"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNaming(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={name.trim() === ""}>
                <Check aria-hidden="true" />
                Save view
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
