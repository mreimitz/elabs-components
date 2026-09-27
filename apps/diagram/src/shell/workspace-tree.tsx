/**
 * DG-22 — the workspace folder tree in the sidebar, under the rail's "Workspace" entry (plan
 * §3.1, item step 2). Folders collapse (`Collapsible` + `SidebarMenuSub`); a file is a link to
 * `#d/<path>` that opens it in a tab. Every row has a "…" menu (also on right-click): New diagram
 * here, New folder, Rename, Move to, Trash. Dragging a file onto a folder moves it there.
 * Everything goes through DG-21's `workspaceActions`; tabs follow a move (`modeActions.moved`).
 *
 * DG-23 (Home's folder tree) can reuse `buildTree` and `WorkspaceTree`.
 */
import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type MouseEvent,
} from "react";
import {
  ChevronRight,
  Ellipsis,
  FilePlus,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  PencilLine,
  Trash2,
} from "lucide-react";
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Label,
  SidebarMenuAction,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  StatePanel,
  cn,
  toast,
  useSidebar,
} from "@elabs-ai/components-ui";
import { createStore } from "../state/create-store";
import { toHash, useRoute } from "../routes/use-hash";
import type { WorkspaceFile, WorkspaceTree as WorkspaceTreeData } from "../workspace/client";
import { folderOf, useWorkspace, workspaceActions } from "../workspace/workspace-store";
import {
  activeElement,
  docTabElement,
  focusDocTab,
  focusSoon,
  TREE_PATH_ATTR,
  treeRowElement,
} from "./focus";
import { fileTitle, modeActions, openDoc } from "./mode-store";

/** The tree's strings, in one place (`conventions/i18n-strings`). */
const TREE_LABELS = {
  loading: "Loading the workspace…",
  loadFailed: "Could not load the workspace",
  retry: "Retry",
  retrying: "Retrying…",
  actions: (name: string) => `Actions for ${name}`,
  rootActions: "Workspace actions",
  newDiagram: "New diagram here",
  newFolder: "New folder",
  // Rename changes the file (or folder) name, never the diagram's `title:` (DG-22 review).
  renameFile: "Rename file…",
  renameFolder: "Rename folder…",
  moveTo: "Move to",
  root: "Workspace (top level)",
  trash: "Trash",
  newDiagramTitle: "New diagram",
  newDiagramField: "Title",
  newFolderTitle: "New folder",
  newFolderField: "Folder name",
  renameFileTitle: "Rename file",
  renameFolderTitle: "Rename folder",
  renameFileDescription: (title: string, name: string, folder: string) =>
    `“${title}” is saved as ${name} ${folder === "" ? "in the workspace root" : `in ${folder}/`}. This renames the file; the diagram’s title stays.`,
  fileNameField: "File name",
  inFolder: (folder: string) => (folder === "" ? "In the workspace root." : `In ${folder}/.`),
  /** A file row's hover text: the title is truncated in the tree, and the row shows no file. */
  rowHover: (title: string, name: string) => `${title}\n${name}`,
  create: "Create",
  save: "Rename",
  cancel: "Cancel",
  invalidName: "A name cannot be empty or contain “/”.",
  trashTitle: (name: string) => `Move “${name}” to the trash?`,
  trashDescription:
    "It moves to _trash/ in the workspace folder, where Git or your file manager can bring it back. Its open tabs close.",
  trashConfirm: "Move to trash",
  keep: "Keep it",
  failed: (action: string, path: string) => `Could not ${action} “${path}”`,
} as const;

/** `dataTransfer` type of a dragged tree file. */
const TREE_DRAG_TYPE = "application/x-atlas-workspace-path";

// ── The tree model ────────────────────────────────────────────────────────────────────

export interface TreeFolder {
  kind: "folder";
  name: string;
  /** Workspace-relative; `""` is the root. */
  path: string;
  children: TreeEntry[];
}

export interface TreeFile {
  kind: "file";
  name: string;
  path: string;
  /** The YAML `title:`, else the file name without `.yaml`. */
  title: string;
  file: WorkspaceFile;
}

export type TreeEntry = TreeFolder | TreeFile;

const join = (folder: string, name: string) => (folder === "" ? name : `${folder}/${name}`);
const baseName = (path: string) => path.split("/").pop() ?? path;

