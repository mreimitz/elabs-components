/**
 * paste-embed — ProseMirror plugin + helper for image paste/drop embedding.
 *
 * When `onEmbedAsset` is provided by the host:
 *   1. Intercepts paste (from clipboard) or drop events carrying image files.
 *   2. Inserts an inline "uploading…" widget Decoration at the caret/drop position.
 *   3. Calls `onEmbedAsset(file)` and on resolve inserts a real image node, removing
 *      the placeholder.
 *   4. On reject removes the placeholder and renders a transient inline error
 *      decoration (role="alert", auto-dismissed after 4 s) + toast.error().
 *
 * The plugin is a raw `$prose` ProseMirror plugin (same pattern as the slash menu),
 * so it pulls zero new dependencies beyond what Milkdown already provides.
 *
 * A11y:
 *   - Upload placeholder: role="status" aria-live="polite"
 *   - Error decoration: role="alert" (assertive; fires once and auto-dismisses)
 *
 * Motion: gated via `duration-normal ease-standard motion-reduce:transition-none`
 * token utilities (defined in @elabs-ai/components-tokens).
 */

import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import { toast } from "@elabs-ai/components-ui";

/** The host-provided hook: receives a File, resolves to a URL/path string. */
export type EmbedAssetFn = (file: File) => Promise<string>;

/** A unique key for each in-flight upload. */
type UploadId = string;

function uniqueId(): UploadId {
  return `embed-${Math.random().toString(36).slice(2)}`;
}

/** Meta tags for the plugin's own transactions. */
interface EmbedMetaAdd {
  type: "add";
  id: UploadId;
  pos: number;
  filename: string;
}
interface EmbedMetaRemove {
  type: "remove";
  id: UploadId;
}
interface EmbedMetaError {
  type: "error";
  id: UploadId;
  /** Position at which the error chip should appear. */
  pos: number;
  message: string;
}
interface EmbedMetaClearError {
  type: "clear-error";
  id: UploadId;
}
type EmbedMeta = EmbedMetaAdd | EmbedMetaRemove | EmbedMetaError | EmbedMetaClearError;

/** Runtime state: active upload placeholders + transient error chips. */
interface EmbedState {
  /** Decoration set that maps through doc changes. */
  decos: DecorationSet;
  /** Map from upload id → decoration for fast lookup / removal. */
  byId: Map<UploadId, Decoration>;
  /** Set of error ids currently showing. */
  errorIds: Set<UploadId>;
}

const embedPluginKey = new PluginKey<EmbedState>("brand-embed");

/** DOM element for the uploading placeholder chip. */
function makePlaceholderChip(filename: string): HTMLElement {
  const chip = document.createElement("span");
  chip.setAttribute("role", "status");
  chip.setAttribute("aria-live", "polite");
  chip.setAttribute("aria-label", `Uploading ${filename}`);
  chip.setAttribute("title", `Uploading ${filename}…`);
  chip.className =
    "inline-flex items-center gap-1 rounded px-2 py-0.5 text-caption bg-muted text-muted-foreground " +
    "border border-border select-none transition-opacity duration-normal ease-standard motion-reduce:transition-none";

  // SVG spinner (token-colored, no Spinner component needed here — widget is a raw DOM node)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "width:0.85em;height:0.85em;animation:spin 1s linear infinite;flex-shrink:0;";
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "9");
  circle.setAttribute("stroke", "currentColor");
  circle.setAttribute("stroke-width", "2.5");
  circle.setAttribute("stroke-dasharray", "56.5");
  circle.setAttribute("stroke-dashoffset", "42");
  circle.setAttribute("stroke-linecap", "round");
  svg.appendChild(circle);
  chip.appendChild(svg);

  // Ensure the keyframe is injected once per document.
  if (!chip.ownerDocument.head.querySelector("#embed-spin-keyframe")) {
    const style = chip.ownerDocument.createElement("style");
    style.id = "embed-spin-keyframe";
    style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
    chip.ownerDocument.head.appendChild(style);
  }

  const label = document.createElement("span");
  label.textContent = `${filename.length > 24 ? filename.slice(0, 22) + "…" : filename} Uploading…`;
  chip.appendChild(label);

  return chip;
}

