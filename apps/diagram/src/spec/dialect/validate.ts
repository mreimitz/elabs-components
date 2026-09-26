/** Cross-reference checks on the normalized AST. Pure: no DOM, no fetch, no JSON imports. React-free. */
import { issue, type ArchIssue } from "./issues";
import { joinPath } from "./source-map";
import type { ArchDiagram } from "./types";

/** `iconNames`: every icon the app can draw ("aws/lambda", "lucide/user"); the caller builds it (no JSON import here). */
export function validateArch(ast: ArchDiagram, iconNames: ReadonlySet<string>): ArchIssue[] {
  const out: ArchIssue[] = [];
  const zones = new Map<string, (typeof ast.zones)[number]>();
  const nodes = new Map<string, (typeof ast.nodes)[number]>();

  // duplicate-id — zones and nodes share one id space.
  for (const e of [...ast.zones, ...ast.nodes]) {
    if (zones.has(e.id) || nodes.has(e.id)) {
      out.push(
        issue(
          "duplicate-id",
          joinPath(e.path, "id"),
          `The id "${e.id}" is used twice; ids must be unique.`,
        ),
      );
      continue;
    }
    if ("kind" in e) zones.set(e.id, e);
    else nodes.set(e.id, e);
  }

  // parent references.
  for (const e of [...ast.zones, ...ast.nodes]) {
    if (e.parent === undefined) continue;
    const at = joinPath(e.path, "parent");
    if (nodes.has(e.parent)) {
      out.push(issue("parent-not-zone", at, `"${e.parent}" is a node; parent must name a zone.`));
    } else if (!zones.has(e.parent)) {
      out.push(issue("unknown-parent", at, `No zone has the id "${e.parent}".`));
    }
  }

  // parent-cycle — only reachable through parent: (nesting cannot loop).
  for (const z of ast.zones) {
    const seen = new Set<string>([z.id]);
    let cur = z.parent;
    while (cur !== undefined) {
      if (seen.has(cur)) {
        if (cur === z.id) {
          out.push(
            issue(
              "parent-cycle",
              joinPath(z.path, "parent"),
              `Zone "${z.id}" ends up inside itself through its "parent:" key.`,
            ),
          );
        }
        break;
      }
      seen.add(cur);
      cur = zones.get(cur)?.parent;
    }
  }

  for (const n of ast.nodes) {
    if (n.type === "external" && n.parent !== undefined) {
      out.push(
        issue(
          "external-in-zone",
          n.path,
          `"${n.id}" is external but sits inside zone "${n.parent}"; external nodes usually live outside every zone.`,
        ),
      );
    }
  }

  // missing-owner — only a top-level zone (no parent, by nesting or parent:); nested
  // zones inherit the enclosing zone's owner (resolved by DG-10).
  for (const z of ast.zones) {
    if (z.parent === undefined && z.owner === undefined) {
      out.push(
        issue(
          "missing-owner",
          joinPath(z.path, "id"),
          `Zone "${z.id}" has no owner; it is drawn as customer.`,
        ),
      );
    }
  }

  if (ast.layout !== "manual") {
    for (const e of [...ast.zones, ...ast.nodes]) {
      if (e.position) {
        out.push(
          issue(
            "position-without-manual",
            joinPath(e.path, "position"),
            `"position:" is only read under "layout: manual"; remove it or set "layout: manual".`,
          ),
        );
      }
    }
  }

  const steps = new Map<number, string>();
  for (const f of ast.flows) {
    for (const end of ["from", "to"] as const) {
      const id = f[end];
      if (zones.has(id)) {
        out.push(
          issue(
            "zone-endpoint",
            joinPath(f.path, end),
            `"${id}" is a zone; the edge attaches to the zone's border.`,
          ),
        );
      } else if (!nodes.has(id)) {
        out.push(
          issue("unknown-endpoint", joinPath(f.path, end), `No node or zone has the id "${id}".`),
        );
      }
    }
    if (f.step !== undefined) {
      const first = steps.get(f.step);
      if (first !== undefined) {
        out.push(
          issue(
            "duplicate-step",
            joinPath(f.path, "step"),
            `"step: ${f.step}" is also used by "${first}"; steps number a walkthrough and should be unique.`,
          ),
        );
      } else {
        steps.set(f.step, `${f.from} -> ${f.to}`);
      }
    }
  }

  const classOwners = [...ast.zones, ...ast.nodes, ...ast.flows];
  for (const e of classOwners) {
    (e.class ?? []).forEach((name, i) => {
      if (!Object.hasOwn(ast.styles, name)) {
        out.push(
          issue(
            "unknown-class",
            `${joinPath(e.path, "class")}[${i}]`,
            `No style named "${name}" under "styles:".`,
          ),
        );
      }
    });
  }

  for (const e of [...ast.zones, ...ast.nodes]) {
    if (e.icon !== undefined && !iconNames.has(e.icon)) {
      out.push(
        issue(
          "unknown-icon",
          joinPath(e.path, "icon"),
          `No icon named "${e.icon}"; the node falls back to its type icon.`,
        ),
      );
    }
  }

  const providers = new Set([...iconNames].map((name) => name.split("/")[0]));
  for (const z of ast.zones) {
    if (z.provider !== undefined && !providers.has(z.provider)) {
      out.push(
        issue(
          "unknown-provider",
          joinPath(z.path, "provider"),
          `No icon pack named "${z.provider}"; the zone shows no provider logo.`,
        ),
      );
    }
  }

  ast.notes.forEach((n) => {
    if (!zones.has(n.at) && !nodes.has(n.at)) {
      out.push(
        issue(
          "unknown-note-target",
          joinPath(n.path, "at"),
          `No node or zone has the id "${n.at}".`,
        ),
      );
    }
  });

  return out;
}
