/**
 * DG-21 — live reload (plan V6): one `EventSource` on `/api/workspace/events`. A change to the
 * open file from outside the tab (another editor, Finder, an LLM session through the MCP
 * server) reloads it silently when the tab has no unsaved edits, and asks Reload / Keep when
 * it has. Any event refreshes the tree. DG-26 subscribes with `onWorkspaceEvent` (a
 * referenced diagram's source changed → re-resolve its `ref`).
 */
import { useEffect } from "react";
import { toast } from "@elabs-ai/components-ui";
import { WORKSPACE_EVENTS_URL, type WorkspaceEvent } from "./client";
import { workspaceActions, workspaceStore } from "./workspace-store";

/** The strings, in one place (`conventions/i18n-strings`). */
const LIVE_RELOAD_LABELS = {
  changedTitle: (path: string) => `“${path}” changed on disk`,
  changedDetail:
    "This tab has unsaved edits. Reload the file, or keep your text and save it over the file.",
  reload: "Reload",
  keep: "Keep mine",
  goneTitle: (path: string) => `“${path}” left the workspace`,
  goneDetail: "It was moved or deleted outside this tab. The text stays open here, unsaved.",
  failed: "Could not read the changed file",
} as const;

/** One toast per question: a second change while it is open replaces it. */
const CONFLICT_TOAST_ID = "workspace-changed-on-disk";
/** Tree refreshes coalesce: an atomic write or a folder move is a burst of events. */
const REFRESH_DELAY_MS = 50;

export type WorkspaceEventListener = (event: WorkspaceEvent) => void;

const listeners = new Set<WorkspaceEventListener>();
const reopenListeners = new Set<() => void>();
export function onWorkspaceReopen(listener: () => void): () => void {
  reopenListeners.add(listener);
  return () => {
    reopenListeners.delete(listener);
  };
}

/** Every workspace event, after the open file and the tree have been handled (DG-26). */
export function onWorkspaceEvent(listener: WorkspaceEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** DG-24: a NAMED server event's `data` (`event: <type>` frames; `onmessage` never sees them). */
export type ServerEventListener = (data: string) => void;

const named = new Map<string, Set<ServerEventListener>>();
const sources = new Set<EventSource>();
const attached = new WeakMap<EventSource, Set<string>>();

function attach(source: EventSource, type: string) {
  const types = attached.get(source) ?? new Set<string>();
  if (types.has(type)) return;
  types.add(type);
  attached.set(source, types);
  source.addEventListener(type, (message) => {
    const data = (message as MessageEvent<string>).data;
    named.get(type)?.forEach((listener) => listener(data));
  });
}

/**
 * DG-24: listen to one named event on the workspace stream (`catalog`: a catalog file changed;
 * the server's `send(type, data)` in `workspace-plugin.mjs`). Works whenever the stream opens
 * or reopens.
 */
export function onServerEvent(type: string, listener: ServerEventListener): () => void {
  let set = named.get(type);
  if (!set) {
    set = new Set();
    named.set(type, set);
  }
  set.add(listener);
  for (const source of sources) attach(source, type);
  return () => {
    set.delete(listener);
  };
}

/** The open file changed on disk while the tab has unsaved edits: Reload or Keep. */
export function askAboutDiskChange(path: string): void {
  toast(LIVE_RELOAD_LABELS.changedTitle(path), {
    id: CONFLICT_TOAST_ID,
    description: LIVE_RELOAD_LABELS.changedDetail,
    duration: Infinity,
    action: {
      label: LIVE_RELOAD_LABELS.reload,
      onClick: () => void workspaceActions.resolveConflict("reload"),
    },
    cancel: {
      label: LIVE_RELOAD_LABELS.keep,
      onClick: () => void workspaceActions.resolveConflict("keep"),
    },
  });
}

/** Take the Reload / Keep question down: its conflict is gone ("Close without saving"). */
export function dismissDiskChange(): void {
  toast.dismiss(CONFLICT_TOAST_ID);
}

/** The open file was moved or trashed outside the tab. */
export function tellFileGone(path: string): void {
  toast.warning(LIVE_RELOAD_LABELS.goneTitle(path), {
    id: CONFLICT_TOAST_ID,
    description: LIVE_RELOAD_LABELS.goneDetail,
  });
}

async function checkOpenFile(path: string, mtime: number | undefined) {
  try {
    const outcome = await workspaceActions.checkDisk(path, mtime);
    if (outcome === "conflict") askAboutDiskChange(path);
    else if (outcome === "gone") tellFileGone(path);
  } catch (error) {
    toast.error(LIVE_RELOAD_LABELS.failed, {
      description: error instanceof Error ? error.message : String(error),
    });
  }
}

/** One transport, shared by shell services and standalone pictures. */
const streamOpenListeners = new Set<() => void>();
let shared: { source: EventSource; users: number } | null = null;
function acquireStream(): () => void {
  if (!shared) {
    const source = new EventSource(WORKSPACE_EVENTS_URL);
    shared = { source, users: 0 };
    sources.add(source);
    for (const type of named.keys()) attach(source, type);
    let opened = false;
    source.onopen = () => {
      streamOpenListeners.forEach((listener) => listener());
      if (opened) reopenListeners.forEach((listener) => listener());
      opened = true;
    };
    source.onmessage = (message: MessageEvent<string>) => {
      let event: WorkspaceEvent;
      try {
        event = JSON.parse(message.data) as WorkspaceEvent;
      } catch {
        return;
      }
      listeners.forEach((listener) => listener(event));
    };
  }
  const owned = shared;
  owned.users += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owned.users -= 1;
    if (owned.users === 0) {
      sources.delete(owned.source);
      owned.source.close();
      if (shared === owned) shared = null;
    }
  };
}

/** Observe a file and reconnects without mounting a document tab, autosave or toast behavior. */
export function watchPath(path: string, onChange: () => void): () => void {
  const offEvent = onWorkspaceEvent((event) => {
    if (event.path === path) onChange();
  });
  // Catch writes between the first GET and connection establishment, as well as reconnects.
  streamOpenListeners.add(onChange);
  const release = acquireStream();
  return () => {
    offEvent();
    streamOpenListeners.delete(onChange);
    release();
  };
}

/** The shell adds its tree/conflict behavior to the shared transport. */
export function startLiveReload(): () => void {
  let refresh: ReturnType<typeof setTimeout> | undefined;
  const refreshSoon = () => {
    clearTimeout(refresh);
    refresh = setTimeout(
      () => void workspaceActions.refreshTree().catch(() => {}),
      REFRESH_DELAY_MS,
    );
  };
  refreshSoon();
  const offReopen = onWorkspaceReopen(() => {
    const path = workspaceStore.get().current?.path;
    if (path) void checkOpenFile(path, undefined);
    refreshSoon();
  });
  const offEvent = onWorkspaceEvent((event) => {
    if (event.path === workspaceStore.get().current?.path && event.type !== "addDir") {
      if (event.type === "unlink") void checkOpenFile(event.path, undefined);
      else if (event.type === "add" || event.type === "change")
        void checkOpenFile(event.path, event.mtime);
    }
    refreshSoon();
  });
  const release = acquireStream();
  return () => {
    clearTimeout(refresh);
    offEvent();
    offReopen();
    release();
  };
}

/** Mount once, in an always-rendered part of the shell. */
export function useLiveReload(): void {
  useEffect(() => startLiveReload(), []);
}
