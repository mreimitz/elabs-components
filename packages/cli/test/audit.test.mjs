// audit.test.mjs — self-test for the static-audit detector (token/style + WP-15
// anti-slop). Locks: (1) the pre-existing token/style rules still fire and the
// themes.css raw-color exemption + the .css copy-rule skip still hold (the
// extraction from bin/brand-ui.mjs preserved behavior); (2) the NEW content-slop
// ("Jane Doe effect") and visual-slop rules fire on slop and stay quiet on clean,
// realistic content (low false positives). Per quality-gates.md "Self-tested gates".
//
// Run: node --test  (from packages/cli) — `pnpm --filter @elabs/components-cli test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText, RULES, CONTENT_SLOP_RULES, countContentSlop } from "../lib/audit.mjs";

const ids = (findings) => findings.map((f) => f.rule);

test("pre-existing token/style rules still fire after extraction", () => {
  const f = scanText('<div className="bg-[#fff] space-y-2 rounded-3xl">x</div>', {});
  assert.ok(ids(f).includes("arbitrary-color"), "arbitrary-color");
  assert.ok(ids(f).includes("space-y-x"), "space-y-x");
  assert.ok(ids(f).includes("over-round"), "over-round");
  assert.ok(ids(f).includes("raw-hex"), "raw-hex (the #fff also matches)");
});

test("themes.css exemption: colorRule rules are skipped in theme files", () => {
  const themed = scanText("--primary: #00b800;", { isCss: true, isThemeFile: true });
  assert.equal(
    themed.filter((x) => x.rule === "raw-hex").length,
    0,
    "raw-hex exempt in themes.css",
  );
  // …but a non-theme css file still flags raw hex.
  const plain = scanText("color: #abcabc;", { isCss: true, isThemeFile: false });
  assert.ok(ids(plain).includes("raw-hex"), "raw-hex still fires outside themes.css");
});

test(".css files skip copyRule (prose/content) checks", () => {
  const css = scanText("/* John Doe — seamless */", { isCss: true });
  assert.equal(css.filter((x) => x.rule === "slop-generic-name").length, 0, "no JSX copy in css");
  assert.equal(css.filter((x) => x.rule === "marketing-buzzword").length, 0);
});

test("content slop (Jane Doe effect) is flagged — advisory + content-slop category", () => {
  const f = scanText(
    '<span>{"John Doe"}</span><span>{"Acme"}</span><span>99.99% uptime</span>',
    {},
  );
  const slop = f.filter((x) => x.category === "content-slop");
  const slopIds = new Set(slop.map((x) => x.rule));
  assert.ok(slopIds.has("slop-generic-name"), "John Doe");
  assert.ok(slopIds.has("slop-brand-name"), "Acme");
  assert.ok(slopIds.has("slop-fake-number"), "99.99%");
  assert.ok(
    slop.every((x) => x.advisory === true),
    "content slop is advisory in the read-only audit (the gate has the teeth)",
  );
});

test("content slop is quiet on realistic content (low false positives)", () => {
  assert.equal(
    countContentSlop("Revenue grew to $4.2M for Northwind Traders"),
    0,
    "real name/number",
  );
  assert.equal(countContentSlop('className="bg-primary/50"'), 0, "/50 alpha is not a fake number");
  assert.equal(countContentSlop("$99.99 per seat / month"), 0, "a price is not a fake stat");
  assert.equal(countContentSlop("199.99% year-over-year"), 0, "199.99% is not the 99.99 fake stat");
});

test("new visual-slop rules fire; legitimate forms are exempt", () => {
  assert.ok(ids(scanText('className="text-black"', {})).includes("pure-black"), "text-black");
  assert.equal(
    scanText('className="bg-black/50"', {}).filter((x) => x.rule === "pure-black").length,
    0,
    "bg-black/<alpha> overlay scrim is exempt",
  );
  assert.ok(
    ids(scanText('className="shadow-[0_0_20px_red]"', {})).includes("neon-glow"),
    "0 0 glow",
  );
  assert.ok(
    ids(scanText('className="min-h-screen"', {})).includes("viewport-h-screen"),
    "h-screen",
  );
  assert.ok(ids(scanText('style={{ cursor: "url(x.png)" }}', {})).includes("custom-cursor"));
});

test("marketing-buzzword catches the taste-skill filler verbs", () => {
  for (const word of ["Elevate", "Revolutionize", "Reimagine", "Seamless", "Unleash"]) {
    assert.ok(
      ids(scanText(`<h1>${word} your workflow</h1>`, {})).includes("marketing-buzzword"),
      word,
    );
  }
});

// ── register gating (#108): the same source, judged against two bars ────────

test("product register (the default) keeps the expressive tells BLOCKING", () => {
  const src = '<div className="rounded-3xl border-l-4 animate-bounce">x</div>';
  for (const register of [undefined, "product"]) {
    const blocking = scanText(src, register ? { register } : {}).filter((f) => !f.advisory);
    const ids = new Set(blocking.map((f) => f.rule));
    assert.ok(ids.has("over-round"), `over-round blocking (register=${register ?? "default"})`);
    assert.ok(ids.has("side-stripe"), `side-stripe blocking (register=${register ?? "default"})`);
    assert.ok(ids.has("bounce-easing"), `bounce blocking (register=${register ?? "default"})`);
  }
});

test("brand register SOFTENS the expressive tells to advisory (never silences them)", () => {
  const src = '<div className="rounded-3xl border-l-4 animate-bounce">x</div>';
  const findings = scanText(src, { register: "brand" });
  for (const id of ["over-round", "side-stripe", "bounce-easing"]) {
    const hit = findings.find((f) => f.rule === id);
    assert.ok(hit, `${id} is still reported in the brand register`);
    assert.equal(hit.advisory, true, `${id} is advisory in the brand register`);
  }
});

test("register gating never softens a hard rule or content slop", () => {
  const hard = '<h1 className="bg-clip-text text-[#ff0000]">{"Jane Doe"} — 99.99%</h1>';
  const brand = scanText(hard, { register: "brand" });
  const blocking = new Set(brand.filter((f) => !f.advisory).map((f) => f.rule));
  assert.ok(blocking.has("gradient-text"), "gradient-text stays banned in brand");
  assert.ok(blocking.has("raw-hex"), "raw color stays banned in brand");
  // Content slop is slop in BOTH registers (advisory here; the gate has teeth).
  const slop = new Set(brand.filter((f) => f.category === "content-slop").map((f) => f.rule));
  assert.ok(slop.has("slop-generic-name"), "Jane Doe is slop in the brand register too");
  assert.ok(slop.has("slop-fake-number"), "99.99% is slop in the brand register too");
});

test("an unknown register falls back to the product (restrained) bar", () => {
  const blocking = scanText('<div className="rounded-3xl" />', { register: "marketing" }).filter(
    (f) => !f.advisory,
  );
  assert.ok(blocking.map((f) => f.rule).includes("over-round"));
});

test("every brandTolerant rule is blocking by default (softening is meaningful)", () => {
  for (const rule of RULES.filter((r) => r.brandTolerant)) {
    assert.ok(!rule.advisory, `${rule.id}: brandTolerant only means something on a blocking rule`);
  }
});

test("CONTENT_SLOP_RULES patterns are non-global (safe for per-line .test())", () => {
  for (const r of CONTENT_SLOP_RULES) {
    assert.ok(!r.re.flags.includes("g"), `${r.id} must be non-global for .test()`);
  }
});
