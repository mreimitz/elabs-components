// audit.test.mjs — self-test for the static-audit detector (token/style + WP-15
// anti-slop). Locks: (1) the pre-existing token/style rules still fire and the
// themes.css raw-color exemption + the .css copy-rule skip still hold (the
// extraction from bin/brand-ui.mjs preserved behavior); (2) the NEW content-slop
// ("Jane Doe effect") and visual-slop rules fire on slop and stay quiet on clean,
// realistic content (low false positives). Per quality-gates.md "Self-tested gates".
//
// Run: node --test  (from packages/cli) — `pnpm --filter @elabs-ai/components-cli test`.
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

// ── comment-span exemption for colorRule (#140) ──────────────────────────────
// `raw-hex` (and its colorRule siblings) matched `#<hex digits>` ANYWHERE,
// including a bare GitHub issue reference in prose (`#254`) — indistinguishable
// from a colour literal by the pattern alone. The fix narrows colorRule
// matching to skip `//` and `/* */` comment spans (including a `/** */`
// docblock spanning MULTIPLE lines — brand-ui's own source cites issue numbers
// that way, see this file's header) WITHOUT weakening the rule on real code.

test("raw-hex ignores a bare issue reference in a line comment", () => {
  assert.equal(
    scanText("// see #254 for the discussion", {}).filter((x) => x.rule === "raw-hex").length,
    0,
    "a // comment citing an issue number is not a colour literal",
  );
});

test("raw-hex ignores a bare issue reference in a single-line block comment", () => {
  assert.equal(
    scanText("/* #351's fix landed here */", {}).filter((x) => x.rule === "raw-hex").length,
    0,
    "a /* */ comment citing an issue number is not a colour literal",
  );
});

test("the issue's own fixture: // see #254 plus a real bg-[#fff] — one finding, not two", () => {
  const f = scanText('const x = "bg-[#fff]"; // see #254', {});
  const rawHex = f.filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "only the real hex literal fires, not the issue reference");
});

test("raw-hex ignores an issue reference inside a MULTI-LINE docblock (the real repro)", () => {
  // Mirrors packages/ai/src/composer.stories.tsx's own header: a `/** … */`
  // JSDoc block where the issue number sits on its own line, with no `/*` or
  // `*/` token on that line — a same-line-only check would still miss this.
  const docblock = [
    "/**",
    ' * tone="card" (#254): the tinted-outer/distinct-inner "double card" — an',
    " * outer bg-card frame (#351's P0 fix).",
    " */",
    'export const real = "bg-[#fff]";',
  ].join("\n");
  const f = scanText(docblock, {});
  const rawHex = f.filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "only the real code line fires; both docblock lines stay quiet");
  assert.equal(rawHex[0].line, 5, "the one finding is the real code line, not a docblock line");
});

test("raw-hex teeth are intact: every genuine raw-hex form still fires outside comments", () => {
  const cases = [
    ['className="bg-[#fff]"', "3-digit hex in a class string"],
    ['style={{ color: "#ffffff" }}', "6-digit hex in a style object"],
    ['const v = cva("", { variants: { tone: { brand: "text-[#FFF]" } } });', "hex in a cva map"],
    ["color: #abcabc;", "hex in a plain CSS declaration"],
  ];
  for (const [line, label] of cases) {
    assert.ok(ids(scanText(line, {})).includes("raw-hex"), `${label} still flags raw-hex`);
  }
});

test("a hex literal BEFORE a trailing issue-reference comment on the same line still fires", () => {
  const f = scanText("background: #ff00aa; // tracked in #254", {});
  const rawHex = f.filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "the real literal before the comment is still caught");
});

// ── round 2: blankComments must be STRING-aware (validator FAIL, #140) ──────
// `/*` inside an ORDINARY string (a MIME wildcard, a glob) is not a comment
// opener. Without string awareness it opens a phantom block comment with no
// matching `*/`, which silently blinds raw-hex for the REST OF THE FILE — a
// real regression a validator caught using a real shipped file
// (file-upload.stories.tsx's `accept="image/*,.pdf"`). These lock the fix in
// both directions: the phantom-comment bug is closed, AND the original
// comment-span exemption above still holds.

test("a string containing an unmatched /* (a MIME wildcard) does not blind the rest of the file", () => {
  // Mirrors the validator's real-file repro: file-upload.stories.tsx contains
  // `accept="image/*,.pdf"` with no closing `*/` anywhere after it — a naive
  // block-comment tracker never recovers, so every raw-hex after it vanishes.
  const src = [
    'export const Basic = { accept: "image/*,.pdf" };',
    "",
    'export const bad = "#ff0000";',
  ].join("\n");
  const rawHex = scanText(src, {}).filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "the real hex on line 3 must still fire");
  assert.equal(rawHex[0].line, 3);
});

