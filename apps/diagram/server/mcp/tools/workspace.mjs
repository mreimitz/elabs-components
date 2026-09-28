/**
 * DG-35 — workspace tools: the MCP face of `workspace-fs.mjs`, the same functions (and the
 * same safety: paths inside the workspace, atomic writes, `_trash/` instead of delete,
 * mtime conflicts) the app's `/api/workspace` routes call. The open app tab hears every
 * write over the SSE channel and live-reloads (DG-21).
 */
import { viewUrl } from "../view-url.mjs";
import * as workspace from "../../workspace-fs.mjs";

export const PATH = {
  type: "string",
  description: 'Workspace-relative path, e.g. "examples/lakehouse-aws.yaml".',
};

const DIAGRAM_PATH = /\.ya?ml$/i;

/**
 * A diagram's file, for every MCP read. The workspace also holds binary thumbnails
 * (`thumbPathOf`, `<name>.thumb.png` since d2f7f0e2); an LLM reads diagrams only.
 */
export async function readDiagram(path) {
  if (typeof path !== "string" || !DIAGRAM_PATH.test(path)) {
    throw new Error(`Only .yaml diagrams can be read: "${path}".`);
  }
  return workspace.read(path);
}

export const workspaceTools = [
  {
    name: "workspace_tree",
    description:
      "List the Atlas workspace: every folder, and every diagram with its title, kind " +
      "(diagram or component), mtime and size. Call this first to find a diagram's path.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (_, ctx) => {
      const tree = await workspace.list();
      return {
        ...tree,
        files: tree.files.map((file) => ({ ...file, view: viewUrl(ctx, file.path) })),
      };
    },
  },
  {
    name: "diagram_read",
    description:
      "Read one diagram's YAML. Returns { path, mtime, text }. Pass `mtime` back as `base` " +
      "to diagram_write so you never overwrite an edit made in the app meanwhile.",
    inputSchema: {
      type: "object",
      properties: { path: PATH },
      required: ["path"],
      additionalProperties: false,
    },
    handler: async ({ path }, ctx) => {
      const file = await readDiagram(path);
      return { path: file.path, mtime: file.mtime, text: file.text, view: viewUrl(ctx, file.path) };
    },
  },
  {
    name: "diagram_write",
    description:
      "Replace a diagram's YAML. The text is validated first: with any error nothing is " +
      "written and the errors come back (fix them and retry); warnings are returned with the " +
      "result. `base` is the mtime diagram_read gave you; a file changed since answers " +
      '"changed on disk" — read it again. Returns { path, mtime, size, warnings }.',
    inputSchema: {
      type: "object",
      properties: {
        path: PATH,
        text: { type: "string", description: "The whole YAML document." },
        base: { type: "number", description: "The mtime from diagram_read." },
      },
      required: ["path", "text", "base"],
      additionalProperties: false,
    },
    handler: async ({ path, text, base }, ctx) => {
      // DG-26 — a file in a newer dialect than this Atlas reads is left alone, never rewritten
      // (the same guard `compose.mjs`'s editFile applies to a surgical edit).
      const surface = await ctx.bridge.load();
      const current = surface.checkDiagram((await readDiagram(path)).text);
      const newer = current.ast
        ? undefined
        : current.issues.find((i) => i.code === "unsupported-version");
      if (newer) {
        throw new Error(
          `${path} is written in a newer dialect than this Atlas reads (${newer.message}) Leave the file alone: do not change its version or rewrite it.`,
        );
      }
      const warnings = await ctx.bridge.assertValid(text);
      const written = await workspace.write(path, text, { base });
      return { ...written, warnings, view: viewUrl(ctx, written.path) };
    },
  },
  {
    name: "diagram_create",
    description:
      "Create a NEW diagram file (fails if the path exists). The text is validated first, " +
      "as for diagram_write. Start from the author-diagram prompt's cheat-sheet. " +
      "Returns { path, mtime, size, warnings }.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          ...PATH,
          description: 'New workspace-relative path ending in .yaml, e.g. "acme/landscape.yaml".',
        },
        text: {
          type: "string",
          description:
            'The YAML document, starting with diagram: "1" (files that say "0" are read too).',
        },
      },
      required: ["path", "text"],
      additionalProperties: false,
    },
    handler: async ({ path, text }, ctx) => {
      const warnings = await ctx.bridge.assertValid(text);
      const written = await workspace.write(path, text, { exclusive: true });
      return { ...written, warnings, view: viewUrl(ctx, written.path) };
    },
  },
  {
    name: "diagram_move",
    description:
      "Move or rename a diagram (or a folder). Never overwrites: fails if `to` exists. " +
      "Returns { from, to }.",
    inputSchema: {
      type: "object",
      properties: { from: PATH, to: PATH },
      required: ["from", "to"],
      additionalProperties: false,
    },
    handler: async ({ from, to }, ctx) => {
      const moved = await workspace.move(from, to, { overwrite: false });
      return { ...moved, view: viewUrl(ctx, moved.to) };
    },
  },
  {
    name: "diagram_trash",
    description:
      "Move a diagram (or folder) to the workspace's _trash/ folder — recoverable, never " +
      "deleted. Returns { path, trashedTo }.",
    inputSchema: {
      type: "object",
      properties: { path: PATH },
      required: ["path"],
      additionalProperties: false,
    },
    handler: ({ path }) => workspace.trash(path),
  },
];
