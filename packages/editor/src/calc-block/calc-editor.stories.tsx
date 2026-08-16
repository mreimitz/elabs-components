import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

import { MarkdownEditor } from "../markdown-editor";
import { MarkdownWorkspace } from "../markdown-workspace";
import type {
  CalcComplete,
  CalcCompletion,
  CalcEditorHooks,
  CalcToken,
  CalcTokenize,
  EvaluateCalc,
} from "./types";

/**
 * Calc AUTHORING (#220) — the editor side of calc. The same `--calc-*` tokens
 * `CalcBlock` renders with now drive LIVE highlighting + autocomplete + result
 * inlays inside `calc` fences, in BOTH the Monaco source surface and the Milkdown
 * WYSIWYG surface. Opt in via the `calc` prop with the consumer's hooks — the
 * library decorates, the consumer computes (no calc engine is bundled).
 *
 * The `demoEngine` below stands in for the consumer's real evaluator (a tiny
 * arithmetic + currency engine); it is intentionally OUTSIDE the package.
 */
const meta = {
  title: "Editor/CalcEditor",
  component: MarkdownWorkspace,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MarkdownWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ----------------------------- demo calc engine ---------------------------- */
/* A toy arithmetic + currency engine — the CONSUMER's domain logic, here only to
   make the stories live. A real app supplies its own `tokenize`/`evaluate`/`complete`. */

const CURRENCIES: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
const FUNCTIONS = ["sum", "avg", "min", "max", "round"];

function createDemoEngine(): Required<CalcEditorHooks> {
  /** Var names seen by the latest evaluate — lets `tokenize` mark dangling refs. */
  const defined = new Set<string>();

  const tokenize: CalcTokenize = (line) => {
    const tokens: CalcToken[] = [];
    const commentAt = line.indexOf("//");
    const code = commentAt >= 0 ? line.slice(0, commentAt) : line;
    if (commentAt >= 0) {
      tokens.push({ start: commentAt, end: line.length, kind: "comment", resolved: true });
    }
    const isDef = /^\s*[A-Za-z_]\w*\s*=/.test(code);
    let seenEq = false;
    const re = /([A-Za-z_]\w*)|(\d[\d,]*(?:\.\d+)?)|([-+*/=()])|(%)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      const text = m[0];
      const start = m.index;
      const end = start + text.length;
      if (m[1]) {
        if (text in CURRENCIES) tokens.push({ start, end, kind: "currency", resolved: true });
        else if (FUNCTIONS.includes(text))
          tokens.push({ start, end, kind: "function", resolved: true });
        else if (isDef && !seenEq) tokens.push({ start, end, kind: "var-def", resolved: true });
        else tokens.push({ start, end, kind: "var-ref", resolved: defined.has(text) });
      } else if (m[2]) {
        tokens.push({ start, end, kind: "number", resolved: true });
      } else if (m[3]) {
        if (text === "=") seenEq = true;
        tokens.push({ start, end, kind: "operator", resolved: true });
      } else if (m[4]) {
        tokens.push({ start, end, kind: "unit", resolved: true });
      }
    }
    return tokens.sort((a, b) => a.start - b.start);
  };

  /** Evaluate one expression string against the numeric env (precedence-correct). */
  function evalExpr(expr: string, env: Map<string, number>): number {
    const toks =
      expr.replace(/\b(EUR|USD|GBP)\b/g, " ").match(/\d[\d,]*\.?\d*|[A-Za-z_]\w*|[-+*/()]/g) ?? [];
    let i = 0;
    const peek = () => toks[i];
    const prim = (): number => {
      const t = toks[i++];
      if (t === "(") {
        const v = addsub();
        if (peek() === ")") i++;
        return v;
      }
      if (t && /^\d/.test(t)) return Number(t.replace(/,/g, ""));
      const v = t ? env.get(t) : undefined;
      if (v === undefined) throw new Error(`Undefined symbol "${t ?? "?"}"`);
      return v;
    };
    const muldiv = (): number => {
      let v = prim();
      while (peek() === "*" || peek() === "/") {
        const op = toks[i++];
        const r = prim();
        v = op === "*" ? v * r : v / r;
      }
      return v;
    };
    function addsub(): number {
      let v = muldiv();
      while (peek() === "+" || peek() === "-") {
        const op = toks[i++];
        const r = muldiv();
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }
    return addsub();
  }

  const evaluate: EvaluateCalc = (source) => {
    const env = new Map<string, number>();
    const units = new Map<string, string>();
    defined.clear();
    const results = source.split("\n").map((raw, idx) => {
      const line = idx + 1;
      const tokens = tokenize(raw);
      const code = raw.includes("//") ? raw.slice(0, raw.indexOf("//")) : raw;
      const trimmed = code.trim();
      if (trimmed === "" || trimmed.startsWith("#")) return { line, tokens };
      const def = /^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(code);
      const name = def?.[1];
      const expr = def ? def[2] : code;
      const curMatch = /\b(EUR|USD|GBP)\b/.exec(expr);
      try {
        const value = evalExpr(expr, env);
        // Unit: an explicit currency in the line, else inherited from a referenced var.
        let unit = curMatch?.[1];
        if (!unit) {
          for (const id of expr.match(/[A-Za-z_]\w*/g) ?? []) {
            if (units.has(id)) {
              unit = units.get(id);
              break;
            }
          }
        }
        if (name) {
          env.set(name, value);
          defined.add(name);
          if (unit) units.set(name, unit);
        }
        const display = unit
          ? `${CURRENCIES[unit] ?? ""}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
        return {
          line,
          tokens,
          value: {
            kind: unit ? ("currency" as const) : ("number" as const),
            raw: value,
            unit,
            display,
          },
        };
      } catch (err) {
        return { line, tokens, error: { message: (err as Error).message } };
      }
    });
    const totals = results.filter((r) => r.value).map((r) => Number(r.value!.raw));
    const last = results.filter((r) => r.value).at(-1);
    return {
      results,
      total: last?.value
        ? { ...last.value }
        : totals.length
          ? {
              kind: "number",
              raw: totals.reduce((a, b) => a + b, 0),
              display: String(totals.reduce((a, b) => a + b, 0)),
            }
          : undefined,
    };
  };

  const complete: CalcComplete = ({ source, prefix }) => {
    const vars = new Set<string>();
    for (const line of source.split("\n")) {
      const m = /^\s*([A-Za-z_]\w*)\s*=/.exec(line);
      if (m?.[1]) vars.add(m[1]);
    }
    const items: CalcCompletion[] = [];
    for (const v of vars) items.push({ label: v, insert: v, kind: "variable", detail: "variable" });
    for (const f of FUNCTIONS)
      items.push({ label: f, insert: `${f}()`, kind: "function", detail: "function" });
    for (const c of Object.keys(CURRENCIES))
      items.push({ label: c, insert: c, kind: "currency", detail: "currency unit" });
    const p = prefix.toLowerCase();
    return p ? items.filter((i) => i.label.toLowerCase().startsWith(p)) : items;
  };

  return { tokenize, evaluate, complete };
}

const demoEngine = createDemoEngine();

const DOC = [
  "# Trip budget",
  "",
  "Live numbers for the Lisbon trip — edit a value and the answers update.",
  "",
  "```calc",
  "flights = 320 EUR",
  "hotel = 95 EUR * 4",
  "transit = 60 EUR",
  "total = flights + hotel + transit",
  "mystery = ghost + 1 // a dangling ref",
  "```",
  "",
  "The fence above is highlighted and shows each line's result inline.",
].join("\n");

function Frame({ children }: { children: ReactNode }) {
  return <div className="h-[520px] bg-background p-4 text-foreground">{children}</div>;
}

/**
 * The hybrid workspace in SPLIT mode: the Monaco source pane highlights the
 * `calc` fence + shows result inlays, and the preview renders the same fence as
 * a branded `CalcBlock`. Type inside the fence (e.g. `flights`) for completions.
 */
export const Workspace: Story = {
  render: () => (
    <Frame>
      <MarkdownWorkspace defaultValue={DOC} defaultMode="split" calc={demoEngine} />
    </Frame>
  ),
};

/**
 * SOURCE mode — the Monaco surface alone: calc highlighting, end-of-line result
 * inlays, and autocomplete (Ctrl+Space or type a variable prefix inside the fence).
 */
export const SourceEditor: Story = {
  render: () => (
    <Frame>
      <MarkdownWorkspace defaultValue={DOC} defaultMode="source" calc={demoEngine} />
    </Frame>
  ),
};

/**
 * The Milkdown WYSIWYG surface — the `calc` fence renders as an editable code
 * block with the SAME calc highlighting + result inlays via a ProseMirror
 * decoration plugin. Type `/calc` on a new line to insert a fresh fence.
 */
export const Wysiwyg: Story = {
  render: () => (
    <Frame>
      <MarkdownEditor defaultValue={DOC} calc={demoEngine} className="h-full" />
    </Frame>
  ),
};

/** Highlight + inlays with NO `complete` hook — a consumer who only wrote `evaluate`. */
export const EvaluateOnly: Story = {
  render: () => (
    <Frame>
      <MarkdownWorkspace
        defaultValue={DOC}
        defaultMode="split"
        calc={{ evaluate: demoEngine.evaluate }}
      />
    </Frame>
  ),
};
