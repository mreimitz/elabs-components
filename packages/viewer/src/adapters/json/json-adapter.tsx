"use client";

/**
 * JSON adapter — parses to a real value and renders it as a collapsible tree.
 *
 * Why a tree and not a pretty-printed `<pre>`: the whole reason to open a JSON
 * file in a viewer rather than an editor is to find something in it. A tree
 * collapses the parts you are not reading, and `@elabs-ai/components-ui`'s
 * `Tree` already ships the keyboard model, roving tabindex and virtualization,
 * so this adapter contributes the MAPPING and nothing else.
 *
 * Invalid JSON is a terminal `parse-failed`, reported with the position the
 * engine gave us — not a silent fall-through to plain text, which would hide
 * the one fact the user needs.
 */

import { cn, Tree, type TreeNode, useLocale } from "@elabs-ai/components-ui";
import type { ResolvedFileSource } from "@elabs-ai/components-ui";

import { ViewerError, toViewerError } from "../../core/errors";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { jsonManifest } from "./json-manifest";

export interface JsonDocument extends AdapterDocument {
  kind: "json";
  /** The parsed value. `unknown` on purpose — it is whatever the file held. */
  value: unknown;
  /** The original source text, for the raw view and for copy. */
  text: string;
}

/** A one-line preview of a value, used as the collapsed label for a container. */
function summarize(value: unknown): string {
  if (Array.isArray(value)) return `[${String(value.length)}]`;
  if (value !== null && typeof value === "object") {
    return `{${String(Object.keys(value).length)}}`;
  }
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

/** True for a value that has children worth expanding. */
function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === "object";
}

/**
 * Map a parsed value onto `Tree` nodes.
 *
 * Ids are the JSON path (`$.items[2].name`), which makes them stable across
 * re-renders and directly usable as a "reveal this node" target later.
 */
export function toTreeNodes(value: unknown, path = "$"): TreeNode[] {
  if (!isContainer(value)) return [];

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value);

  return entries.map(([key, child]) => {
    const childPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    const container = isContainer(child);
    return {
      id: childPath,
      label: (
        <span className="font-mono">
          <span className="text-foreground">{key}</span>
          <span className="text-muted-foreground">: </span>
          <span className={container ? "text-muted-foreground" : "text-info-text"}>
            {summarize(child)}
          </span>
        </span>
      ),
      children: container ? toTreeNodes(child, childPath) : undefined,
    };
  });
}

class JsonAdapter implements FileAdapter {
  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<JsonDocument> {
    let text: string;
    try {
      text = await source.text(context.signal);
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }

    try {
      return { kind: "json", value: JSON.parse(text) as unknown, text };
    } catch (error) {
      throw new ViewerError(
        "parse-failed",
        error instanceof Error ? error.message : "Invalid JSON.",
        { fileName: source.name, cause: error },
      );
    }
  }
}

function JsonRenderer({ document: doc, className }: AdapterRendererProps) {
  const json = doc as JsonDocument;
  const { t } = useLocale();
  const nodes = toTreeNodes(json.value);

  // A scalar top level (`42`, `"hello"`, `null`) has no children to expand —
  // a tree of nothing would read as an empty state, which it is not.
  if (nodes.length === 0) {
    return (
      <pre className={cn("text-code font-mono break-words whitespace-pre-wrap", className)}>
        {json.text}
      </pre>
    );
  }

  return (
    <Tree
      aria-label={t("viewer.json.tree")}
      nodes={nodes}
      // The top level open, everything below collapsed: enough to see the shape
      // without paying to build a DOM for a deeply nested document.
      defaultExpandedIds={nodes.map((node) => node.id)}
      selectionMode="none"
      virtualize
      className={cn("h-full overflow-auto", className)}
    />
  );
}

const adapterModule: AdapterModule = {
  manifest: jsonManifest,
  create: () => new JsonAdapter(),
  Renderer: JsonRenderer,
};

export default adapterModule;
