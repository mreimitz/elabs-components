/** Cross-reference checks on the normalized AST. Pure: no DOM, no fetch, no JSON imports. React-free. */
import { resolveStory } from "../../story/resolve-story";
import type { ComponentTable } from "../compose/resolver";
import { MAX_COMPONENT_DEPTH } from "../compose/resolver";
import { endHead, refFileOf, refForm } from "./ids";
import { issue, type ArchIssue } from "./issues";
import { nearestName } from "./nearest-name";
import { joinPath } from "./source-map";
import type { ArchDiagram } from "./types";

/** `iconNames`: every icon the app can draw ("aws/lambda", "lucide/user"); the caller builds it (no JSON import here). */
export function validateArch(
  ast: ArchDiagram,
  iconNames: ReadonlySet<string>,
  components?: ComponentTable,
): ArchIssue[] {
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

  // DG-26 — nodes whose ref is a diagram: the only heads a dotted flow end may have (V4).
  const diagramRefOf = new Map(
    ast.nodes.flatMap((n) =>
      n.ref !== undefined && refForm(n.ref) === "diagram" ? [[n.id, n.ref] as const] : [],
    ),
  );
  // A node whose ref does not parse as a catalog reference either draws collapsed (a diagram
  // ref) or is already flagged by `bad-ref`; either way a dotted flow end or `expand:` through
  // it should not also cascade a second, redundant issue.
  const dottableOf = new Set(
    ast.nodes.flatMap((n) => (n.ref !== undefined && refForm(n.ref) !== "catalog" ? [n.id] : [])),
  );

  for (const node of ast.nodes) {
    const file = node.ref && refFileOf(node.ref);
    const entry = file ? components?.get(file) : undefined;
    if (!entry || entry.status === "ok") continue;
    const code =
      entry.status === "missing"
        ? "ref-missing"
        : entry.status === "invalid"
          ? "ref-invalid"
          : entry.status === "cycle"
            ? "ref-cycle"
            : "ref-depth";
    const message =
      entry.status === "missing"
        ? `${node.ref} does not exist (${file}).`
        : entry.status === "invalid"
          ? `${node.ref} cannot be read as a diagram: ${entry.reason}.`
          : entry.status === "cycle"
            ? `${node.ref} references itself: ${entry.chain.join(" → ")}.`
            : `References to diagrams nest more than ${MAX_COMPONENT_DEPTH} deep: ${entry.chain.join(" → ")}.`;
    out.push(issue(code, joinPath(node.path, "ref"), message));
  }

  const steps = new Map<number, string>();
  for (const f of ast.flows) {
    for (const end of ["from", "to"] as const) {
      const id = f[end];
      const head = endHead(id); // DG-26
      if (head !== id) {
        if (!dottableOf.has(head)) {
          out.push(
            issue(
              "unknown-endpoint",
              joinPath(f.path, end),
              zones.has(head) || nodes.has(head)
                ? `"${head}" does not reference a diagram, so "${id}" cannot point inside it.`
                : `No node or zone has the id "${head}".`,
            ),
          );
        }
        let ref = diagramRefOf.get(head);
        const parts = id.slice(head.length + 1).split(".");
        for (const [index, inner] of parts.entries()) {
          const file = ref && refFileOf(ref);
          const entry = file ? components?.get(file) : undefined;
          if (!entry || entry.status !== "ok") break;
          const target = [...entry.ast.nodes, ...entry.ast.zones].find((n) => n.id === inner);
          if (!target) {
            out.push(
              issue("unknown-endpoint", joinPath(f.path, end), `${ref} has no id "${inner}".`),
            );
            break;
          }
          ref = "ref" in target ? target.ref : undefined;
          if (!(ref && refFileOf(ref)) && index < parts.length - 1) {
            out.push(
              issue(
                "unknown-endpoint",
                joinPath(f.path, end),
                `"${inner}" does not reference a diagram, so "${id}" cannot point inside it.`,
              ),
            );
            break;
          }
        }
        continue;
      }
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
    // DG-26 — both ends inside one referenced diagram: a loop on the collapsed node; it belongs there.
    const fromHead = endHead(f.from);
    const inside = diagramRefOf.get(fromHead);
    if (
      inside !== undefined &&
      fromHead === endHead(f.to) &&
      (f.from !== fromHead || f.to !== fromHead)
    ) {
      out.push(
        issue(
          "inner-flow",
          f.path,
          `Both ends are inside "${fromHead}"; draw this flow in ${inside} instead.`,
        ),
      );
    }
    // end DG-26
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
      // DG-24: the nearest known name, in the message and as `suggestion` (a quick fix).
      const suggestion = nearestName(e.icon, iconNames);
      out.push({
        ...issue(
          "unknown-icon",
          joinPath(e.path, "icon"),
          `No icon named "${e.icon}"; the node falls back to its type icon.` +
            (suggestion ? ` Did you mean "${suggestion}"?` : ""),
        ),
        ...(suggestion ? { suggestion } : {}),
      });
    }
  }

  // DG-26 — `expand` means something only on a diagram reference. A node whose ref is already
  // `bad-ref` is skipped too (dottableOf), so this warning does not cascade a second issue.
  for (const n of ast.nodes) {
    if (n.expand === undefined || dottableOf.has(n.id)) continue;
    out.push(
      issue(
        "expand-not-diagram",
        joinPath(n.path, "expand"),
        '"expand" applies only to a node whose ref names a diagram (ws/…); here it does nothing.',
      ),
    );
  }
  for (const node of ast.nodes) {
    if (ast.layout === "manual" && node.expand === true && node.ref && refFileOf(node.ref)) {
      out.push(
        issue(
          "expand-ignored",
          joinPath(node.path, "expand"),
          'This diagram is drawn collapsed because the diagram around it is arranged by hand ("layout: manual").',
        ),
      );
    }
  }

  // end DG-26

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
      const head = endHead(n.at); // DG-26
      out.push(
        issue(
          "unknown-note-target",
          joinPath(n.path, "at"),
          head !== n.at && diagramRefOf.has(head)
            ? `A note attaches to an id in this file; "${n.at}" is inside a referenced diagram.`
            : `No node or zone has the id "${n.at}".`,
        ),
      );
    }
  });

  out.push(...resolveStory(ast, components).issues);
  return out;
}
