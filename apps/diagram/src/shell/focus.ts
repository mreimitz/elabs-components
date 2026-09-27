/**
 * DG-22 review — where keyboard focus goes after the shell changes what is on screen.
 *
 * P4: library gap — H-24: ui's `ConfirmDialog`, `Dialog` without a trigger and `CommandDialog`
 * send focus to `<body>` when they close, and a closed tab or a trashed row takes its focused
 * element with it. The shell hands focus to a named target instead: the element that opened
 * the dialog, the tab of the document that just opened, a tree row, or the workspace.
 *
 * Targets are looked up by id or data attribute, not held as elements: most of them are
 * rendered by React after the store change that asks for them (a new tab, a renamed row).
 */

/** Target of the skip link, and of focus when no tab or row fits: the workspace. */
export const WORKSPACE_ID = "diagram-workspace";

/** The DOM id of a document's tab (the workspace panel is labelled by it). */
export function docTabId(path: string): string {
  return `doc-tab-${path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** The attribute on each workspace-tree row (and `""` on the rail's Workspace entry). */
export const TREE_PATH_ATTR = "data-tree-path";

type Finder = () => HTMLElement | null | undefined;

/** How often to look again, and for how long by default: a store change, a React commit and a
 * tree refresh (one request) fit well inside it. Timers, not animation frames: frames stop in
 * a background tab, and a hand-off must still land when the person comes back. */
const POLL_MS = 16;
const WAIT_MS = 800;

let latest = 0;

/**
 * Focus what `find` returns once it is in the document, looking again for up to `waitMs`; if
 * it never shows up, focus what `fallback` returns. The first look runs after the closing
 * dialog's own focus handling (Radix hands focus back on a zero-delay timer). The latest call
 * wins: one still waiting gives up, so two hand-offs in a row (close a tab, then trash a row)
 * end on the second.
 */
export function focusSoon(find: Finder, fallback?: Finder, waitMs = WAIT_MS): void {
  const token = ++latest;
  const until = Date.now() + waitMs;
  const attempt = () => {
    if (token !== latest) return;
    const target = find();
    if (target?.isConnected) {
      target.focus();
    } else if (Date.now() < until) {
      setTimeout(attempt, POLL_MS);
    } else {
      fallback?.()?.focus();
    }
  };
  setTimeout(attempt, POLL_MS);
}

export function workspaceElement(): HTMLElement | null {
  return document.getElementById(WORKSPACE_ID);
}

export function docTabElement(path: string): HTMLElement | null {
  return document.getElementById(docTabId(path));
}

/** A row of the workspace tree (`""`: the rail's Workspace entry, the tree's root). */
export function treeRowElement(path: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${TREE_PATH_ATTR}="${CSS.escape(path)}"]`);
}

/** The workspace, once the page in it has rendered. */
export function focusWorkspace(): void {
  focusSoon(workspaceElement);
}

/** A document's tab, else the workspace (the strip is gone when no tab is open). */
export function focusDocTab(path: string): void {
  focusSoon(() => docTabElement(path), workspaceElement);
}

/**
 * The YAML editor, once it has mounted (Monaco loads on first use, so this waits up to about
 * two seconds), else the workspace. Its `<textarea>` is the focus surface (editor-pane.tsx).
 */
export function focusEditor(): void {
  focusSoon(
    () => document.querySelector<HTMLElement>(`#${WORKSPACE_ID} .monaco-editor textarea`),
    workspaceElement,
    2000,
  );
}

/** The element focus was on, unless that is nothing (`<body>`). */
export function activeElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}