/** DOM element for the error chip (transient, auto-dismissing). */
function makeErrorChip(message: string): HTMLElement {
  const chip = document.createElement("span");
  chip.setAttribute("role", "alert");
  chip.setAttribute("aria-live", "assertive");
  chip.setAttribute("title", message);
  // #124: the chip's own "Upload failed" label is running text — ink rung.
  chip.className =
    "inline-flex items-center gap-1 rounded px-2 py-0.5 text-caption bg-destructive/10 text-destructive-text " +
    "border border-destructive/30 select-none";

  const label = document.createElement("span");
  label.textContent = `⚠ Upload failed`;
  chip.appendChild(label);
  return chip;
}

/**
 * Core embed helper — exported so tests can call it directly against a live
 * ProseMirror view without synthesizing ClipboardEvent/DragEvent.
 */
export function embedAsset(
  view: EditorView,
  file: File,
  pos: number,
  onEmbedAsset: EmbedAssetFn,
  onError?: (msg: string) => void,
): void {
  const id = uniqueId();

  // 1. Insert the uploading placeholder widget.
  const addMeta: EmbedMeta = { type: "add", id, pos, filename: file.name };
  view.dispatch(view.state.tr.setMeta(embedPluginKey, addMeta));

  // 2. Call the host hook.
  onEmbedAsset(file).then(
    (path) => {
      // 3a. Resolve: find the placeholder's current mapped position.
      const pluginState = embedPluginKey.getState(view.state);
      const deco = pluginState?.byId.get(id);

      // Remove the placeholder decoration.
      const removeMeta: EmbedMeta = { type: "remove", id };
      const tr: Transaction = view.state.tr.setMeta(embedPluginKey, removeMeta);

      if (deco) {
        // Insert the image node at the placeholder's current mapped position.
        const decoPos = (deco as unknown as { from: number }).from;
        const imageNode = view.state.schema.nodes.image?.create({
          src: path,
          alt: file.name.replace(/\.[^.]+$/, ""),
          title: null,
        });
        if (imageNode) {
          // We need to insert the image: insert then dispatch remove separately.
          // Insert first so the position is relative to the current doc.
          const insertTr = view.state.tr.insert(decoPos, imageNode);
          view.dispatch(insertTr);
          // Now remove the deco (after the doc has shifted).
          const removeTr = view.state.tr.setMeta(embedPluginKey, removeMeta);
          view.dispatch(removeTr);
          return;
        }
      }
      // Fallback: just remove the placeholder.
      view.dispatch(tr);
    },
    (err) => {
      // 3b. Reject: find the placeholder position, show error.
      const pluginState = embedPluginKey.getState(view.state);
      const deco = pluginState?.byId.get(id);
      const errPos = deco ? (deco as unknown as { from: number }).from : pos;
      const message = err instanceof Error ? err.message : "Upload failed";

      // Remove placeholder + add error chip.
      const errorMeta: EmbedMeta = { type: "error", id, pos: errPos, message };
      view.dispatch(view.state.tr.setMeta(embedPluginKey, errorMeta));

      // Surface the error via toast (additional signal; not the only cue).
      toast.error(`Upload failed: ${message}`);
      onError?.(message);

      // Auto-dismiss the error chip after 4 s.
      setTimeout(() => {
        if (view.isDestroyed) return;
        const clearMeta: EmbedMeta = { type: "clear-error", id };
        view.dispatch(view.state.tr.setMeta(embedPluginKey, clearMeta));
      }, 4000);
    },
  );
}

/** Read image Files from a FileList (or null). */
function imageFiles(list: FileList | null | undefined): File[] {
  if (!list) return [];
  const files: File[] = [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (f && f.type.startsWith("image/")) files.push(f);
  }
  return files;
}

/**
 * Build the paste-embed Milkdown plugin. Pass the `onEmbedAsset` hook from the
 * host. When `onEmbedAsset` is undefined the plugin is still registered but never
 * intercepts events — normal ProseMirror behavior is preserved.
 */
