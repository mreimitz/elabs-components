/**
 * spec.ts — the A2UI surface protocol (D2, the generative-UI path: "the agent
 * describes a screen as DATA, validated against a catalog").
 *
 * An `A2uiSurface` is plain JSON an agent emits — a tree of catalog nodes. It is
 * NOT JSX (that is `JSXPreview`, the escape hatch) and it carries no code: every
 * `type` must exist in the catalog, every prop is checked against that type's
 * schema, and interaction is a named `on` binding the HOST app resolves
 * (`onAction`). brand-ui renders the tree; the app owns the model call and what
 * an action means (D5).
 *
 * Engine-free on purpose (no React import): `validateA2uiSurface` runs in the
 * browser, in Node, and — bundled by `pnpm gen` — inside the dependency-free
 * `brand-ui a2ui` CLI, so the CLI and `@elabs-ai/components-ai` can never
 * disagree about what a valid surface is.
 */

/** Protocol version this module understands (`"a2ui": "1"` on the root). */
export const A2UI_VERSION = "1";

/** A JSON value an agent may place in a prop. */
export type A2uiJson = string | number | boolean | null | A2uiJson[] | { [key: string]: A2uiJson };

/**
 * A node's prop value: a JSON value, or — for props the catalog types as `node`
 * (`title`, `description`, `actions`, …) — a nested node or list of nodes.
 */
export type A2uiPropValue = A2uiJson | A2uiNode | A2uiNode[];

/** What a bound event sends to the host: a NAME (the app's verb) and a payload. */
export interface A2uiAction {
  /** The host-side verb, e.g. `"approve"`, `"open-order"`. Never a code string. */
  name: string;
  /** Free JSON the agent attaches (an id, a row, a form draft). */
  payload?: A2uiJson;
}

/** An element node. Text nodes are plain strings inside `children`. */
export interface A2uiElement {
  /** A catalog type — `"Card"`, `"Button"`, `"Stack"`, … Unknown types are errors. */
  type: string;
  /** Optional stable id (→ `data-a2ui-id`), useful for the host to address a node. */
  id?: string;
  /** Props checked against the catalog entry's schema. */
  props?: Record<string, A2uiPropValue>;
  /** Child nodes — only for catalog types that accept children. */
  children?: A2uiNode[];
  /**
   * Event bindings by the catalog's event vocabulary (`click`, `change`, …) →
   * the action the host receives. The renderer wires the React handler.
   */
  on?: Record<string, A2uiAction>;
}

export type A2uiNode = string | A2uiElement;

/** The document an agent emits (the whole tool-call result / message part). */
export interface A2uiSurfaceSpec {
  /** Protocol version — currently always `"1"`. */
  a2ui: string;
  /** Optional accessible name for the surface region. */
  title?: string;
  /** The root node — usually a `Stack`, `Grid` or `Card`. */
  root: A2uiNode;
}

/** The value shape of one prop in a catalog entry. */
export type A2uiPropType = "string" | "number" | "boolean" | "node" | "array" | "object" | "any";

export interface A2uiPropSchema {
  type: A2uiPropType;
  /** Closed set of allowed values (strings or numbers); `type` is then informational. */
  enum?: (string | number)[];
  required?: boolean;
  default?: A2uiJson;
  description?: string;
}

/** One catalog type — what an agent may emit for it. */
export interface A2uiCatalogTypeSchema {
  /** Drawn by the renderer itself (`Stack`, `Grid`), not a library component. */
  builtin?: boolean;
  /** May carry `children`. */
  children: boolean;
  /** One line for the agent (rendered by `brand-ui a2ui catalog`). */
  summary?: string;
  /** Prop name → schema. Anything not listed (and not in `A2UI_COMMON_PROPS`) is an error. */
  props: Record<string, A2uiPropSchema>;
  /** Event vocabulary → React handler prop (`click` → `onClick`). */
  events: Record<string, string>;
  /** Where the component comes from (`@elabs-ai/components-ui`) or `"builtin"`. */
  source: string;
}

export type A2uiCatalogSchema = Record<string, A2uiCatalogTypeSchema>;

/**
 * Props every non-builtin element accepts on top of its own schema: the DOM
 * attributes that are safe for an agent to set. Deliberately NO `className` or
 * `style` — a surface inherits the app's theme and tokens; it never restyles.
 */
export const A2UI_COMMON_PROPS: Record<string, A2uiPropSchema> = {
  id: { type: "string" },
  title: { type: "string" },
  role: { type: "string" },
  hidden: { type: "boolean" },
  lang: { type: "string" },
  dir: { type: "string", enum: ["ltr", "rtl", "auto"] },
  "aria-label": { type: "string" },
  "aria-labelledby": { type: "string" },
  "aria-describedby": { type: "string" },
  "aria-hidden": { type: "boolean" },
};

/** Machine-readable problem codes from `validateA2uiSurface`. */
export type A2uiErrorCode =
  | "invalid-root"
  | "unsupported-version"
  | "invalid-node"
  | "unknown-type"
  | "unknown-prop"
  | "missing-prop"
  | "invalid-value"
  | "children-not-allowed"
  | "unknown-event"
  | "invalid-action";

export interface A2uiError {
  /** JSON-pointer-ish path: `root.children[2].props.variant`. */
  path: string;
  /** The path of the NODE that owns the problem (`root.children[2]`) — what a streaming renderer prunes. */
  node: string;
  code: A2uiErrorCode;
  message: string;
}
