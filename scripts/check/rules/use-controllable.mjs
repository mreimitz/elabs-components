/**
 * use-controllable — a component supporting both controlled and uncontrolled
 * modes uses the shared controllable-state hook, never a hand-rolled
 * `x !== undefined ? x : internal` + `useState` pair.
 *
 * The shared hooks: `useControllableState` in `packages/ui/src/lib/use-controllable-state.ts`
 * (always calls `onChange`, fixes the mode on first render) and Radix's
 * `@radix-ui/react-use-controllable-state` (what `@elabs-ai/components-ai` uses).
 * Any call to a `useControllable*` hook in the function counts.
 *
 * Detection, per function: it destructures a prop pair `x` + `defaultX`
 * (`value`/`defaultValue`, `open`/`defaultOpen`, `checked`/`defaultChecked`, …, from its
 * parameters or `const { … } = props`) AND owns a `useState` for the same concept (the
 * initialiser reads `defaultX`, or the state variable's name contains `x`) AND calls no
 * `useControllable*` hook. One finding per concept, at the `useState`.
 */
import {
  calleeName,
  isFunctionLike,
  lineOfNode,
  parse,
  ts,
  walk,
  walkOwn,
} from "../lib/ts-ast.mjs";

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

/** propertyName → local binding name, from one ObjectBindingPattern. */
function bindingsOf(pattern, out) {
  const t = ts();
  for (const el of pattern.elements) {
    if (el.dotDotDotToken) continue;
    const prop = el.propertyName
      ? t.isIdentifier(el.propertyName) || t.isStringLiteral(el.propertyName)
        ? el.propertyName.text
        : null
      : t.isIdentifier(el.name)
        ? el.name.text
        : null;
    if (!prop) continue;
    out.set(prop, t.isIdentifier(el.name) ? el.name.text : prop);
  }
}

function checkFunction(fn, sf, file, out) {
  const t = ts();
  const props = new Map();
  for (const p of fn.parameters) if (t.isObjectBindingPattern(p.name)) bindingsOf(p.name, props);
  const states = [];
  let usesHook = false;
  walkOwn(fn, (n) => {
    if (t.isVariableDeclaration(n) && t.isObjectBindingPattern(n.name)) bindingsOf(n.name, props);
    if (t.isCallExpression(n)) {
      const name = calleeName(n);
      if (name && /^useControllable/.test(name)) usesHook = true;
      if (
        name === "useState" &&
        t.isVariableDeclaration(n.parent) &&
        t.isArrayBindingPattern(n.parent.name)
      ) {
        const first = n.parent.name.elements[0];
        const stateName =
          first && t.isBindingElement(first) && t.isIdentifier(first.name) ? first.name.text : "";
        const init = n.arguments[0] ? n.arguments[0].getText(sf) : "";
        states.push({ node: n, stateName, init });
      }
    }
  });
  if (usesHook || states.length === 0) return;
  for (const [prop, local] of props) {
    const m = /^default([A-Z]\w*)$/.exec(prop);
    if (!m) continue;
    const concept = m[1][0].toLowerCase() + m[1].slice(1);
    if (!props.has(concept)) continue;
    const reads = new RegExp(`\\b${local}\\b`);
    // Prefer the state seeded from `defaultX`; fall back to a state named after `x`.
    const state =
      states.find((s) => reads.test(s.init)) ??
      states.find((s) => s.stateName.toLowerCase().includes(concept.toLowerCase()));
    if (!state) continue;
    out.push({
      file,
      line: lineOfNode(sf, state.node),
      msg: `hand-rolled controlled/uncontrolled \`${concept}\`/\`${prop}\` + useState — use useControllableState (packages/ui/src/lib/use-controllable-state.ts or @radix-ui/react-use-controllable-state)`,
    });
  }
}

export function scanText(file, text) {
  if (!text.includes("useState") || !/\bdefault[A-Z]/.test(text)) return [];
  const sf = parse(file, text);
  const out = [];
  walk(sf, (n) => {
    if (isFunctionLike(n)) checkFunction(n, sf, file, out);
  });
  return out;
}

const src = (body) => ({ files: { "packages/ui/src/components/x/x.tsx": body } });

export default {
  id: "use-controllable",
  scope: "components",
  doc: "A component with both controlled and uncontrolled modes (`value`/`defaultValue`, `open`/`defaultOpen`, …) uses `useControllableState` (ui `lib/use-controllable-state.ts` or Radix), never a hand-rolled `useState` + `x !== undefined` pair.",
  baseline: "per-file",
  run(ctx) {
    return ctx
      .glob("packages/*/src/**/*.{ts,tsx}", { ignore: IGNORE })
      .flatMap((file) => scanText(file, ctx.readFile(file)));
  },
  fixtures: {
    pass: [
      src(`import { useControllableState } from "../../lib/use-controllable-state";
export function Combobox({ value: valueProp, defaultValue = "", onValueChange }: Props) {
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);
  const [query, setQuery] = useState("");
  return <input value={value} onChange={(e) => setValue(e.target.value)} />;
}`),
      src(`import { useControllableState } from "@radix-ui/react-use-controllable-state";
export const Reasoning = ({ open, defaultOpen = true, onOpenChange, ...props }: ReasoningProps) => {
  const [isOpen, setIsOpen] = useControllableState({ prop: open, defaultProp: defaultOpen, onChange: onOpenChange });
  const [duration, setDuration] = useState(0);
  return <div data-open={isOpen} {...props} />;
};`),
      // controlled-only: no default pair
      src(`export function Legend({ hoveredIndex, onHover }: Props) {
  const [internalHoveredIndex, setInternal] = useState<number | null>(null);
  return <ul />;
}`),
      // pair present, but the useState is an unrelated concept
      src(`export function Slider({ value, defaultValue }: Props) {
  const [dragging, setDragging] = useState(false);
  return <div />;
}`),
      {
        files: {
          "packages/ui/src/components/x/x.test.tsx":
            "function T({ value, defaultValue }) { const [v] = useState(defaultValue); }",
        },
      },
    ],
    fail: [
      src(`export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value: valueProp, defaultValue, onValueChange, ...props },
  ref,
) {
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = useState<number | null>(
    defaultValue !== undefined ? defaultValue : null,
  );
  const currentValue = isControlled ? valueProp : internalValue;
  return <input ref={ref} {...props} />;
});`),
      src(`export function MermaidWorkspace(props: Props) {
  const { value, defaultValue = "", onValueChange } = props;
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const source = isControlled ? value : internal;
  return <pre>{source}</pre>;
}`),
      src(`export function Panel({ open, defaultOpen = false, children }: PanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  return isOpen ? children : null;
}`),
    ],
  },
};
