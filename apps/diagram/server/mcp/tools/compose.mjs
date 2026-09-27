/**
 * DG-35 — compose tools: surgical edits through the inspector's write-back
 * (`spec/dialect/write-back.ts`): every line the edit does not touch stays byte-identical,
 * comments included. Each tool reads the file, edits the text, validates, and writes with
 * the mtime it read (a change in between answers "changed on disk").
 */
import * as workspace from "../../workspace-fs.mjs";
import { PATH, readDiagram } from "./workspace.mjs";

const VALUE = {
  description: "A string, number, true/false, a list of strings, or null to remove the key.",
};
const NODE_FIELDS = {
  id: { type: "string", description: "Unique id: a letter, then letters, digits, _ or -." },
  title: { type: "string" },
  type: { type: "string", enum: ["service", "actor", "datastore", "queue", "external", "note"] },
  icon: {
    type: "string",
    description:
      "vendor/name: only for a node with no catalog item (e.g. lucide/activity) or to " +
      "override the reference's icon.",
  },
  subtitle: { type: "string" },
  description: { type: "string" },
  badges: { type: "array", items: { type: "string" } },
  class: { type: "array", items: { type: "string" } },
  tone: { type: "string", enum: ["neutral", "info", "success", "warning", "destructive"] },
  href: { type: "string" },
  text: { type: "string", description: "Body text of a note node." },
  ref: {
    type: "string",
    description:
      "A reference this node's icon, title, subtitle, type, badges, description and docs " +
      "come from, unless the node also writes them: catalog/<pack>/<entry> for a catalog " +
      "item, ws/<folder>/…/<file name> for another workspace diagram (DG-26).",
  },
  expand: { type: "boolean", description: "A diagram ref only: inline it instead of one node." },
  docs: { type: "string" },
  status: { type: "string", enum: ["ok", "degraded", "down", "planned"] },
};
const FLOW_FIELDS = {
  from: { type: "string" },
  to: { type: "string" },
  direction: { type: "string", enum: ["forward", "both"] },
  label: { type: "string" },
  kind: { type: "string", enum: ["data", "request", "access", "control", "network"] },
  style: { type: "string", enum: ["solid", "dashed", "dotted"] },
  secure: { type: "string", enum: ["tls", "vpn", "private-link", "sso", "none"] },
  protocol: { type: "string" },
  schedule: { type: "string" },
  step: { type: "integer" },
  animated: { type: "boolean" },
};

/**
 * Read → edit → validate → write with the read mtime. `edit` returns the new text or null.
 * `hintIds` (DG-26, 1b.10): the ids to check for a "write ref: catalog/<name>" hint after the
 * write; omitted or empty adds no `hints` key.
 */
async function editFile(path, ctx, edit, hintIds) {
  const file = await readDiagram(path);
  const surface = await ctx.bridge.load();
  const checked = await ctx.bridge.check(file.text); // DG-26 (1b): resolves catalog refs
  if (!checked.ast) {
    // DG-26 — a file in a newer dialect than this Atlas reads is left alone, never rewritten.
    const newer = checked.issues.find((i) => i.code === "unsupported-version");
    throw new Error(
      newer
        ? `${path} is written in a newer dialect than this Atlas reads (${newer.message}) Leave the file alone: do not change its version or rewrite it.`
        : `${path} does not parse as a diagram; fix it with diagram_write.`,
    );
  }
  const { ast } = checked;
  const next = edit(file.text, ast, surface);
  if (next === null) {
    throw new Error("This edit cannot be made exactly in the file's text; use diagram_write.");
  }
  const warnings = await ctx.bridge.assertValid(next);
  const written = await workspace.write(path, next, { base: file.mtime });
  const hints = hintIds && hintIds.length > 0 ? await ctx.bridge.refHints(next, hintIds) : [];
  return { ...written, warnings, ...(hints.length > 0 && { hints }) };
}

