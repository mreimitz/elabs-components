/**
 * DG-22 — the shell's keyboard map (plan §9.8, V7): one `keydown` listener on the window,
 * installed by the shell, plus the ⌘K palette's command registry. `docs/keyboard.md` and the
 * Settings page list `SHORTCUTS`; keep the three in step.
 *
 * Never inside a text field: an event whose target is in Monaco, an input, a textarea, a
 * select or anything contenteditable is left alone (⌘K included: Monaco uses it as a chord).
 * Single letters are also left alone inside a menu, listbox or dialog (Radix typeahead).
 *
 * Browser shortcuts: Chromium closes the browser tab on ⌘W / Ctrl+W and switches tabs on
 * ⌘⇧[ / ⌘⇧] before the page sees the key, and `preventDefault` cannot stop it. So each of the
 * three also has an Alt / ⌥ binding (⌥W, ⌥⇧[, ⌥⇧]) that the browser leaves to the page.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { diagramStore, editActions } from "../state/diagram-store";
import { navigate, parseRoute } from "../routes/use-hash";
import { lensActions } from "./lens-store";
import { currentMode, modeActions, modeStore } from "./mode-store";
import { searchActions } from "./search-store";

// ── The list (Settings, docs/keyboard.md) ─────────────────────────────────────────────

export interface Shortcut {
  id: string;
  /** Keys as shown, with `Mod` for ⌘ (macOS) / Ctrl (elsewhere). */
  keys: readonly string[];
  /** A second binding for the same action (the browser-safe one). */
  alt?: readonly string[];
  label: string;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "edit", keys: ["E"], label: "Edit / Done: slide the editor and inspector in or out" },
  { id: "present", keys: ["P"], label: "Present the diagram" },
  { id: "lens", keys: ["L"], label: "Switch between the technical and visual lens" },
  { id: "palette", keys: ["Mod", "K"], label: "Command palette: switch diagram, go to a page" },
  { id: "close", keys: ["Mod", "W"], alt: ["Alt", "W"], label: "Close the diagram tab" },
  { id: "next", keys: ["Mod", "Shift", "]"], alt: ["Alt", "Shift", "]"], label: "Next tab" },
  {
    id: "previous",
    keys: ["Mod", "Shift", "["],
    alt: ["Alt", "Shift", "["],
    label: "Previous tab",
  },
  { id: "story", keys: ["←", "→"], label: "Previous / next story step (with a story bar)" },
  {
    id: "escape",
    keys: ["Esc"],
    label: "Back out: close the inspector, then leave edit mode, then leave presenting",
  },
  { id: "sidebar", keys: ["Mod", "B"], label: "Show or hide the sidebar" },
  {
    id: "search",
    keys: ["/"],
    label: "Focus the workspace search (opens the sidebar first if it is collapsed)",
  },
  { id: "undo", keys: ["Mod", "Z"], label: "Undo (edit mode)" },
  { id: "redo", keys: ["Mod", "Shift", "Z"], label: "Redo (edit mode)" },
];

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

const KEY_GLYPH: Record<string, string> = IS_MAC
  ? { Mod: "⌘", Alt: "⌥", Shift: "⇧" }
  : { Mod: "Ctrl", Alt: "Alt", Shift: "Shift" };

/** A binding's keys for display on this platform (`["Mod","K"]` → `["⌘","K"]`). */
export function displayKeys(keys: readonly string[]): string[] {
  return keys.map((key) => KEY_GLYPH[key] ?? key);
}

/** A binding as one string for running text: `⌘K` on macOS, `Ctrl+K` elsewhere. */
export function shortcutText(keys: readonly string[]): string {
  return displayKeys(keys).join(IS_MAC ? "" : "+");
}

// ── Story keys (DG-31 mounts the story bar) ────────────────────────────────────────────

export interface StoryKeys {
  previous: () => void;
  next: () => void;
}

let storyKeys: StoryKeys | null = null;

/** ←/→ step the story while the component calling this is mounted (the story bar). */
export function useStoryKeys(keys: StoryKeys): void {
  useEffect(() => {
    storyKeys = keys;
    return () => {
      if (storyKeys === keys) storyKeys = null;
    };
  }, [keys]);
}

// ── The listener ──────────────────────────────────────────────────────────────────────

const TEXT_ENTRY =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), .monaco-editor";
const OVERLAY = "[role=dialog], [role=alertdialog], [role=menu], [role=listbox]";
/** The sidebar's own mobile sheet (`data-mobile="true"`, `packages/ui` `Sidebar`) — "/" reaches
 * the search box from inside it exactly as it does from the desktop's persistent sidebar; every
 * OTHER `role=dialog` (rename, trash-confirm, the palette) still blocks it. */
const MOBILE_SIDEBAR_SHEET = '[data-mobile="true"]';
/** Arrow keys already mean something here (moving nodes, roving focus, sliders). */
const ARROW_OWNERS =
  ".react-flow, [role=tablist], [role=radiogroup], [role=toolbar], [role=slider], [role=menu]";