/** The flat service tree → nested entries; folders first, then files, each by name. */
export function buildTree(tree: WorkspaceTreeData): TreeEntry[] {
  const root: TreeFolder = { kind: "folder", name: "", path: "", children: [] };
  const folders = new Map<string, TreeFolder>([["", root]]);
  const folderAt = (path: string): TreeFolder => {
    const found = folders.get(path);
    if (found) return found;
    const folder: TreeFolder = { kind: "folder", name: baseName(path), path, children: [] };
    folders.set(path, folder);
    folderAt(folderOf(path)).children.push(folder);
    return folder;
  };
  tree.folders.forEach(folderAt);
  for (const file of tree.files) {
    folderAt(folderOf(file.path)).children.push({
      kind: "file",
      name: baseName(file.path),
      path: file.path,
      title: file.title?.trim() || fileTitle(file.path),
      file,
    });
  }
  const order = (a: TreeEntry, b: TreeEntry) =>
    a.kind !== b.kind ? (a.kind === "folder" ? -1 : 1) : a.name.localeCompare(b.name);
  const sort = (entries: TreeEntry[]) => {
    entries.sort(order);
    entries.forEach((entry) => entry.kind === "folder" && sort(entry.children));
  };
  sort(root.children);
  return root.children;
}

// ── Dialog state, shared by every row and the root menu ───────────────────────────────

type TreeRequest =
  | { kind: "new-diagram"; folder: string }
  | { kind: "new-folder"; folder: string }
  /** `title`: the diagram's title, for a file (a folder has none). */
  | { kind: "rename"; path: string; title?: string }
  | { kind: "trash"; path: string };

const treeUi = createStore<{ request: TreeRequest | null; serial: number }>({
  request: null,
  serial: 0,
});

/**
 * Where focus goes back to once a dialog closes (ConfirmDialog / Dialog have no trigger): the
 * "…" button whose menu asked. The menu passes it in, because by the time an item's `onSelect`
 * runs, `document.activeElement` is the menu item, which unmounts with the menu (DG-22 review).
 */
let returnFocusTo: HTMLElement | null = null;

function ask(request: TreeRequest, trigger: HTMLElement | null) {
  returnFocusTo = trigger ?? activeElement();
  treeUi.set((s) => ({ request, serial: s.serial + 1 }));
}

/** Close the dialog. Focus goes to `to`, else back to the "…" that opened it. */
function dismiss(to?: () => HTMLElement | null) {
  treeUi.set({ request: null });
  const back = returnFocusTo;
  // P4: library gap — H-24: a trigger-less dialog returns focus to <body>; hand it on.
  focusSoon(to ?? (() => back), () => (back?.isConnected ? back : treeRowElement("")));
}

/**
 * An entry is new or has a new path (rename, move): focus its tab when it has one, else its
 * row once the refreshed tree shows it, else `fallback` (a collapsed folder hides the row).
 */
function focusEntry(path: string, fallback: () => HTMLElement | null) {
  focusSoon(() => docTabElement(path) ?? treeRowElement(path), fallback);
}

function fail(action: string, path: string) {
  return (error: unknown) =>
    toast.error(TREE_LABELS.failed(action, path), {
      description: error instanceof Error ? error.message : String(error),
    });
}

async function moveInto(path: string, folder: string) {
  if (folderOf(path) === folder) return;
  try {
    const to = await workspaceActions.move(path, join(folder, baseName(path)));
    modeActions.moved(path, to);
    // The row remounts at its new path; the old one, with the focused "…", is gone. Its new
    // folder's row, when that folder is collapsed.
    focusSoon(
      () => treeRowElement(to),
      () => treeRowElement(folder),
    );
  } catch (error) {
    fail("move", path)(error);
  }
}

// ── Rows ──────────────────────────────────────────────────────────────────────────────

