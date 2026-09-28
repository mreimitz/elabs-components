import type { CodeEditorProps, MonacoCodeEditor } from "@elabs-ai/components-editor";
import { isScalar, parseDocument } from "yaml";
import { catalogService } from "../catalog/catalog-service";
import type { CatalogEntry } from "../catalog/catalog-entry";
import { ICON_NAMES } from "../icons/icon-names";
import { yamlScalar } from "../spec/dialect/write-back";
import { diagramStore } from "../state/diagram-store";
import { workspaceStore } from "../workspace/workspace-store";
import { yamlContext } from "./yaml-context";
import { endpointMetadata, type EndpointMetadata } from "./endpoint-metadata";
import { referenceEndpoints } from "./reference-endpoints";
import { currentComponentFiles } from "../state/component-files";
import { schemasAt, type Schema } from "./yaml-schema";
export { schemasAt } from "./yaml-schema";

type MonacoApi = Parameters<NonNullable<CodeEditorProps["onMount"]>>[1];
const schemaHelp = (schema: Schema) =>
  schema.description ?? (schema.enum ? `Allowed values: ${schema.enum.join(", ")}` : undefined);
const escapeMarkdown = (text: string) => text.replace(/[\\`*_{}[\]()#+.!<>|]/g, "\\$&");
/** Monaco's media sanitizer requires an explicit allowed protocol. Resolve only catalog
 * assets under this app's origin; raw HTML and trusted Markdown remain disabled. */
function iconMarkdown(icon: string | undefined, label: string): string {
  if (!icon?.startsWith("/icons/")) return "";
  const url = new URL(icon, window.location.origin).href
    .replaceAll("(", "%28")
    .replaceAll(")", "%29");
  return `![${escapeMarkdown(label)}](${url})\n\n`;
}
function catalogDocumentation(entry: CatalogEntry) {
  const icon = catalogService.get(entry.icon)?.iconPath;
  return {
    value: `${iconMarkdown(icon, entry.label)}**${escapeMarkdown(entry.label)}**${entry.kind ? ` · ${entry.kind}` : ""}\n\n${escapeMarkdown(entry.description ?? "")}`,
    isTrusted: false,
    supportHtml: false,
  };
}
/** Parse the current buffer, rather than waiting for a successful debounced compile. */
function endpoints(text: string, query = ""): EndpointMetadata[] {
  const state = diagramStore.get();
  const catalog = catalogService.state().entries;
  const local = endpointMetadata(
    text,
    catalog,
    state.compiledText === text ? state.compiled.graph?.nodes : undefined,
  );
  const resolved = referenceEndpoints(text, catalog, currentComponentFiles(), ICON_NAMES, query);
  return [...new Map([...local, ...resolved].map((entry) => [entry.id, entry])).values()];
}
function endpointDocumentation(endpoint: EndpointMetadata) {
  const icon = endpoint.icon ? catalogService.get(endpoint.icon)?.iconPath : undefined;
  const heading = [
    endpoint.title ? `**${escapeMarkdown(endpoint.title)}**` : "",
    endpoint.kind ? escapeMarkdown(endpoint.kind) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    value: `${iconMarkdown(icon, endpoint.title)}${heading}${endpoint.description ? `\n\n${escapeMarkdown(endpoint.description)}` : ""}`,
    isTrusted: false,
    supportHtml: false,
  };
}
const ENDPOINT_KEYS = new Set(["from", "to", "parent", "at", "targets"]);
const SNIPPETS = [
  {
    label: "node",
    path: "nodes",
    body: "id: ${1:node}\nref: ${2:catalog/aws/lambda}\ntitle: ${3:Node}",
  },
  {
    label: "zone",
    path: "zones",
    body: "id: ${1:zone}\nkind: ${2:cloud-account}\ntitle: ${3:Zone}\nchildren:\n  - id: ${4:node}\n    ref: ${5:catalog/aws/lambda}",
  },
  { label: "flow", path: "flows", body: "from: ${1:source}\nto: ${2:target}\nlabel: ${3:Data}" },
  {
    label: "component reference",
    path: "nodes",
    body: "id: ${1:component}\nref: ws/${2:components/qlik-cloud-tenant}\nexpand: false$0",
  },
];

/** Register only for this model; disposing or replacing the editor releases both providers. */
export function registerDiagramLanguage(editor: MonacoCodeEditor, monaco: MonacoApi): () => void {
  const model = editor.getModel();
  if (!model) return () => {};
  let disposed = false;
  const applies = (candidate: typeof model) =>
    !disposed && candidate === model && editor.getModel() === model && !model.isDisposed();
  const completion = monaco.languages.registerCompletionItemProvider("yaml", {
    triggerCharacters: ["/", ":", ">", " ", ".", "-"],
    async provideCompletionItems(candidate, position, _context, token) {
      if (!applies(candidate) || editor.getOption(monaco.editor.EditorOption.readOnly))
        return { suggestions: [] };
      const version = candidate.getVersionId();
      const text = candidate.getValue();
      const context = yamlContext(text, candidate.getOffsetAt(position));
      if (!context) return { suggestions: [] };
      if (
        context.key === "ref" ||
        context.key === "icon" ||
        context.kind === "endpoint" ||
        ENDPOINT_KEYS.has(context.key) ||
        context.path.includes("targets")
      )
        await catalogService.ready();
      if (
        !applies(candidate) ||
        editor.getOption(monaco.editor.EditorOption.readOnly) ||
        token.isCancellationRequested ||
        candidate.getVersionId() !== version
      )
        return { suggestions: [] };
      const start = candidate.getPositionAt(context.from),
        end = candidate.getPositionAt(context.to);
      const range = new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
      const kind = monaco.languages.CompletionItemKind;
      const suggestions: {
        label: string;
        insertText: string;
        kind: number;
        range: typeof range;
        detail?: string;
        documentation?: string | { value: string; isTrusted: boolean; supportHtml: boolean };
        filterText?: string;
        sortText?: string;
        insertTextRules?: number;
      }[] = [];
      const prefix = context.prefix.toLowerCase();
      const add = (
        value: string,
        detail: string,
        itemKind = kind.Value,
        documentation?: string | ReturnType<typeof catalogDocumentation>,
        raw = false,
        search = "",
      ) => {
        const query = prefix.replace(/^(?:catalog|ws)\//, "");
        if (
          prefix &&
          !value.toLowerCase().includes(prefix) &&
          !`${value.replace(/^(?:catalog|ws)\//, "")} ${detail} ${search}`
            .toLowerCase()
            .includes(query)
        )
          return;
        suggestions.push({
          label: value,
          detail,
          kind: itemKind,
          range,
          insertText: raw ? value : yamlScalar(value, context.flow, context.quote),
          documentation,
          filterText: `${context.quote}${context.prefix} ${value} ${detail}`,
          sortText: `${value.toLowerCase().startsWith(prefix) ? "0" : "1"}${value}`,
        });
      };
      if (context.kind === "key" && context.path.includes("targets")) {
        for (const endpoint of endpoints(text, prefix))
          add(endpoint.id, endpoint.title, kind.Reference, endpointDocumentation(endpoint));
      } else if (
        context.kind === "key" &&
        typeof context.path.at(-1) === "number" &&
        schemasAt(context.path, text).some((schema) => schema.enum)
      ) {
        for (const schema of schemasAt(context.path, text))
          for (const value of schema.enum ?? [])
            add(
              String(value),
              schema.description ?? "Allowed value",
              kind.EnumMember,
              schema.description,
              typeof value !== "string",
            );
      } else if (context.kind === "key") {
        for (const schema of schemasAt(context.path, text))
          for (const [key, value] of Object.entries(schema.properties ?? {})) {
            if (context.siblings.includes(key) || suggestions.some((item) => item.label === key))
              continue;
            const hasColon = /^\s*:/.test(text.slice(context.to));
            add(
              key,
              value.description ?? "Diagram property",
              kind.Property,
              value.description,
              true,
            );
            const item = suggestions.find((item) => item.label === key);
            if (item && !hasColon) item.insertText += ": ";
          }
        const container = context.path.filter((p) => typeof p === "string").at(-1);
        for (const snippet of SNIPPETS) {
          const atRoot = context.path.length === 0 && !context.siblings.includes(snippet.path);
          if (
            (!atRoot && container !== snippet.path) ||
            (prefix && !snippet.label.startsWith(prefix))
          )
            continue;
          const lineStart = text.lastIndexOf("\n", context.from - 1) + 1;
          const inList = /^\s*-\s*/.test(text.slice(lineStart, context.from));
          const body = atRoot
            ? `${snippet.path}:\n  - ${snippet.body.replaceAll("\n", "\n    ")}`
            : snippet.body.replaceAll("\n", inList ? "\n  " : "\n");
          suggestions.push({
            label: snippet.label,
            kind: kind.Snippet,
            detail: `Insert a ${snippet.label}`,
            insertText: body,
            range,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          });
        }
      } else if (context.key === "ref") {
        if (!prefix.startsWith("ws/"))
          for (const entry of catalogService.all())
            if (entry.vendor !== "lucide")
              add(
                `catalog/${entry.name}`,
                entry.label,
                kind.Reference,
                catalogDocumentation(entry),
                false,
                entry.aliases.join(" "),
              );
        if (!prefix.startsWith("catalog/"))
          for (const file of workspaceStore.get().tree?.files ?? []) {
            if (file.path === diagramStore.get().path) continue;
            add(
              `ws/${file.path.replace(/\.ya?ml$/i, "")}`,
              file.title ?? file.path,
              kind.File,
              `Workspace diagram: ${file.title ?? file.path}`,
            );
          }
      } else if (context.key === "icon") {
        for (const name of ICON_NAMES) {
          const entry = catalogService.get(name);
          add(
            name,
            entry?.label ?? name,
            kind.Color,
            entry ? catalogDocumentation(entry) : undefined,
          );
        }
      } else if (context.kind === "endpoint" || ENDPOINT_KEYS.has(context.key)) {
        for (const endpoint of endpoints(text, prefix))
          add(endpoint.id, endpoint.title, kind.Reference, endpointDocumentation(endpoint));
      } else {
        for (const schema of schemasAt(context.path, text)) {
          const values = schema.enum ?? (schema.type === "boolean" ? [true, false] : []);
          for (const value of values) {
            if (suggestions.some((item) => item.label === String(value))) continue;
            add(
              String(value),
              schema.description ?? "Allowed value",
              kind.EnumMember,
              schema.description,
              typeof value !== "string",
            );
          }
        }
      }
      return {
        suggestions: suggestions
          .sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label))
          .slice(0, 200),
        incomplete: true,
      };
    },
  });
  const hover = monaco.languages.registerHoverProvider("yaml", {
    async provideHover(candidate, position, token) {
      if (!applies(candidate)) return null;
      const text = candidate.getValue(),
        version = candidate.getVersionId();
      const context = yamlContext(text, candidate.getOffsetAt(position));
      if (!context) return null;
      const raw = text.slice(context.from, context.to);
      const parsed = parseDocument(raw).contents;
      const value = isScalar(parsed) ? String(parsed.value) : raw;
      if (
        context.key === "ref" ||
        context.key === "icon" ||
        context.key === "id" ||
        context.kind === "endpoint" ||
        ENDPOINT_KEYS.has(context.key)
      )
        await catalogService.ready();
      if (
        !applies(candidate) ||
        token.isCancellationRequested ||
        candidate.getVersionId() !== version
      )
        return null;
      const entry =
        context.key === "ref"
          ? catalogService.get(value.replace(/^catalog\//, ""))
          : context.key === "icon"
            ? catalogService.get(value)
            : undefined;
      const schema =
        context.kind === "key"
          ? schemasAt([...context.path, raw], text)
          : schemasAt(context.path, text);
      const endpoint =
        context.kind === "endpoint" || context.key === "id" || ENDPOINT_KEYS.has(context.key)
          ? endpoints(text, value).find((item) => item.id === value)
          : undefined;
      const file =
        context.key === "ref" && value.startsWith("ws/")
          ? workspaceStore
              .get()
              .tree?.files.find(
                (file) =>
                  file.path.replace(/\.ya?ml$/i, "") === value.slice(3).replace(/\.ya?ml$/i, ""),
              )
          : undefined;
      const prose = file
        ? `${file.title ?? file.path}\n\n${file.path}`
        : (endpoint?.title ?? schema.map(schemaHelp).find(Boolean));
      if (!entry && !endpoint && !prose) return null;
      const from = candidate.getPositionAt(context.from),
        to = candidate.getPositionAt(context.to);
      return {
        range: new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column),
        contents: [
          entry
            ? catalogDocumentation(entry)
            : endpoint
              ? endpointDocumentation(endpoint)
              : { value: escapeMarkdown(prose!), isTrusted: false },
        ],
      };
    },
  });
  const release = () => {
    if (disposed) return;
    disposed = true;
    completion.dispose();
    hover.dispose();
    modelDisposal.dispose();
    editorDisposal.dispose();
  };
  const modelDisposal = model.onWillDispose(release);
  const editorDisposal = editor.onDidDispose(release);
  return release;
}