export function pasteEmbedPlugin(onEmbedAsset?: EmbedAssetFn): MilkdownPlugin {
  return $prose(() => {
    return new Plugin<EmbedState>({
      key: embedPluginKey,
      state: {
        init: () => ({
          decos: DecorationSet.empty,
          byId: new Map(),
          errorIds: new Set(),
        }),
        apply: (tr, prev, _oldState, newState) => {
          // Map existing decorations through the transaction.
          let decos = prev.decos.map(tr.mapping, tr.doc);
          const byId = new Map(prev.byId);
          const errorIds = new Set(prev.errorIds);

          // Also map the positions stored on each deco (they're widget decorations
          // whose .from tracks through the mapping automatically via DecorationSet.map).
          // We just need to keep byId in sync: after mapping, find each id's deco.
          for (const [id, oldDeco] of prev.byId.entries()) {
            // Find the mapped deco in the new set (same key).
            const key = (oldDeco.spec as { key?: string }).key;
            if (key) {
              // Re-fetch from the mapped set so .from is up to date.
              const found = decos.find(undefined, undefined, (spec) => spec.key === key);
              if (found.length > 0 && found[0]) {
                byId.set(id, found[0]);
              } else {
                byId.delete(id);
              }
            }
          }

          const meta = tr.getMeta(embedPluginKey) as EmbedMeta | undefined;
          if (!meta) return { decos, byId, errorIds };

          switch (meta.type) {
            case "add": {
              const chip = makePlaceholderChip(meta.filename);
              const deco = Decoration.widget(meta.pos, chip, {
                key: `embed-placeholder:${meta.id}`,
                side: -1,
              });
              decos = decos.add(newState.doc, [deco]);
              byId.set(meta.id, deco);
              break;
            }
            case "remove": {
              const key = `embed-placeholder:${meta.id}`;
              const toRemove = decos.find(undefined, undefined, (spec) => spec.key === key);
              if (toRemove.length > 0) {
                decos = decos.remove(toRemove);
              }
              byId.delete(meta.id);
              errorIds.delete(meta.id);
              break;
            }
            case "error": {
              // Remove the placeholder chip.
              const placeholderKey = `embed-placeholder:${meta.id}`;
              const placeholders = decos.find(
                undefined,
                undefined,
                (spec) => spec.key === placeholderKey,
              );
              if (placeholders.length > 0) {
                decos = decos.remove(placeholders);
              }
              byId.delete(meta.id);

              // Add the error chip.
              const chip = makeErrorChip(meta.message);
              const errorKey = `embed-error:${meta.id}`;
              const deco = Decoration.widget(meta.pos, chip, { key: errorKey, side: 1 });
              decos = decos.add(newState.doc, [deco]);
              errorIds.add(meta.id);
              break;
            }
            case "clear-error": {
              const errorKey = `embed-error:${meta.id}`;
              const toRemove = decos.find(undefined, undefined, (spec) => spec.key === errorKey);
              if (toRemove.length > 0) {
                decos = decos.remove(toRemove);
              }
              errorIds.delete(meta.id);
              break;
            }
          }

          return { decos, byId, errorIds };
        },
      },
      props: {
        decorations: (state) => embedPluginKey.getState(state)?.decos ?? DecorationSet.empty,

        handlePaste: (view, event) => {
          if (!onEmbedAsset) return false;
          const files = imageFiles(event.clipboardData?.files);
          if (files.length === 0) return false;

          event.preventDefault();
          const pos = view.state.selection.from;
          for (const file of files) {
            embedAsset(view, file, pos, onEmbedAsset);
          }
          return true;
        },

        handleDrop: (view, event) => {
          if (!onEmbedAsset) return false;
          const files = imageFiles((event as DragEvent).dataTransfer?.files);
          if (files.length === 0) return false;

          event.preventDefault();
          // Compute drop position from coordinates.
          const coords = view.posAtCoords({
            left: (event as DragEvent).clientX,
            top: (event as DragEvent).clientY,
          });
          const pos = coords?.pos ?? view.state.selection.from;
          for (const file of files) {
            embedAsset(view, file, pos, onEmbedAsset);
          }
          return true;
        },
      },
    });
  }) as unknown as MilkdownPlugin;
}
