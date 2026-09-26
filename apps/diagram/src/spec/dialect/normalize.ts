/** Plain YAML value → normalized ArchDiagram + structural issues. Sugar is expanded here. React-free. */
import { validateProps, type SpecIssue } from "@elabs-ai/components-ui/definition";
import { FLOW_DEF, NODE_DEF, ROOT_DEF, STYLE_DEF, ZONE_DEF } from "./definitions";
import { ARROW_DIRECTION, ARROW_RE, ID_RE } from "./ids";
import { isArchIssueCode, issue, type ArchIssue } from "./issues";
import { aliasPaths, indexPath, joinPath, type SourceMap } from "./source-map";
import {
  DIALECT_VERSION,
  type ArchDiagram,
  type ArchFlowSpec,
  type ArchNodeSpec,
  type ArchStyleSpec,
  type ArchZoneSpec,
} from "./types";

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** Keys only a zone has / only a node has — derived from the definitions so they never drift. */
const ZONE_ONLY = Object.keys(ZONE_DEF.fields).filter((k) => !(k in NODE_DEF.fields));
const NODE_ONLY = Object.keys(NODE_DEF.fields).filter((k) => !(k in ZONE_DEF.fields));

export interface NormalizeResult {
  ast: ArchDiagram | null;
  issues: ArchIssue[];
}

/**
 * ui SpecIssue → ArchIssue. Our severity table wins (unknown-prop becomes a warning).
 * validateProps also emits "not-an-object" (validate.ts L214) → wrong-type here;
 * "deprecated-prop" cannot occur (no field is deprecated).
 */
function fromDefinition(found: readonly SpecIssue[]): ArchIssue[] {
  return found.map((i) =>
    issue(isArchIssueCode(i.code) ? i.code : "wrong-type", i.path, i.message),
  );
}

