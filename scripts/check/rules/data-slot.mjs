/**
 * data-slot — stable-selector ratchet (#312). Ported from scripts/check-data-slot.mjs.
 *
 * `data-slot` is the stable selector seam: a component's root carries
 * `data-slot="<kebab-name>"`, each sub-part `data-slot="<kebab-name>-<part>"`
 * (reference: packages/ai/src/message.tsx). The unit is the MODULE: for every
 * manifest-listed `kind: "value"` component module (`.tsx` under packages/*\/src),
 * one finding whose `weight` is `components − data-slot declarations`. The
 * per-file baseline ratchets that signed gap, so a module fails when:
 *   - it gains a component without gaining a `data-slot` (a new module starts at 0,
 *     so its first slot-less component fails), or
 *   - it loses `data-slot` declarations without losing the parts they labelled.
 * Adding two parts with one new slot also fails (the old pair ratchet let it pass).
 * It counts DECLARATIONS; slot VALUES and per-part coverage are a reviewer's job.
 * `registry/` is not manifest-listed, so it is out of scope.
 */
import { MANIFEST, readManifest } from "../../lib/story-coverage.mjs";
import { lineOf } from "../context.mjs";

/** A `data-slot` ATTRIBUTE (`="x"`, `='x'`, `={X}`); never a `[data-slot="…"]` selector. */
export const DATA_SLOT_RE = /(?<!\[)\bdata-slot\s*=\s*(?:"|'|\{)/g;

/** SCREAMING_SNAKE_CASE exports are constants (#189), never components. */
const CONSTANT_NAME_RE = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
export const isComponentName = (name) =>
  typeof name === "string" && /^[A-Z]/.test(name) && !CONSTANT_NAME_RE.test(name);

export const isGatedModule = (module) =>
  typeof module === "string" &&
  /^packages\/[^/]+\/src\/.+\.tsx$/.test(module) &&
  !/\.(test|stories)\.tsx$/.test(module);

/** Map<module, sortedComponentNames> over the manifest's gated value components. */
export function componentsByModule(manifest) {
  const byModule = new Map();
  for (const pkg of Object.values(manifest?.packages ?? {}))
    for (const comp of pkg?.components ?? []) {
      if (comp?.kind !== "value" || !isComponentName(comp?.name) || !isGatedModule(comp?.module))
        continue;
      byModule.set(comp.module, [...(byModule.get(comp.module) ?? []), comp.name]);
    }
  for (const [mod, names] of byModule) byModule.set(mod, names.sort());
  return byModule;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const WIDGET = "packages/ui/src/components/widget/widget.tsx";
const manifest = (...names) =>
  JSON.stringify({
    packages: {
      "@elabs-ai/components-ui": {
        path: "packages/ui",
        components: [
          ...names.map((name) => ({ name, kind: "value", module: WIDGET })),
          { name: "WidgetProps", kind: "type", module: WIDGET },
          { name: "WIDGET_SOFT_CAP", kind: "value", module: WIDGET },
          { name: "cn", kind: "value", module: "packages/ui/src/lib/cn.ts" },
        ],
      },
    },
  });
const slots = (...s) => s.map((x) => `<div data-slot="${x}" />`).join("\n");
const fx = (names, source, baseline) => ({
  files: { [MANIFEST]: manifest(...names), [WIDGET]: source },
  ...(baseline ? { baseline } : {}),
});
const TWO = ["Widget", "WidgetHeader"];
const THREE = [...TWO, "WidgetFooter"];

export default {
  id: "data-slot",
  scope: "components",
  doc: 'Give every exported component\'s root `data-slot="<kebab-name>"` and each sub-part `data-slot="<kebab-name>-<part>"`; a module never gains a component without a slot or drops a slot without its part.',
  baseline: "per-file",
  run(ctx) {
    const { manifest: mf, error } = readManifest(ctx, "data-slot");
    if (error) return [error];
    const out = [];
    for (const [module, components] of componentsByModule(mf)) {
      if (!ctx.exists(module)) continue; // stale manifest: `pnpm gen`'s problem
      const text = ctx.readFile(module);
      const found = [...text.matchAll(DATA_SLOT_RE)];
      out.push({
        file: module,
        line: found.length ? lineOf(text, found[0].index) : 1,
        msg: `${components.length} component(s) [${components.join(", ")}] vs ${found.length} \`data-slot\` declaration(s) — add \`data-slot\` to the new part (ref packages/ai/src/message.tsx)`,
        weight: components.length - found.length,
      });
    }
    return out;
  },
  fixtures: {
    pass: [
      fx(TWO, slots("widget", "widget-header")), // new module, one slot per part
      fx(TWO, "<div />", { [WIDGET]: 2 }), // steady state
      fx(TWO, slots("widget", "widget-header"), { [WIDGET]: 2 }), // ratchet-down
      fx(THREE, slots("widget", "widget-header", "widget-footer"), { [WIDGET]: 0 }),
      fx(TWO, slots("widget", "widget-header"), { [WIDGET]: 0 }), // part deleted with its slot
      fx(TWO, `<div data-slot={SLOT} />\n<i data-slot='x' />`),
      // a stale manifest entry whose file is gone
      { files: { [MANIFEST]: manifest(...TWO) } },
    ],
    fail: [
      fx(TWO, '<div className="p-2" />'), // new module, no slot
      fx(TWO, slots("widget")), // new module, two parts, one slot
      fx(TWO, 'root.querySelector(`[data-slot="widget"]`) // data-slot prose'), // selectors ≠ declarations
      fx(THREE, slots("widget", "widget-header"), { [WIDGET]: 0 }), // slot-less export in slotted module
      fx(TWO, "<div />", { [WIDGET]: 0 }), // slots stripped, parts kept
      { files: { "packages/ui/src/x.tsx": "" } }, // manifest missing
    ],
  },
};