test("a string containing an unmatched /* (a glob) does not blind the rest of the file", () => {
  const src = ['const pattern = "packages/*/src/index.ts";', 'export const bad = "#ff0000";'].join(
    "\n",
  );
  const rawHex = scanText(src, {}).filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "the real hex on line 2 must still fire");
});

test("a URL string (containing //) on its own line does not blind a later line", () => {
  const src = ['const u = "https://example.com";', 'export const bad = "#ff0000";'].join("\n");
  const rawHex = scanText(src, {}).filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "the real hex on line 2 must still fire");
});

test('color: "#ff0000" // brand red — the hex before the trailing comment still fires', () => {
  const rawHex = scanText('color: "#ff0000" // brand red', {}).filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "a hex INSIDE a string, before a later // comment, still fires");
});

test("a hex-looking fragment inside a string that also contains // is NOT suppressed — it is inside a STRING, not a comment", () => {
  // Decision (asked for explicitly): once blankComments is string-aware, the
  // whole `"https://x.dev/#ffffff"` literal is ONE string — its contents are
  // copied through untouched, so raw-hex sees `#ffffff` exactly as it would
  // in any other string. This is deliberate, not a regression: the mirror
  // requirement is "a comment delimiter inside a string must not suppress
  // detection" — a `//` that happens to sit inside a string is not a real
  // comment, so it must not blank anything, including a hex-looking fragment
  // later in the SAME string.
  const rawHex = scanText('const link = "https://x.dev/#ffffff";', {}).filter(
    (x) => x.rule === "raw-hex",
  );
  assert.equal(rawHex.length, 1, "the hex-looking fragment inside the string still fires");
});

test("a quote character INSIDE a genuine comment does not open a phantom string", () => {
  // Mirror case: brand-ui's own docblock convention puts a JSX-attribute
  // example like `tone="card"` inside a `/** */` block. The `"` there must
  // stay comment content (blanked), never flip the tracker into string state
  // and swallow real code after the comment closes.
  const src = [
    "/**",
    ' * tone="card" (#254): the tinted-outer/distinct-inner "double card".',
    " */",
    'export const bad = "#ff0000";',
  ].join("\n");
  const rawHex = scanText(src, {}).filter((x) => x.rule === "raw-hex");
  assert.equal(rawHex.length, 1, "the real hex after the docblock still fires");
  assert.equal(rawHex[0].line, 4);
});

test("round 2 regression lock: reverting blankComments' string-awareness fails this test", () => {
  // A second, maximally adversarial fixture combining an unmatched /* in a
  // string with the ORIGINAL issue-reference case, so a partial revert (e.g.
  // string-awareness for '"' but not the escape/newline handling) still gets
  // caught: an unmatched-/* string, a genuine hex, AND a docblock issue ref,
  // all in one file.
  const src = [
    'export const glob = "packages/*/src/**";',
    "/**",
    " * see #254 for context",
    " */",
    'export const bad = "#ff0000";',
  ].join("\n");
  const f = scanText(src, {});
  const rawHex = f.filter((x) => x.rule === "raw-hex");
  assert.equal(
    rawHex.length,
    1,
    "the real hex still fires despite the unmatched /* and the docblock issue ref",
  );
  assert.equal(rawHex[0].line, 5);
});

// ── round 2 fix: loud on unterminated, not silent (#140 validator PASS-WITH-NOTES) ──
// Three constructs the round-2 string-aware tokenizer still can't parse
// correctly (no full lexing) — each walks it into `inBlock`/`stringQuote` with
// no way back out before EOF. Rather than guess harder, `scanText` now says so.

test("a regex character class containing /* leaves the file unterminated — the guard fires", () => {
  const src = ["const re = /[/*]/;", 'export const bad = "#ff0000";'].join("\n");
  const findings = scanText(src, {});
  const guard = findings.filter((x) => x.rule === "unterminated-comment-or-string");
  assert.equal(guard.length, 1, "the EOF-still-inside-a-comment guard must fire");
  assert.equal(guard[0].advisory, false, "a blind file is a blocking finding, not advisory");
});

test("JSX prose containing a glob (src/*.ts) leaves the file unterminated — the guard fires", () => {
  const src = ["const Help = () => <code>src/*.ts</code>;", 'export const bad = "#ff0000";'].join(
    "\n",
  );
  const findings = scanText(src, {});
  const guard = findings.filter((x) => x.rule === "unterminated-comment-or-string");
  assert.equal(guard.length, 1, "the EOF-still-inside-a-comment guard must fire");
});

