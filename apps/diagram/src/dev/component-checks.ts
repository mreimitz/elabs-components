import { INLINE_ROWS } from "./inline-checks";
import { checkText } from "../spec/check-text";
import { ICON_NAMES } from "../icons/icon-names";
import type { ComponentFile } from "../spec/compose/resolver";
const doc = (ref: string, flow = "") =>
  `diagram: "1"\nnodes:\n  - { id: child, ref: ws/${ref} }\n  - { id: outside }\n${flow}`;
const file = (text: string): ComponentFile => ({ text, mtime: 1 });
const leaf = file(
  'diagram: "1"\ntitle: Resolved child\ncomponent: {icon: aws/rds}\nnodes: [{id: inside}]\n',
);
const chain = new Map<string, ComponentFile>(
  Array.from({ length: 9 }, (_, i) => [
    `n${i}.yaml`,
    file(i === 8 ? 'diagram: "1"' : doc(`n${i + 1}`)),
  ]),
);
const cases: [string, string, Map<string, ComponentFile>, string | null][] = [
  ["Resolved title, icon and count", doc("leaf"), new Map([["leaf.yaml", leaf]]), null],
  ["Missing file", doc("missing"), new Map([["missing.yaml", null]]), "ref-missing"],
  ["Cyclic references", doc("cycle"), new Map([["cycle.yaml", file(doc("cycle"))]]), "ref-cycle"],
  ["Reference depth limit", doc("n0"), chain, "ref-depth"],
  [
    "Unknown inner id",
    doc("leaf", 'flows: ["child.nope -> outside"]'),
    new Map([["leaf.yaml", leaf]]),
    "unknown-endpoint",
  ],
  [
    "Invalid referenced diagram",
    doc("invalid"),
    new Map([["invalid.yaml", file('diagram: "1"\nnodes: [{id: x, type: nope}]')]]),
    "ref-invalid",
  ],
];
const RESOLVED_ROWS = cases.map(([name, text, files, code]) => {
  const result = checkText(text, ICON_NAMES, { files });
  const data = result.spec?.nodes[0]?.data;
  const pass = code
    ? result.issues.some((i) => i.code === code && i.range)
    : result.ok && data?.title === "Resolved child" && data.icon === "aws/rds" && data.count === 1;
  return {
    name,
    pass: Boolean(pass),
    detail: result.issues.map((i) => i.code).join(", ") || "Resolved metadata",
  };
});

export const COMPONENT_ROWS = [...RESOLVED_ROWS, ...INLINE_ROWS];
