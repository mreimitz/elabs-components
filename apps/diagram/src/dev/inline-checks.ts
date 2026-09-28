/** Deterministic expansion fixtures also run on the browser's specification check page. */
import inline from "../spec/compose/__fixtures__/compose-inline.yaml?raw";
import manual from "../spec/compose/__fixtures__/compose-inline-manual.yaml?raw";
import leaf from "../spec/compose/__fixtures__/inline-leaf.yaml?raw";
import { checkText } from "../spec/check-text";
import { ICON_NAMES } from "../icons/icon-names";
const files = new Map([["inline-leaf.yaml", { text: leaf, mtime: 1 }]]);
const expanded = checkText(inline, ICON_NAMES, { files });
const positioned = checkText(manual, ICON_NAMES, { files });
const override = checkText(inline.replace("expand: true", "expand: false"), ICON_NAMES, {
  files,
  expand: new Set(["t"]),
});
const validExpanded = (result: typeof expanded) => {
  const nodes = result.spec?.nodes ?? [];
  const edges = result.spec?.edges ?? [];
  return (
    result.ok &&
    nodes.length === 4 &&
    edges.length === 3 &&
    nodes.find((node) => node.id === "t")?.type === "arch/zone" &&
    nodes
      .filter((node) => node.id.startsWith("t."))
      .every((node) => node.parent === "t" && node.data?.inner === true) &&
    nodes.every(
      (node, index) => !node.id.startsWith("t.") || result.origin[`nodes[${index}]`] === undefined,
    ) &&
    edges.some(
      (edge) =>
        edge.source === "a" && edge.target === "t.x" && edge.data?.innerTarget === undefined,
    )
  );
};
export const INLINE_ROWS = [
  {
    name: "Inline reference contents and endpoint origins",
    pass: validExpanded(expanded),
    detail: "Four nodes, three flows; imported contents have no editable origin",
  },
  {
    name: "Manual references stay collapsed",
    pass:
      positioned.ok &&
      positioned.spec?.nodes.length === 2 &&
      positioned.spec.nodes.find((node) => node.id === "t")?.type === "arch/composite" &&
      positioned.issues.some((issue) => issue.code === "expand-ignored"),
    detail: "Positioned composite with expand-ignored information",
  },
  {
    name: "Temporary reference expansion",
    pass:
      validExpanded(override) &&
      override.ast?.nodes.find((node) => node.id === "t")?.expand === false,
    detail: "Expanded drawing leaves authored expand:false untouched",
  },
];