interface RowMenuProps {
  entry: TreeEntry;
  folders: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The row's "…" menu (right-click opens it too). */
function RowMenu({ entry, folders, open, onOpenChange }: RowMenuProps) {
  const folder = entry.kind === "folder" ? entry.path : folderOf(entry.path);
  const parent = folderOf(entry.path);
  // Not its own folder, not itself, not inside itself.
  const targets = ["", ...folders].filter(
    (f) => f !== parent && f !== entry.path && !f.startsWith(`${entry.path}/`),
  );
  const label = entry.kind === "file" ? entry.title : entry.name;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const request = (next: TreeRequest) => ask(next, triggerRef.current);
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="icon-sm"
          aria-label={TREE_LABELS.actions(label)}
          className="absolute end-0.5 top-0.5 size-6 opacity-0 group-hover/tree-row:opacity-100 group-focus-within/tree-row:opacity-100 data-[state=open]:opacity-100"
        >
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" collisionPadding={8}>
        <DropdownMenuItem onSelect={() => request({ kind: "new-diagram", folder })}>
          <FilePlus aria-hidden="true" />
          {TREE_LABELS.newDiagram}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => request({ kind: "new-folder", folder })}>
          <FolderPlus aria-hidden="true" />
          {TREE_LABELS.newFolder}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() =>
            request({
              kind: "rename",
              path: entry.path,
              title: entry.kind === "file" ? entry.title : undefined,
            })
          }
        >
          <PencilLine aria-hidden="true" />
          {entry.kind === "file" ? TREE_LABELS.renameFile : TREE_LABELS.renameFolder}
        </DropdownMenuItem>
        <DropdownMenuSub>
          {/* P4: library gap — H-30: the sub-trigger does not size an icon; text only. */}
          <DropdownMenuSubTrigger inset disabled={targets.length === 0}>
            {TREE_LABELS.moveTo}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            collisionPadding={8}
            className="max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto"
          >
            {targets.map((target) => (
              <DropdownMenuItem key={target} onSelect={() => void moveInto(entry.path, target)}>
                <FolderInput aria-hidden="true" />
                {target === "" ? TREE_LABELS.root : `${target}/`}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {/* P4: library gap — DropdownMenuItem has no destructive variant; the Trash item
            relies on its icon, its word and the confirm dialog behind it. */}
        <DropdownMenuItem onSelect={() => request({ kind: "trash", path: entry.path })}>
          <Trash2 aria-hidden="true" />
          {TREE_LABELS.trash}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TreeRowsProps {
  entries: readonly TreeEntry[];
  folders: readonly string[];
  shown: string | null;
  collapsed: ReadonlySet<string>;
  onToggle: (path: string, open: boolean) => void;
  onOpenFile: (event: MouseEvent<HTMLAnchorElement>, path: string) => void;
}

function hasTreeDrag(event: DragEvent) {
  return event.dataTransfer.types.includes(TREE_DRAG_TYPE);
}

function TreeRows({ entries, folders, shown, collapsed, onToggle, onOpenFile }: TreeRowsProps) {
  return entries.map((entry) => (
    <TreeItem
      key={entry.path}
      entry={entry}
      folders={folders}
      shown={shown}
      collapsed={collapsed}
      onToggle={onToggle}
      onOpenFile={onOpenFile}
    />
  ));
}

function TreeItem({ entry, ...rest }: Omit<TreeRowsProps, "entries"> & { entry: TreeEntry }) {
  const { folders, shown, collapsed, onToggle, onOpenFile } = rest;
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    setMenuOpen(true);
  };
  const menu = (
    <RowMenu entry={entry} folders={folders} open={menuOpen} onOpenChange={setMenuOpen} />
  );

  if (entry.kind === "file") {
    const active = entry.path === shown;
    return (
      <SidebarMenuSubItem>
        <div className="group/tree-row relative">
          <SidebarMenuSubButton asChild isActive={active} className="pe-7">
            <a
              href={toHash({ kind: "doc", path: entry.path })}
              aria-current={active ? "page" : undefined}
              title={TREE_LABELS.rowHover(entry.title, entry.name)}
              {...{ [TREE_PATH_ATTR]: entry.path }}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(TREE_DRAG_TYPE, entry.path);
                event.dataTransfer.effectAllowed = "move";
              }}
              onClick={(event) => onOpenFile(event, entry.path)}
              onContextMenu={onContextMenu}
            >
              <FileText aria-hidden="true" />
              <span>{entry.title}</span>
            </a>
          </SidebarMenuSubButton>
          {menu}
        </div>
      </SidebarMenuSubItem>
    );
  }

  const open = !collapsed.has(entry.path);
  return (
    <SidebarMenuSubItem>
      <Collapsible open={open} onOpenChange={(next) => onToggle(entry.path, next)}>
        <div className="group/tree-row relative">
          <CollapsibleTrigger asChild>
            <SidebarMenuSubButton
              asChild
              className={cn(
                "pe-7 [&[data-state=open]>svg:first-child]:rotate-90",
                dropping && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <button
                type="button"
                {...{ [TREE_PATH_ATTR]: entry.path }}
                onContextMenu={onContextMenu}
                onDragOver={(event) => {
                  if (!hasTreeDrag(event)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropping(true);
                }}
                onDragLeave={() => setDropping(false)}
                onDrop={(event) => {
                  setDropping(false);
                  const path = event.dataTransfer.getData(TREE_DRAG_TYPE);
                  if (!path) return;
                  event.preventDefault();
                  void moveInto(path, entry.path);
                }}
              >
                <ChevronRight
                  aria-hidden="true"
                  className="transition-transform duration-fast ease-standard"
                />
                <Folder aria-hidden="true" />
                <span>{entry.name}</span>
              </button>
            </SidebarMenuSubButton>
          </CollapsibleTrigger>
          {menu}
        </div>
        <CollapsibleContent>
          <SidebarMenuSub className="me-0 pe-0">
            <TreeRows entries={entry.children} {...rest} />
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuSubItem>
  );
}

// ── Dialogs ───────────────────────────────────────────────────────────────────────────

function NameDialog({ request }: { request: Exclude<TreeRequest, { kind: "trash" }> }) {
  const initial = request.kind === "rename" ? baseName(request.path).replace(/\.ya?ml$/i, "") : "";
  const [value, setValue] = useState(initial);
  // Set by a submit with an invalid name: the message shows even for an empty field.
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const name = value.trim();
  const valid = name !== "" && !/[\\/]/.test(name) && name !== "." && name !== "..";
  const showError = !valid && (value !== "" || attempted);
  const folder = request.kind === "rename" ? folderOf(request.path) : request.folder;
  const copy =
    request.kind === "new-diagram"
      ? {
          title: TREE_LABELS.newDiagramTitle,
          description: TREE_LABELS.inFolder(folder),
          field: TREE_LABELS.newDiagramField,
          submit: TREE_LABELS.create,
        }
      : request.kind === "new-folder"
        ? {
            title: TREE_LABELS.newFolderTitle,
            description: TREE_LABELS.inFolder(folder),
            field: TREE_LABELS.newFolderField,
            submit: TREE_LABELS.create,
          }
        : request.title !== undefined
          ? {
              title: TREE_LABELS.renameFileTitle,
              description: TREE_LABELS.renameFileDescription(
                request.title,
                baseName(request.path),
                folder,
              ),
              field: TREE_LABELS.fileNameField,
              submit: TREE_LABELS.save,
            }
          : {
              title: TREE_LABELS.renameFolderTitle,
              description: TREE_LABELS.inFolder(folder),
              field: TREE_LABELS.newFolderField,
              submit: TREE_LABELS.save,
            };

  const submit = () => {
    if (!valid) {
      setAttempted(true);
      inputRef.current?.focus();
      return;
    }
    if (request.kind === "new-diagram") {
      dismiss();
      // A new diagram opens in edit mode: it has nothing to show until it is written.
      workspaceActions.create(folder, name).then(
        (path) => {
          openDoc(path, { mode: "edit" });
          focusDocTab(path);
        },
        fail("create", name),
      );
    } else if (request.kind === "new-folder") {
      const path = join(folder, name);
      dismiss();
      workspaceActions
        .mkdir(path)
        .then(() => focusEntry(path, () => returnFocusTo), fail("create", path));
    } else if (name !== initial) {
      dismiss();
      workspaceActions.rename(request.path, name).then(
        (to) => {
          modeActions.moved(request.path, to);
          focusEntry(to, () => treeRowElement(folder));
        },
        fail("rename", request.path),
      );
    } else {
      dismiss();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-tree-name">{copy.field}</Label>
            <Input
              ref={inputRef}
              id="workspace-tree-name"
              value={value}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              aria-invalid={showError}
              aria-describedby={showError ? "workspace-tree-name-error" : undefined}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
            {showError ? (
              <p
                id="workspace-tree-name-error"
                role="alert"
                className="text-caption text-destructive-text"
              >
                {TREE_LABELS.invalidName}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => dismiss()}>
              {TREE_LABELS.cancel}
            </Button>
            {/* `aria-disabled`, not `disabled`: focus stays on the button (composer rule). */}
            <Button type="submit" aria-disabled={!valid}>
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TreeDialogs() {
  const { request, serial } = useTreeUi();
  if (request === null) return null;
  if (request.kind !== "trash") return <NameDialog key={serial} request={request} />;
  const name = baseName(request.path);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && dismiss()}
      tone="destructive"
      title={TREE_LABELS.trashTitle(name)}
      description={TREE_LABELS.trashDescription}
      confirmLabel={TREE_LABELS.trashConfirm}
      cancelLabel={TREE_LABELS.keep}
      onConfirm={() => {
        modeActions.closeTabsAt(request.path);
        // The row (and its "…") leaves the tree: focus its folder's row, or the tree's root.
        dismiss(() => treeRowElement(folderOf(request.path)));
        workspaceActions.trash(request.path).catch(fail("trash", request.path));
      }}
    />
  );
}

function useTreeUi() {
  return useSyncExternalStore(treeUi.subscribe, treeUi.get);
}

// ── The tree ──────────────────────────────────────────────────────────────────────────

/** The "…" on the rail's Workspace entry: new diagram or folder at the root. */
export function WorkspaceRootMenu() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction ref={triggerRef} showOnHover aria-label={TREE_LABELS.rootActions}>
          <Ellipsis />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem
          onSelect={() => ask({ kind: "new-diagram", folder: "" }, triggerRef.current)}
        >
          <FilePlus aria-hidden="true" />
          {TREE_LABELS.newDiagramTitle}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => ask({ kind: "new-folder", folder: "" }, triggerRef.current)}
        >
          <FolderPlus aria-hidden="true" />
          {TREE_LABELS.newFolder}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The tree could not be read. Retry keeps this panel (and focus on its button) while it
 * runs; once the tree shows, focus goes to the tree's root entry.
 */
function TreeLoadError({ message }: { message: string }) {
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    workspaceActions.refreshTree().then(
      () => focusSoon(() => treeRowElement("")),
      // The store keeps the error; this panel shows it.
      () => setRetrying(false),
    );
  };
  return (
    <StatePanel
      kind="error"
      titleAs="div"
      icon={null}
      title={TREE_LABELS.loadFailed}
      description={message}
      // `bg-card`: the panel's text tokens are for page and card surfaces; on the sidebar's
      // own (often dark) surface the title would vanish.
      className="gap-2 bg-card px-3 py-4"
      actions={
        // `aria-disabled`, not `disabled`: focus stays on the button while it retries.
        <Button size="sm" variant="outline" aria-disabled={retrying} onClick={retry}>
          {retrying ? TREE_LABELS.retrying : TREE_LABELS.retry}
        </Button>
      }
    />
  );
}

/** The folder tree (a `SidebarMenuSub`), for inside the rail's Workspace item. */
export function WorkspaceTree() {
  const tree = useWorkspace((s) => s.tree);
  const treeError = useWorkspace((s) => s.treeError);
  const entries = useMemo(() => (tree ? buildTree(tree) : []), [tree]);
  const route = useRoute();
  const shown = route.kind === "doc" ? route.path : null;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  // On a phone the sidebar is a sheet over the page: close it once a file opens.
  const { isMobile, setOpenMobile } = useSidebar();

  const onToggle = (path: string, open: boolean) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (open) next.delete(path);
      else next.add(path);
      return next;
    });

  const onOpenFile = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    // A modified click (new browser tab, …) is the browser's.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    openDoc(path);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <SidebarMenuSub className="me-0 pe-0">
        {tree === null && treeError !== null ? (
          <SidebarMenuSubItem>
            <TreeLoadError message={treeError} />
          </SidebarMenuSubItem>
        ) : tree === null ? (
          <SidebarMenuSubItem>
            <div role="status" aria-live="polite">
              <span className="sr-only">{TREE_LABELS.loading}</span>
              <SidebarMenuSkeleton aria-hidden="true" />
              <SidebarMenuSkeleton aria-hidden="true" />
            </div>
          </SidebarMenuSubItem>
        ) : (
          <TreeRows
            entries={entries}
            folders={tree.folders}
            shown={shown}
            collapsed={collapsed}
            onToggle={onToggle}
            onOpenFile={onOpenFile}
          />
        )}
      </SidebarMenuSub>
      <TreeDialogs />
    </>
  );
}