function closestOf(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/** The shell's `keydown`. Exported for the browser check; `useShellKeymap` installs it. */
export function onShellKeyDown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing || event.repeat) return;
  if (closestOf(event.target, TEXT_ENTRY)) return;
  const mod = event.metaKey || event.ctrlKey;
  const route = parseRoute(window.location.hash);
  const doc = route.kind === "doc" && !route.present ? route : null;

  if (mod && !event.altKey && !event.shiftKey && event.code === "KeyK") {
    event.preventDefault();
    modeActions.setPaletteOpen(!modeStore.get().paletteOpen);
    return;
  }
  // ⌘W (where the browser lets it through) or ⌥W.
  if (event.code === "KeyW" && !event.shiftKey && mod !== event.altKey) {
    if (doc?.path == null) return;
    event.preventDefault();
    modeActions.requestClose(doc.path);
    return;
  }
  // ⌘⇧] / ⌘⇧[ (where the browser lets them through) or ⌥⇧] / ⌥⇧[.
  if (
    event.shiftKey &&
    mod !== event.altKey &&
    (event.code === "BracketRight" || event.code === "BracketLeft")
  ) {
    event.preventDefault();
    modeActions.cycleTab(event.code === "BracketRight" ? 1 : -1);
    return;
  }
  if (mod || event.altKey) return;

  if (event.key === "Escape") {
    if (!doc) return;
    if (diagramStore.get().inspectorOpen) {
      event.preventDefault();
      editActions.setInspectorOpen(false);
    } else if (currentMode() === "edit") {
      event.preventDefault();
      modeActions.setMode("view");
    }
    // Presenting: DG-18's `PresentationView` owns Esc (the shell is not mounted there).
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    if (!doc || !storyKeys || closestOf(event.target, ARROW_OWNERS)) return;
    event.preventDefault();
    if (event.key === "ArrowLeft") storyKeys.previous();
    else storyKeys.next();
    return;
  }
  // Checked ahead of the `shiftKey` guard below: `event.key` is already layout-resolved, so
  // this is the one binding that must fire on a layout where "/" needs Shift (German, Swiss,
  // Nordic: Shift+7) — the letter shortcuts below stay Shift-free. No `doc` requirement: the
  // search box lives in the rail, shown on every route.
  if (event.key === "/") {
    if (closestOf(event.target, OVERLAY) && !closestOf(event.target, MOBILE_SIDEBAR_SHEET)) return;
    event.preventDefault();
    searchActions.requestFocus();
    return;
  }
  if (event.shiftKey || closestOf(event.target, OVERLAY)) return;
  const key = event.key.toLowerCase();
  if (key === "e" && doc) {
    event.preventDefault();
    modeActions.toggleMode();
  } else if (key === "l" && doc) {
    event.preventDefault();
    lensActions.toggle();
  } else if (key === "p" && doc && (diagramStore.get().drawn.graph?.nodes.length ?? 0) > 0) {
    // n9: matches the top bar's Present button (interaction-controls.tsx `useAvailable`) —
    // an empty document has a `graph` with no nodes, so the shortcut must refuse it too.
    event.preventDefault();
    navigate({ ...doc, present: true });
  }
}

/** Install the listener; the shell mounts it once. */
export function useShellKeymap(): void {
  useEffect(() => {
    window.addEventListener("keydown", onShellKeyDown);
    return () => window.removeEventListener("keydown", onShellKeyDown);
  }, []);
}

// ── ⌘K palette registry (DG-29 fills it) ─────────────────────────────────────────────

export interface PaletteCommand {
  /** Unique within its source. */
  id: string;
  /** The palette group heading ("Insert", "Actions", …). */
  group: string;
  label: string;
  /** Extra words the filter matches. */
  keywords?: readonly string[];
  /** A shortcut shown beside it, in `Shortcut.keys` form. */
  shortcut?: readonly string[];
  run: () => void;
}

const paletteRegistry = createStore<{ sources: Record<string, readonly PaletteCommand[]> }>({
  sources: {},
});

/** Add a source's commands; returns the removal. A second call with the same source replaces. */
export function registerPaletteCommands(
  source: string,
  commands: readonly PaletteCommand[],
): () => void {
  paletteRegistry.set((s) => ({ sources: { ...s.sources, [source]: commands } }));
  return () => {
    if (paletteRegistry.get().sources[source] !== commands) return;
    const { [source]: _removed, ...rest } = paletteRegistry.get().sources;
    paletteRegistry.set({ sources: rest });
  };
}

/** Register `commands` while the calling component is mounted (memoise the array). */
export function usePaletteCommands(source: string, commands: readonly PaletteCommand[]): void {
  useEffect(() => registerPaletteCommands(source, commands), [source, commands]);
}

/** Every registered command, in registration order (the palette reads it). */
export function useRegisteredCommands(): readonly PaletteCommand[] {
  const sources = useSyncExternalStore(
    paletteRegistry.subscribe,
    () => paletteRegistry.get().sources,
  );
  return useMemo(() => Object.values(sources).flat(), [sources]);
}
