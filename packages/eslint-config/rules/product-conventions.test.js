/**
 * Self-test for the product-convention ESLint rules (node --test).
 * Run: `pnpm --filter @elabs-ai/components-eslint-config test`.
 */
import test from "node:test";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import plugin from "./product-conventions.js";

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const run = (name, valid, invalid) =>
  test(name, () => {
    ruleTester.run(name, plugin.rules[name], {
      valid: valid.map((code) => ({ code })),
      invalid: invalid.map(([code, messageId, count = 1]) => ({
        code,
        errors: Array.from({ length: count }, () => ({ messageId })),
      })),
    });
  });

run(
  "type-roles",
  [
    'const a = <p className="text-body text-muted-foreground" />;',
    'const a = <p className="text-center text-balance text-kpi" />;',
    'const c = cn("text-title", "text-[var(--x)]");',
  ],
  [
    ['const a = <p className="text-sm" />;', "rawSize"],
    ['const a = <p className="md:text-2xl" />;', "rawSize"],
    ['const c = cn("p-2", "text-[17px]");', "rawSize"],
    ['const v = cva("text-xs/5", { variants: { size: { lg: "text-lg" } } });', "rawSize", 2],
    // nested cn inside className is reported once
    ['const a = <p className={cn("text-base")} />;', "rawSize"],
  ],
);

run(
  "radius-rungs",
  [
    'const a = <div className="rounded-md rounded-control" />;',
    'const a = <div className="rounded-[inherit]" />;',
    'const a = <div className="rounded-[var(--radius-sm)]" />;',
  ],
  [
    ['const a = <div className="rounded-[5px]" />;', "arbitraryRadius"],
    ['const c = cn("rounded-tl-[0.4rem]");', "arbitraryRadius"],
  ],
);

run(
  "focus-ring-only",
  [
    'const a = <button className="focus-ring" />;',
    'const a = <div className="focus-ring-within focus-visible:outline-none" />;',
    // ring-2 ring-ring meaning "selected" is not focus
    'const a = <div className="ring-2 ring-ring" />;',
    'const a = <button className="focus-ring focus-visible:ring-offset-2" />;',
  ],
  [
    [
      'const a = <button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />;',
      "handRolled",
    ],
    ['const a = <div className="focus-visible:outline-none" />;', "handRolled"],
    ['const c = cn("x", "focus:ring-2");', "handRolled"],
  ],
);

run(
  "disabled-recipe",
  [
    'const a = <button className="disabled:pointer-events-none disabled:opacity-50" />;',
    'const a = <input className="disabled:cursor-not-allowed disabled:opacity-50" />;',
    'const v = cva("disabled:pointer-events-none disabled:opacity-50", { variants: { v: { p: "disabled:opacity-100" } } });',
    'const a = <button className="disabled:opacity-100" />;',
  ],
  [
    ['const a = <button className="disabled:opacity-50" />;', "unpaired"],
    ['const c = cn("disabled:opacity-60", "pointer-events-none");', "unpaired"],
  ],
);

run(
  "no-fixed-trigger-width",
  [
    'const a = <SelectTrigger className="min-w-40 w-full" />;',
    'const a = <SelectTrigger className="w-8" />;',
    'const a = <div className="w-64" />;',
    'const a = <button data-slot="tabs-trigger" className="w-[24px]" />;',
  ],
  [
    ['const a = <SelectTrigger className="w-40" />;', "fixedTrigger"],
    ['const a = <Popover.Trigger className="w-[180px]" />;', "fixedTrigger"],
    ['const a = <button data-slot="combobox-trigger" className={cn("w-64")} />;', "fixedTrigger"],
  ],
);

run(
  "logical-props",
  [
    'const a = <div className="ms-2 me-2 ps-4 pe-4 start-0 end-0 border-s border-e rounded-s-md text-start" />;',
    'const a = <div className="border-lime-500 border-red prose leading-5 text-red" />;',
  ],
  [
    ['const a = <div className="ml-2" />;', "physical"],
    ['const a = <div className="md:-mr-1 pl-3 pr-3" />;', "physical", 3],
    [
      'const c = cn("left-0", "right-2", "border-l-2", "rounded-tr-md", "text-right");',
      "physical",
      5,
    ],
  ],
);

run(
  "locale-formatting",
  [
    "const a = n.toLocaleString(locale);",
    "const a = d.toLocaleDateString(locale, { month: 'short' });",
    "const a = new Intl.NumberFormat(locale).format(n);",
    "const a = String(x);",
    "const s = new Date().toString();", // not in JSX
  ],
  [
    ["const a = n.toLocaleString();", "noLocale"],
    ["const a = d.toLocaleTimeString(undefined, {});", "noLocale"],
    ["const a = <span>{new Date(ts).toString()}</span>;", "dateString"],
  ],
);

run(
  "i18n-strings",
  [
    "const a = <span>{label}</span>;",
    "const a = <span>…</span>;",
    "const a = <span> / </span>;",
    "const a = <span>42%</span>;",
    "const a = <span>x</span>;",
    "const a = <button aria-label={labels.copy} />;",
    'const a = <div data-state="open" role="status" />;',
  ],
  [
    ["const a = <span>Copy code</span>;", "text"],
    ['const a = <button aria-label="Close" />;', "attr"],
    ["const a = <input placeholder={`Search…`} />;", "attr"],
    ['const a = <div title={"Details"} />;', "attr"],
  ],
);

run(
  "forward-ref-required",
  [
    "export const Card = forwardRef(function Card({ className, ...props }, ref) { return <div ref={ref} {...props} />; });",
    "export const Card = forwardRef((props, ref) => <div ref={ref} {...props} />);",
    // not exported
    "function Local(props) { return <div {...props} />; }",
    // spreads onto a component, not a DOM element
    "export function Wrapper(props) { return <Card {...props} />; }",
    // React 19 ref-as-prop handled explicitly
    "export function Box({ ref, ...props }) { return <div ref={ref} {...props} />; }",
    // spreads something other than its props
    "export function List({ items }) { return items.map((it) => <li {...it} key={it.id} />); }",
  ],
  [
    ["export function Card({ className, ...props }) { return <div {...props} />; }", "wrap"],
    ["export const Row = (props) => <tr {...props} />;", "wrap"],
    ["function Pane({ ...rest }) { return <section {...rest} />; }\nexport { Pane };", "wrap"],
  ],
);

run(
  "no-index-key-reorderable",
  [
    "const a = items.map((item) => <li key={item.id} />);",
    "const a = items.map((item, i) => <li key={`${item.id}-${i}`} />);",
    // placeholder skeleton lists have no identity
    "const a = Array.from({ length: 3 }).map((x, i) => <li key={i} />);",
    "const a = [...Array(3)].map((x, i) => <li key={i} />);",
    "const a = items.map((_, i) => <li key={i} />);",
    // `i` is not the map index here
    "const i = 1; const a = items.map((item) => <li key={i} />);",
  ],
  [
    ["const a = items.map((item, index) => <li key={index} />);", "indexKey"],
    ["const a = rows.map((row, i) => <tr key={`row-${i}`} />);", "indexKey"],
    ["const a = rows.map(function (row, i) { return <tr key={String(i)} />; });", "indexKey"],
  ],
);