/** Top-level keys under `base` that carry an error (their values are not copied into the AST). */
function badKeys(found: readonly ArchIssue[], base: string): Set<string> {
  const out = new Set<string>();
  const prefix = base ? `${base}.` : "";
  for (const i of found) {
    if (i.severity !== "error" || !i.path.startsWith(prefix)) continue;
    const key = i.path.slice(prefix.length).split(/[.[]/)[0];
    if (key) out.add(key);
  }
  return out;
}

function pick<T>(rec: Rec, key: string, bad: Set<string>): T | undefined {
  return bad.has(key) || rec[key] === undefined || rec[key] === null ? undefined : (rec[key] as T);
}

export function normalizeArch(raw: unknown, map: SourceMap): NormalizeResult {
  if (!isRecord(raw) || !("diagram" in raw)) {
    return {
      ast: null,
      issues: [
        issue(
          "not-a-diagram",
          "",
          'This is not an architecture diagram: the file needs a top-level mapping that starts with diagram: "0".',
        ),
      ],
    };
  }
  if (String(raw.diagram) !== DIALECT_VERSION) {
    return {
      ast: null,
      issues: [
        issue(
          "unsupported-version",
          "diagram",
          `diagram: ${JSON.stringify(raw.diagram)} is not supported; this app reads dialect "0".`,
        ),
      ],
    };
  }

  const issues: ArchIssue[] = [];
  const check = (def: Parameters<typeof validateProps>[0], rec: unknown, path: string) => {
    const found = fromDefinition(validateProps(def, rec, { path }).issues);
    issues.push(...found);
    return badKeys(found, path);
  };

  const rootBad = check(ROOT_DEF, raw, "");
  // Lists are read item by item even when one item is bad, so one typo does not
  // turn every flow into unknown-endpoint. Bad items were reported by ROOT_DEF.
  const list = (key: string): readonly unknown[] => {
    const value = raw[key];
    return Array.isArray(value) ? value : [];
  };
  const zones: ArchZoneSpec[] = [];
  const nodes: ArchNodeSpec[] = [];

  const readEntry = (
    entry: unknown,
    path: string,
    forced: "zone" | "node" | undefined,
    nestParent?: string,
  ) => {
    if (!isRecord(entry)) return; // already reported by the enclosing array's field
    let kind = forced;
    if (!kind) {
      const z = ZONE_ONLY.filter((k) => k in entry);
      const n = NODE_ONLY.filter((k) => k in entry);
      if (z.length > 0 && n.length > 0) {
        issues.push(
          issue(
            "ambiguous-entry",
            path,
            `This entry mixes zone keys (${z.join(", ")}) and node keys (${n.join(", ")}); split it into a zone and a node.`,
          ),
        );
        return;
      }
      kind = z.length > 0 ? "zone" : "node";
    }
    const bad = check(kind === "zone" ? ZONE_DEF : NODE_DEF, entry, path);
    const id = pick<string>(entry, "id", bad);
    if (id === undefined) return;
    if (!ID_RE.test(id)) {
      issues.push(
        issue(
          "bad-id",
          joinPath(path, "id"),
          `"${id}" is not a valid id: use letters, digits, _ and -, starting with a letter or _.`,
        ),
      );
    }
    const declared = pick<string>(entry, "parent", bad);
    if (nestParent !== undefined && declared !== undefined && declared !== nestParent) {
      issues.push(
        issue(
          "parent-conflict",
          joinPath(path, "parent"),
          `"${id}" is nested in "${nestParent}" but says parent: ${declared}; remove one of the two.`,
        ),
      );
    }
    const parent = nestParent ?? declared;
    const common = {
      path,
      id,
      ...(parent !== undefined && { parent }),
      title: pick<string>(entry, "title", bad) ?? id,
      subtitle: pick<string>(entry, "subtitle", bad),
      description: pick<string>(entry, "description", bad),
      icon: pick<string>(entry, "icon", bad),
      class: pick<readonly string[]>(entry, "class", bad),
      position: pick<{ x: number; y: number }>(entry, "position", bad),
    };
    if (kind === "zone") {
      zones.push({
        ...common,
        kind: pick(entry, "kind", bad) ?? "generic",
        owner: pick(entry, "owner", bad),
        provider: pick(entry, "provider", bad),
        collapsed: pick<boolean>(entry, "collapsed", bad) ?? false,
        direction: pick(entry, "direction", bad),
      });
      const children = pick<readonly unknown[]>(entry, "children", bad) ?? [];
      children.forEach((child, j) =>
        readEntry(child, indexPath(joinPath(path, "children"), j), undefined, id),
      );
    } else {
      nodes.push({
        ...common,
        type: pick(entry, "type", bad) ?? "service",
        variant: pick(entry, "variant", bad),
        badges: pick(entry, "badges", bad),
        tone: pick(entry, "tone", bad),
        href: pick(entry, "href", bad),
        text: pick(entry, "text", bad),
      });
    }
  };

  list("zones").forEach((z, i) => readEntry(z, indexPath("zones", i), "zone"));
  list("nodes").forEach((n, i) => readEntry(n, indexPath("nodes", i), "node"));

  const flows: ArchFlowSpec[] = [];
  list("flows").forEach((item, i) => {
    const path = indexPath("flows", i);
    const badFlow = (message: string) => issues.push(issue("bad-flow", path, message));
    const endsFrom = (source: string, sourceKeyPath: string, fromKey: boolean) => {
      const m = ARROW_RE.exec(source);
      if (!m) return null;
      const range = (fromKey ? map.keys : map.values).get(sourceKeyPath);
      if (range && m.indices) {
        const quoted = map.text[range[0]] === '"' || map.text[range[0]] === "'";
        const base = range[0] + (quoted ? 1 : 0);
        const f = m.indices[1];
        const t = m.indices[3];
        if (f) map.values.set(joinPath(path, "from"), [base + f[0], base + f[1]]);
        if (t) map.values.set(joinPath(path, "to"), [base + t[0], base + t[1]]);
      }
      return {
        from: m[1] as string,
        to: m[3] as string,
        direction: ARROW_DIRECTION[m[2] as keyof typeof ARROW_DIRECTION],
      };
    };

    let rec: Rec;
    let form: ArchFlowSpec["form"];
    if (typeof item === "string") {
      const ends = endsFrom(item, path, false);
      if (!ends)
        return badFlow(`Flow "${item}" is not "a -> b"; ids use letters, digits, _ and -.`);
      rec = ends;
      form = "string";
    } else if (isRecord(item)) {
      const keys = Object.keys(item);
      const only = keys.length === 1 ? keys[0] : undefined;
      if (only !== undefined && !(only in FLOW_DEF.fields)) {
        const keyPath = joinPath(path, only);
        const ends = endsFrom(only, keyPath, true);
        if (!ends)
          return badFlow(`Flow "${only}" is not "a -> b"; ids use letters, digits, _ and -.`);
        const value = item[only];
        if (isRecord(value)) {
          if ("from" in value || "to" in value || "direction" in value) {
            return badFlow(
              `The shorthand "${only}" already names both ends; remove from, to and direction from its value.`,
            );
          }
          aliasPaths(map, keyPath, path);
          rec = { ...value, ...ends };
        } else if (value === null) {
          rec = ends;
        } else if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          const r = map.values.get(keyPath);
          if (r) map.values.set(joinPath(path, "label"), r);
          rec = { ...ends, label: String(value) };
        } else {
          return badFlow(`The value of "${only}" must be a label or a mapping of flow keys.`);
        }
        form = "shorthand";
      } else {
        rec = item;
        form = "object";
      }
    } else {
      return; // not a string or mapping: ROOT_DEF already reported wrong-type here
    }

    const bad = check(FLOW_DEF, rec, path);
    const from = pick<string>(rec, "from", bad);
    const to = pick<string>(rec, "to", bad);
    if (from === undefined || to === undefined) return;
    flows.push({
      path,
      form,
      from,
      to,
      direction: pick(rec, "direction", bad) ?? "forward",
      kind: pick(rec, "kind", bad) ?? "data",
      animated: pick<boolean>(rec, "animated", bad) ?? false,
      label: pick(rec, "label", bad),
      style: pick(rec, "style", bad),
      secure: pick(rec, "secure", bad),
      protocol: pick(rec, "protocol", bad),
      schedule: pick(rec, "schedule", bad),
      step: pick(rec, "step", bad),
      class: pick(rec, "class", bad),
    });
  });

  const styles: Record<string, ArchStyleSpec> = {};
  const rawStyles = isRecord(raw.styles) ? raw.styles : {};
  for (const [name, value] of Object.entries(rawStyles)) {
    const bad = check(STYLE_DEF, value, joinPath("styles", name));
    if (!isRecord(value)) continue;
    styles[name] = {
      tone: pick(value, "tone", bad),
      badge: pick(value, "badge", bad),
    };
  }

  const notes = list("notes").flatMap((n, i) =>
    isRecord(n) && typeof n.at === "string" && typeof n.text === "string"
      ? [{ path: indexPath("notes", i), at: n.at, text: n.text }]
      : [],
  );

  return {
    ast: {
      version: DIALECT_VERSION,
      title: pick(raw, "title", rootBad),
      direction: pick(raw, "direction", rootBad) ?? "LR",
      nodeStyle: pick(raw, "nodeStyle", rootBad) ?? "icon",
      theme: pick(raw, "theme", rootBad),
      legend: pick(raw, "legend", rootBad) ?? "auto",
      layout: pick(raw, "layout", rootBad) ?? "auto",
      zones,
      nodes,
      flows,
      styles,
      notes,
    },
    issues,
  };
}