/** `""` → the top level; `flow:a->b` → that flow; any other string → the zone or node id. */
function resolveTarget(ast, target) {
  if (target === "") return { kind: "top", path: "" };
  const arrow = /^flow:\s*([^\s<>-][^\s<>]*?)\s*(<->|->)\s*(\S+)\s*$/.exec(target);
  if (arrow) {
    const [, from, , to] = arrow;
    const flow = ast.flows.find((f) => f.from === from && f.to === to);
    if (!flow) throw new Error(`No flow ${from} -> ${to}.`);
    return { kind: "flow", flow };
  }
  const entry = [...ast.zones, ...ast.nodes].find((e) => e.id === target);
  if (!entry) throw new Error(`No zone or node has the id "${target}".`);
  return { kind: "entry", path: entry.path };
}

/** JSON null → the write-back's `undefined` (remove the key). */
function toPatch(patch) {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v === null ? undefined : v]));
}

export const composeTools = [
  {
    name: "compose_set",
    description:
      "Set or remove keys on one entry, keeping every other line of the file as it is. " +
      'target: a zone or node id, "flow:<from>-><to>" for a flow, or "" for the top level ' +
      "(title, direction, …). patch: { key: value }, null removes the key. Example: " +
      '{ target: "flow:erp->gateway", patch: { step: 1, label: "CDC" } }. ' +
      "Returns { path, mtime, size, warnings, hints? }: hints names a node whose icon names " +
      "a catalog item; write ref: catalog/<name> if the node is that item.",
    inputSchema: {
      type: "object",
      properties: {
        path: PATH,
        target: { type: "string" },
        patch: { type: "object", description: VALUE.description },
      },
      required: ["path", "target", "patch"],
      additionalProperties: false,
    },
    handler: ({ path, target, patch }, ctx) =>
      editFile(
        path,
        ctx,
        (text, ast, s) => {
          const t = resolveTarget(ast, target);
          if (t.kind === "flow") return s.setFlowKeys(text, t.flow, toPatch(patch));
          // A new top-level key goes under the header (after `title:`), not after `flows:`.
          const options = t.kind === "top" ? { after: "title" } : undefined;
          return s.setEntryKeys(text, t.path, toPatch(patch), options);
        },
        // DG-26 — only a patch that sets an icon can turn a custom node into one worth a hint.
        typeof patch.icon === "string" && target !== "" && !target.startsWith("flow:")
          ? [target]
          : undefined,
      ),
  },
  {
    name: "compose_add_nodes",
    description:
      "Add nodes at the end of a zone's children (into: the zone id) or of the top-level " +
      "nodes list (into omitted). Returns { path, mtime, size, warnings, hints? }: hints " +
      "names a node whose icon names a catalog item; write ref: catalog/<name> if the node " +
      "is that item.",
    inputSchema: {
      type: "object",
      properties: {
        path: PATH,
        into: { type: "string", description: "The zone id; omit for the top level." },
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: NODE_FIELDS,
            required: ["id"],
            additionalProperties: false,
          },
        },
      },
      required: ["path", "nodes"],
      additionalProperties: false,
    },
    handler: ({ path, into, nodes }, ctx) =>
      editFile(
        path,
        ctx,
        (text, ast, s) => {
          let listPath = "nodes";
          if (into !== undefined) {
            const zone = ast.zones.find((z) => z.id === into);
            if (!zone) throw new Error(`No zone has the id "${into}".`);
            listPath = `${zone.path}.children`;
          }
          return s.appendEntries(
            text,
            listPath,
            nodes.map((n) => s.nodeItem(n)),
          );
        },
        nodes.map((n) => n.id),
      ),
  },
  {
    name: "compose_add_flows",
    description:
      "Add flows at the end of the flows list, each written in its shortest form " +
      "(a -> b, a -> b: Label, or a -> b: { label, kind, … }). Returns { path, mtime, size, warnings }.",
    inputSchema: {
      type: "object",
      properties: {
        path: PATH,
        flows: {
          type: "array",
          items: {
            type: "object",
            properties: FLOW_FIELDS,
            required: ["from", "to"],
            additionalProperties: false,
          },
        },
      },
      required: ["path", "flows"],
      additionalProperties: false,
    },
    handler: ({ path, flows }, ctx) =>
      editFile(path, ctx, (text, _ast, s) =>
        s.appendEntries(
          text,
          "flows",
          flows.map((f) => s.flowItem(f)),
        ),
      ),
  },
];