test("a genuinely unterminated /* block comment (no closing */) — the guard fires", () => {
  const src = ["/* this docblock never closes", 'export const bad = "#ff0000";'].join("\n");
  const findings = scanText(src, {});
  const guard = findings.filter((x) => x.rule === "unterminated-comment-or-string");
  assert.equal(guard.length, 1, "the EOF-still-inside-a-comment guard must fire");
});

test("a normal, fully-terminated file never trips the unterminated guard", () => {
  const src = ['export const ok = "#ff0000"; // fine, closes normally'].join("\n");
  const findings = scanText(src, {});
  assert.equal(findings.filter((x) => x.rule === "unterminated-comment-or-string").length, 0);
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

// ── ServiceLogo raw-color carve-out (#25) ────────────────────────────────────
// @elabs-ai/components-icons' ServiceLogo lets a consumer register their OWN service mark,
// which legitimately carries that service's own brand colour as a raw literal —
// the raw-color rule can't tell that apart from an ordinary component painting
// itself with a literal, so it needs a narrow, line-scoped carve-out keyed off
// the component name / a `data-service-logo` marker (styling-and-tokens.md).

test("ServiceLogo carve-out: a raw-color line naming ServiceLogo (or data-service-logo) is exempt — narrow, not blanket", () => {
  const marked = scanText('<path d="M0 0" fill="#4A154B" /> {/* ServiceLogo */}', {});
  assert.equal(
    marked.filter((x) => x.rule === "raw-hex").length,
    0,
    "raw-hex exempt when the line names ServiceLogo",
  );

  const dataAttr = scanText('<svg data-service-logo fill="#4A154B">', {});
  assert.equal(
    dataAttr.filter((x) => x.rule === "raw-hex").length,
    0,
    "raw-hex exempt via the data-service-logo marker",
  );

  // Teeth: an UNRELATED raw-hex line still fails — this is not a blanket exemption.
  const unrelated = scanText('<div style={{ color: "#4A154B" }} />', {});
  assert.ok(ids(unrelated).includes("raw-hex"), "raw-hex still fires without the marker");
});

// ── composition: ai/prefer-composer (RM-007, #146) ───────────────────────────
// `Composer` is the canonical brand-ui chat input; `PromptInput` is the
// primitive it is made of. The rule nudges consumer code back to `Composer`
// WITHOUT ever failing a build — dropping to the primitive for a bespoke shell
// is a legitimate, documented escape hatch. Its whole honesty rests on the
// file-scoped exemptions, so those are what these tests pin.

const CONSUMER_CHAT = `
import { PromptInput, PromptInputBody, PromptInputTextarea } from "@elabs-ai/components-ai";
export function Chat() {
  return (
    <PromptInput onSubmit={send}>
      <PromptInputBody><PromptInputTextarea /></PromptInputBody>
    </PromptInput>
  );
}
`;

test("ai/prefer-composer flags a hand-rolled PromptInput in consumer code", () => {
  const f = scanText(CONSUMER_CHAT, { path: "src/components/chat.tsx" });
  const hit = f.find((x) => x.rule === "ai/prefer-composer");
  assert.ok(hit, "fires on a direct <PromptInput> render");
  assert.equal(hit.category, "composition");
  assert.match(hit.msg, /Use <Composer>/);
});

test("ai/prefer-composer is a WARNING, never an error — it can never fail --strict", () => {
  const f = scanText(CONSUMER_CHAT, { path: "src/components/chat.tsx" });
  const hits = f.filter((x) => x.rule === "ai/prefer-composer");
  assert.ok(hits.length > 0);
  assert.ok(
    hits.every((x) => x.advisory === true),
    "advisory in every register",
  );
  // `cmdAudit`'s buckets: blocking = !advisory && category !== "content-slop".
  // Being advisory AND outside content-slop is what keeps it off both.
  assert.ok(
    hits.every((x) => x.category !== "content-slop"),
    "never counted as content slop (which --strict DOES fail on)",
  );
  for (const register of ["product", "brand"]) {
    const scoped = scanText(CONSUMER_CHAT, { path: "src/chat.tsx", register });
    assert.ok(
      scoped.filter((x) => x.rule === "ai/prefer-composer").every((x) => x.advisory === true),
      `advisory in the ${register} register`,
    );
  }
});

test("ai/prefer-composer never fires on a PromptInput SUB-PART or a closing tag", () => {
  const subparts = `
    <Composer tools={<PromptInputButton />} />
    <PromptInputBody /><PromptInputSubmit /><PromptInputTools />
  `;
  assert.equal(
    scanText(subparts, { path: "src/x.tsx" }).filter((x) => x.rule === "ai/prefer-composer").length,
    0,
    "sub-parts are not the primitive",
  );
  // A closing tag alone must not double-count the same render.
  const oneRender = scanText("<PromptInput onSubmit={s}>\n</PromptInput>\n", {
    path: "src/x.tsx",
  }).filter((x) => x.rule === "ai/prefer-composer");
  assert.equal(oneRender.length, 1, "one finding per opening tag, not one per line of the element");
});

test("ai/prefer-composer exemption: a file that also renders <Composer> is quiet", () => {
  const both = `${CONSUMER_CHAT}\nexport const Canonical = () => <Composer onSubmit={send} />;`;
  assert.equal(
    scanText(both, { path: "apps/docs/stories/compare.stories.tsx" }).filter(
      (x) => x.rule === "ai/prefer-composer",
    ).length,
    0,
    "a page comparing the two is not making the mistake",
  );
});

test("ai/prefer-composer exemption: the library that DEFINES Composer is quiet", () => {
  // packages/ai/src/composer.tsx renders <PromptInput> because that is what
  // Composer is made of — and it does NOT render <Composer>, so the
  // renders-a-Composer exemption alone would miss it.
  const composerSource = `
export function Composer({ onSubmit }) {
  return <PromptInput onSubmit={onSubmit}><PromptInputBody /></PromptInput>;
}
`;
  assert.equal(
    scanText(composerSource, { path: "packages/ai/src/composer.tsx" }).filter(
      (x) => x.rule === "ai/prefer-composer",
    ).length,
    0,
    "the composer's own source is exempt",
  );
});

test("ai/prefer-composer exemption: the PromptInput family's own files and any test are quiet", () => {
  for (const path of [
    "packages/ai/src/prompt-input.tsx",
    "packages/ai/src/prompt-input.stories.tsx",
    "packages/ai/src/prompt-input-slash.stories.tsx",
    "packages/ai/src/microcopy.test.tsx",
    "src/chat.spec.jsx",
  ]) {
    assert.equal(
      scanText(CONSUMER_CHAT, { path }).filter((x) => x.rule === "ai/prefer-composer").length,
      0,
      `exempt: ${path}`,
    );
  }
});

test("ai/prefer-composer: the path exemptions are NARROW (teeth intact)", () => {
  for (const path of [
    "src/components/prompt.tsx", // not the prompt-input family
    "src/components/my-prompt-input.tsx", // the basename must START with it
    "src/prompt-input/chat.tsx", // a DIRECTORY of that name is not the family
    "apps/web/app/chat/page.tsx",
  ]) {
    assert.ok(
      scanText(CONSUMER_CHAT, { path }).some((x) => x.rule === "ai/prefer-composer"),
      `still fires: ${path}`,
    );
  }
  // No path at all: the rule still fires (omitting `path` may cost a false
  // positive, but must never hide one).
  assert.ok(
    scanText(CONSUMER_CHAT, {}).some((x) => x.rule === "ai/prefer-composer"),
    "fires without a path",
  );
});

// ── the advisory-only opt-out marker ─────────────────────────────────────────

test("brand-ui-audit-allow silences ONE advisory rule in ONE file", () => {
  const marked = `// brand-ui-audit-allow: ai/prefer-composer — documented bespoke shell\n${CONSUMER_CHAT}`;
  assert.equal(
    scanText(marked, { path: "apps/docs/stories/mention.stories.tsx" }).filter(
      (x) => x.rule === "ai/prefer-composer",
    ).length,
    0,
    "the named rule is silenced",
  );
  // …and only that one: an unrelated advisory rule in the same file still fires.
  const other = `// brand-ui-audit-allow: ai/prefer-composer\n<div className="text-black" />`;
  assert.ok(
    scanText(other, { path: "src/x.tsx" }).some((x) => x.rule === "pure-black"),
    "an unnamed rule is untouched",
  );
});

test("brand-ui-audit-allow can NEVER silence a blocking rule", () => {
  for (const [id, line] of [
    ["raw-hex", 'color: "#ff0000"'],
    ["gradient-text", '<h1 className="bg-clip-text">x</h1>'],
    ["over-round", '<div className="rounded-3xl" />'],
  ]) {
    const text = `// brand-ui-audit-allow: ${id}\n${line}`;
    assert.ok(
      scanText(text, { path: "src/x.tsx" }).some((x) => x.rule === id && !x.advisory),
      `${id} stays blocking despite the marker`,
    );
  }
  // …including a `brandTolerant` rule in the BRAND register, where the FINDING
  // is softened to advisory. The opt-out keys off the rule's static `advisory`
  // flag, not the softened finding, or the register would become a bypass.
  const brand = scanText('// brand-ui-audit-allow: over-round\n<div className="rounded-3xl" />', {
    path: "src/x.tsx",
    register: "brand",
  });
  assert.ok(
    brand.some((x) => x.rule === "over-round"),
    "over-round is still REPORTED in the brand register despite the marker",
  );
});
