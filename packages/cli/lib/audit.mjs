/**
 * @elabs-ai/components-cli — the static-audit detector (token/style/anti-slop lint).
 *
 * Extracted from `bin/brand-ui.mjs` so the rule set is (a) unit-testable
 * (`test/audit.test.mjs`) and (b) reusable by the WP-15 anti-slop CI gate
 * (`scripts/check-anti-slop.mjs`) WITHOUT duplicating the slop patterns — one
 * source of truth. Pure string ops only (no `node:fs`), so it imports cleanly
 * into a pre-build CI gate and into a consuming project's CLI alike.
 *
 * SCOPE — this is the *deterministic* pass. It catches what a regex can prove on
 * a single line of source. The rendered cross-theme / WCAG-contrast / layout-
 * overflow / "does this look AI-generated?" judgments need a browser and live in
 * the `brand-ui-audit` skill (the LLM/visual pass). Perceptual, register-gated
 * judgments (anti-card-overuse, three-equal-feature-cards, motion intensity)
 * deliberately stay OUT of this file — a regex can't read them honestly.
 *
 * WP-15 (#107): harvested the taste-skill's AI-TELLS catalog — both VISUAL tells
 * and the CONTENT "Jane Doe effect" — token-translated. Every prescription that
 * conflicted with brand-ui's rules was reconciled in brand-ui's favor: no raw
 * hex/font literals leak in (the styling/token rules win), and nothing mandates
 * motion. See docs/ADR/0020-taste-profile.md and
 * skills/brand-ui-audit/reference/anti-patterns.md. (The taste-adoption working
 * paper this was harvested from was removed when the fork was debranded.)
 */

/**
 * CONTENT anti-slop — the "Jane Doe effect" (taste-skill §7). The high-value add
 * the audit lacked: generic placeholder names, fake-perfect numbers, and
 * startup-slop brand names baked into shipped source. Brand-agnostic and
 * deterministic, so this exact set is BOTH the audit's content pass AND the
 * ratcheted CI gate (`scripts/check-anti-slop.mjs`). Patterns are NON-global so
 * they're safe for per-line `.test()`; `countContentSlop` clones them with `g`.
 *
 * Deliberately NARROW (low false-positive) — placeholder content is sometimes
 * intentional (stories, copy-own blocks, syntax-doc examples), so the gate
 * RATCHETS (grandfathers what exists, blocks what's new) rather than hard-bans,
 * and these stay ADVISORY in the read-only audit. Filler/marketing words are a
 * separate, even noisier class kept advisory-only (see `marketing-buzzword`),
 * NOT in the hard gate.
 *
 * @type {{ id: string, re: RegExp, msg: string }[]}
 */
export const CONTENT_SLOP_RULES = [
  {
    id: "slop-generic-name",
    // The taste-skill's named offenders + the canonical "<First> Doe" pattern.
    re: /\b(?:john|jane)\s+doe\b|\bsarah\s+chan\b|\bjack\s+su\b/i,
    msg: 'generic placeholder name (the "Jane Doe effect") — use a realistic, domain-specific name',
  },
  {
    id: "slop-fake-number",
    // Fake-perfect stats: "99.9%"/"99.99%" uptime, the "1234567" sequence.
    // Requires a literal "%" so real prices ($99.99) and alpha/fractions (/50,
    // 1/2) and larger numbers (199.99%) do NOT trip it.
    re: /\b99\.9{1,2}\s*%|\b1234567\b/,
    msg: "fake-perfect number (99.99% / 1234567) — use a realistic, specific figure",
  },
  {
    id: "slop-brand-name",
    // Startup-slop brand names. Brand identity lives in tokens + logo, never in
    // hardcoded sample copy — so a real product name belongs here instead.
    re: /\b(?:acme|nexus|smartflow|cloudly)\b/i,
    msg: "slop brand name (Acme/Nexus/SmartFlow/Cloudly) — brand lives in tokens/logo; sample copy should use the real product name",
  },
];

/**
 * VISUAL anti-slop additions (taste-skill §3/§5/§7), token-translated. Each
 * names the brand-ui fix, never a literal. The pre-existing visual rules
 * (raw-hex, gradient-text, side-stripe, over-round, …) live in RULES below; these
 * are the NEW tells the catalog adds. Mostly advisory: a few (`bg-black` overlay
 * scrims, `h-screen` in a deliberately full-bleed shell) are legitimate, so they
 * inform rather than block — the gate's teeth are on CONTENT slop, where a regex
 * is unambiguous.
 *
 * @type {{ id: string, re: RegExp, msg: string, advisory?: boolean }[]}
 */
const VISUAL_SLOP_RULES = [
  {
    id: "pure-black",
    advisory: true,
    // `text/border/ring/fill/stroke-black`, and bare `bg-black` — but NOT
    // `bg-black/<alpha>` (a legitimate overlay scrim, e.g. DialogOverlay).
    re: /\b(?:text|border|ring|fill|stroke)-black\b|\bbg-black\b(?!\/)/,
    msg: "pure black — use a foreground/border token (off-black); bg-black is only OK as an alpha overlay scrim (bg-black/50)",
  },
  {
    id: "neon-glow",
    advisory: true,
    // Arbitrary outer glow: a 0 0 <blur> shadow. Tinted/inset shadow tokens read
    // as depth; a 0-offset glow reads as AI neon.
    re: /(?:drop-)?shadow-\[0_0_/,
    msg: "neon/outer glow (0 0 blur) — use a tinted/inset shadow token, not an outer glow",
  },
  {
    id: "custom-cursor",
    // Tailwind arbitrary (`cursor-[url(…)]`) and CSS / CSS-in-JS (`cursor: url(…)`,
    // `cursor: "url(…)"`) forms.
    re: /cursor-\[url\(|cursor:\s*["']?url\(/,
    msg: "custom mouse cursor — accessibility-hostile and dated; keep the system cursor",
  },
  {
    id: "viewport-h-screen",
    advisory: true,
    // h-screen / min-h-screen use 100vh, which is wrong on mobile (the URL bar
    // gap). Prefer the dvh-backed utilities for a viewport-stable full height.
    re: /\bh-screen\b/,
    msg: "h-screen (100vh) — use min-h-dvh / min-h-[100dvh] for mobile viewport stability",
  },
];

/**
 * COMPOSITION rules — "you reached for the primitive where the library ships the
 * canonical composition". Always ADVISORY: dropping to a primitive is a
 * legitimate, documented escape hatch, so this can inform but must never fail a
 * build. The exemptions are what make it honest — see `exemptWhenFileMatches` /
 * `exemptWhenPathMatches` in the `scanText` docs below.
 *
 * @type {{ id: string, re: RegExp, msg: string, advisory: boolean, exemptWhenFileMatches?: RegExp, exemptWhenPathMatches?: RegExp }[]}
 */
const COMPOSITION_RULES = [
  {
    id: "ai/prefer-composer",
    advisory: true,
    // The opening tag of `PromptInput` ITSELF — never a sub-part
    // (`<PromptInputBody`, `<PromptInputSubmit`, …), which a `Composer` `tools`
    // slot legitimately renders, and never a closing `</PromptInput>`.
    re: /<PromptInput(?![A-Za-z0-9_])/,
    msg: "Use <Composer>; drop to PromptInput only for a bespoke shell (see AI/Composer docs)",
    // (a) a file that renders `<Composer>` is already doing the right thing —
    // a docs page comparing the two, a shell that hosts both. (b) a file that
    // DEFINES `Composer` is `@elabs-ai/components-ai`'s own composer.tsx: it
    // renders `<PromptInput>` because that is what `Composer` is made of.
    exemptWhenFileMatches:
      /<Composer(?![A-Za-z0-9_])|export\s+(?:default\s+)?(?:const|function|class)\s+Composer\b/,
    // (c) the PromptInput family's own modules, stories and tests — a file whose
    // basename starts with `prompt-input` is documenting or exercising the
    // primitive, which is not a composition mistake. (d) any test: mounting the
    // primitive directly is how you unit-test the primitive.
    exemptWhenPathMatches: /(?:^|[\\/])prompt-input[^\\/]*$|\.(?:test|spec)\.[cm]?[jt]sx?$/,
  },
];

/**
 * A file-level opt-out for a SINGLE advisory rule, e.g.
 * `// brand-ui-audit-allow: ai/prefer-composer — this page documents the escape hatch`.
 *
 * Deliberately limited to ADVISORY rules: you may silence a warning you have
 * argued with in prose, never a blocking one (raw color, gradient text, tiny
 * text, content slop). An opt-out that could switch off the teeth would be a
 * bypass, not an exemption.
 */
const ALLOW_MARKER = /brand-ui-audit-allow:\s*([\w/-]+)/g;

/**
 * Every rule id a file opts out of via {@link ALLOW_MARKER}.
 * @param {string} text
 * @returns {Set<string>}
 */
function allowedRuleIds(text) {
  const out = new Set();
  ALLOW_MARKER.lastIndex = 0;
  for (const m of text.matchAll(ALLOW_MARKER)) out.add(m[1]);
  return out;
}

/**
 * The full deterministic rule set. Ported (token-aware) from the impeccable
 * detector's regex engine, then extended with the taste-skill catalog (WP-15).
 *
 * Rule flags:
 *   - `advisory`  — informational; shown in a separate list, never the headline.
 *   - `colorRule` — exempt inside `themes.css` (the one place raw color is legal).
 *   - `copyRule`  — a CONTENT/prose check; skipped in `.css` files (no JSX copy).
 *   - `category`  — grouping for reporting ("content-slop" / "visual-slop" /
 *                   "composition").
 *   - `brandTolerant` — the BRAND register legitimately does this (see below).
 *   - `exemptWhenFileMatches` / `exemptWhenPathMatches` — FILE-scoped exemptions,
 *     evaluated once per scan against the whole text / the file path. Every
 *     other flag is per-line; these exist because "is this file the library that
 *     owns the primitive?" is not a question one line can answer.
 *
 * Regexes are NON-global (safe for per-line `.test()`); never add `g` here.
 *
 * @type {{ id: string, re: RegExp, msg: string, advisory?: boolean, colorRule?: boolean, copyRule?: boolean, category?: string, brandTolerant?: boolean, exemptWhenFileMatches?: RegExp, exemptWhenPathMatches?: RegExp }[]}
 */
export const RULES = [
  // — tokens / color —
  {
    id: "raw-hex",
    colorRule: true,
    re: /#[0-9a-fA-F]{3,8}\b/,
    msg: "raw hex color — use a semantic token (bg-*/text-*/border-*)",
  },
  {
    id: "rgb-literal",
    colorRule: true,
    re: /\b(?:rgb|rgba|hsl|hsla)\(/,
    msg: "raw color function — use a semantic token",
  },
  {
    id: "arbitrary-color",
    colorRule: true,
    re: /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-\[(?:#|(?:rgb|hsl|oklch|oklab|lab|lch|hwb)a?\()/i,
    msg: "arbitrary color value — use a token",
  },
  {
    id: "gradient-text",
    re: /bg-clip-text|background-clip:\s*text|\[background-clip:\s*text\]/,
    msg: "gradient text (bg-clip-text) — banned; use one solid token color, emphasis via weight/size",
  },
  // — radius (brand-ui standardizes on --radius; no hardcoded/over-round) —
  {
    id: "arbitrary-radius",
    re: /\brounded-\[[\d.]+(?:px|rem|em)/,
    msg: "hardcoded radius — use the --radius scale (rounded-sm/md/lg/xl)",
  },
  {
    id: "over-round",
    brandTolerant: true,
    re: /\brounded-(?:3xl|4xl|\[(?:[3-9]\d|\d{3})px\])\b/,
    msg: "over-rounded corner — brand-ui radius is intentionally tight; use rounded-md/lg",
  },
  // — layout / spacing / sizing —
  { id: "space-y-x", re: /\bspace-[xy]-\d/, msg: "space-x/space-y — use flex/grid with gap-*" },
  { id: "wh-equal", re: /\bw-(\d+)\s+h-\1\b/, msg: "w-N h-N with equal values — use size-N" },
  {
    id: "side-stripe",
    brandTolerant: true,
    re: /\bborder-[lr]-(?:2|4|8)\b/,
    msg: "side-stripe accent border — AI tell; use a full border, bg tint, or leading icon",
  },
  // — typography —
  {
    id: "tiny-text",
    re: /\btext-\[(?:[0-9]|10|11)px\]|font-size:\s*(?:[0-9]|1[01])px\b/,
    msg: "body text < 12px — use ≥14px (16px ideal)",
  },
  {
    id: "tight-leading",
    advisory: true,
    re: /\bleading-none\b|line-height:\s*(?:0?\.\d+|1)\s*[;}]/,
    msg: "tight line-height — fine on headings, but body text wants 1.5–1.7",
  },
  {
    id: "justified-text",
    re: /\btext-justify\b|text-align:\s*justify/,
    msg: "justified text — rivers of white; use left-align (or hyphens:auto)",
  },
  // — motion —
  {
    id: "bounce-easing",
    brandTolerant: true,
    re: /\b(?:bounce|elastic)\b|cubic-bezier\([^)]*(?:-0?\.\d|1\.[1-9])/i,
    msg: "bounce/elastic/overshoot easing — use ease-out-quart/quint/expo",
  },
  {
    id: "layout-anim",
    advisory: true,
    re: /transition:\s*[^;]*\b(?:width|height|margin|padding|top|left)\b|transition-\[(?:width|height|margin|padding)/,
    msg: "animating layout properties — prefer transform/opacity (intentional width transitions, e.g. a collapsing sidebar, are fine)",
  },
  // — a11y —
  {
    id: "outline-none",
    advisory: true,
    re: /outline-none(?![^"]*ring)/,
    msg: "outline-none with no ring on the same line — verify a focus-visible:ring exists (line-based check; multi-line classNames may be fine)",
  },
  // — visual anti-slop (WP-15 taste-skill §3/§5/§7, token-translated) —
  ...VISUAL_SLOP_RULES.map((r) => ({ ...r, category: "visual-slop" })),
  // — composition (reach for the canonical composition, not its primitive) —
  ...COMPOSITION_RULES.map((r) => ({ ...r, category: "composition" })),
  // — copy (advisory) —
  {
    id: "marketing-buzzword",
    advisory: true,
    copyRule: true,
    re: /\b(?:streamline|empower|supercharge|leverage|unleash|seamless|world-class|enterprise-grade|next-generation|next-gen|cutting-edge|game-changer|mission-critical|elevate|revolutionize|reimagine|disrupt)\b/i,
    msg: "marketing buzzword / filler verb — name what it literally does",
  },
  {
    id: "em-dash-overuse",
    advisory: true,
    copyRule: true,
    re: /—[^—\n]*—/,
    msg: "two+ em-dashes in a line — use commas/colons/periods",
  },
  // — content anti-slop (WP-15 "Jane Doe effect", taste-skill §7) —
  // Advisory in the read-only audit (placeholders can be intentional); the
  // ratcheted CI gate (scripts/check-anti-slop.mjs) is where these get teeth.
  ...CONTENT_SLOP_RULES.map((r) => ({
    ...r,
    advisory: true,
    copyRule: true,
    category: "content-slop",
  })),
];

/**
 * REGISTER GATING (#108). The taste profile's `register` axis decides WHICH BAR a
 * surface is judged against, so the detector's severities must vary with it —
 * previously every scan assumed `product` and a marketing hero got told off for
 * being expressive. Only the `brandTolerant` rules move, and they only ever
 * SOFTEN (blocking → advisory) in the `brand` register; nothing a repo rule bans
 * outright (raw color, `gradient-text`, tiny text, custom cursors) is negotiable,
 * and CONTENT slop is slop in both registers. The perceptual register-gated tells
 * (3-equal-cards, anti-card-overuse) stay in the skill's rendered pass — a regex
 * can't read them honestly.
 *
 * @param {string} register
 * @returns {boolean} whether `brandTolerant` rules downgrade to advisory.
 */
/**
 * @elabs-ai/components-icons' `ServiceLogo` lets a consumer REGISTER their own service's mark
 * (`registerServiceLogos`) — that mark legitimately paints itself with the
 * service's own brand colour as a raw literal (a Slack purple, a GitHub black),
 * which the raw-color rules below cannot otherwise tell apart from an ordinary
 * component reaching for a literal instead of a token. This is a narrow,
 * LINE-scoped carve-out (consistent with this file's single-line-regex scope,
 * see the file header) keyed off the component name or an explicit
 * `data-service-logo` marker attribute — not a blanket colorRule exemption.
 * See docs/TOKEN_GUIDELINES.md and .claude/rules/icons.md.
 */
const SERVICE_LOGO_MARKER = /\bServiceLogo\b|\bdata-service-logo\b/;

function softensBrandTells(register) {
  return register === "brand";
}

/**
 * Blank out comment spans — `// …` to end of line, and `/* … *\/` (including
 * JSX's `{/* … *\/}`), the LATTER tracked across the whole file rather than
 * one line at a time — before a `colorRule` regex runs (#140). A bare GitHub
 * issue reference (`#254`, `#351`) is made of hex digits and is otherwise
 * indistinguishable from a colour literal by pattern alone; this repo's own
 * convention of citing the motivating issue in a `/** … *\/` docblock means
 * the reference routinely sits on its own line, with no `/*`/`*\/` token on
 * THAT line — a same-line-only check would still miss it, so this walks the
 * text once carrying block-comment state across lines.
 *
 * STRING-AWARE (#140 round 2): a real shipped file
 * (`packages/ui/src/components/file-upload/file-upload.stories.tsx`, via
 * `accept="image/*,.pdf"`) proved that treating `/*`/`//` as comment openers
 * with NO string awareness is a real regression, not a theoretical one — an
 * unmatched `/*` inside an ordinary string (a MIME wildcard, a glob like
 * `"packages/*\/src/index.ts"`) opened a phantom block comment with no closing
 * `*\/` anywhere in the file, so `inBlock` stayed true for everything AFTER
 * it, silently blinding raw-hex/rgb-literal/arbitrary-color for the rest of
 * the file — the opposite of "narrowing a false positive", and exactly what
 * this file's own header warns never to do to a detector.
 *
 * So `/'`/`"`/`` ` ``  open STRING state first, and `//`/`/*` are only
 * recognised as comment openers OUTSIDE a string — a comment delimiter inside
 * a string can never suppress a finding, and (mirror case) a quote character
 * encountered INSIDE a genuine comment is just comment content (blanked like
 * everything else there), never opens a string. Escaped quotes
 * (`\"`/`\'`/`` \` ``) inside a string don't end it. An unescaped newline ends
 * a `'`/`"` string (real JS/TS syntax: that's otherwise a parse error) so one
 * unterminated single/double-quoted string can't swallow the rest of the
 * file either; a template literal (`` ` ``) may legitimately span lines, so
 * newlines inside one don't end it. `${…}` interpolation inside a template
 * literal is NOT tokenized as code — out of scope for this narrow fix; it can
 * only cost a false positive/negative inside the interpolation itself, never
 * bleed past the closing backtick.
 *
 * Net effect: string CONTENTS are left untouched (copied through verbatim),
 * so a genuine hex literal inside a string (`"#ffffff"`, `text-[#FFF]`) is
 * still visible to the regex exactly as before — only the comment-openers'
 * MEANING changes based on string context.
 *
 * Comment characters are replaced with spaces (not removed), so line count,
 * `\n` positions and column offsets are unchanged; callers still report the
 * ORIGINAL line text for a finding, this only changes what the regex sees.
 *
 * LOUD ON UNTERMINATED (#140 round 2 validation): a regex char class, JSX
 * prose or a genuinely unclosed comment can still leave `inBlock`/
 * `stringQuote` true at EOF — the buffer is then over-blanked to the end of
 * the file. Rather than guess harder (no full lexing), the walk reports that
 * non-default end state so the caller can say so instead of trusting it.
 * @param {string} text
 * @returns {{ text: string, unterminated: boolean }}
 */
function blankComments(text) {
  let out = "";
  let inBlock = false;
  let inLine = false;
  let stringQuote = null; // `'`, `"`, "`" while inside a string/template literal, else null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inLine) {
      if (ch === "\n") {
        inLine = false;
        out += ch;
      } else {
        out += " ";
      }
      continue;
    }

    if (inBlock) {
      if (ch === "*" && text[i + 1] === "/") {
        out += "  ";
        i++;
        inBlock = false;
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (stringQuote !== null) {
      if (ch === "\\" && text[i + 1] !== undefined) {
        // an escaped char (\" \' \` \\ …) never ends the string — copy both through.
        out += ch + text[i + 1];
        i++;
        continue;
      }
      if (ch === "\n" && stringQuote !== "`") {
        // an unescaped newline ends a '/" string in real syntax (else a parse
        // error) — fall back to code rather than let one unterminated string
        // swallow the rest of the file. A template literal may span lines.
        stringQuote = null;
        out += ch;
        continue;
      }
      out += ch;
      if (ch === stringQuote) stringQuote = null;
      continue;
    }

    // plain code: comment openers and string openers are both live here.
    if (ch === "/" && text[i + 1] === "/") {
      inLine = true;
      out += "  ";
      i++;
    } else if (ch === "/" && text[i + 1] === "*") {
      inBlock = true;
      out += "  ";
      i++;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      stringQuote = ch;
      out += ch;
    } else {
      out += ch;
    }
  }
  // `inLine` (a trailing `//` comment) is a safe, ordinary EOF — only an
  // unclosed block comment or string/template means the walk above never
  // regained certainty about the rest of the file.
  return { text: out, unterminated: inBlock || stringQuote !== null };
}

/**
 * Scan one file's text against every applicable rule.
 * @param {string} text - the file contents.
 * @param {{ isCss?: boolean, isThemeFile?: boolean, register?: "product"|"brand", path?: string }} [opts]
 *   `register` is the active taste profile's register (default "product", the
 *   restrained bar). See `softensBrandTells`. `path` is the file being scanned,
 *   when the caller knows it — it only ever ADDS exemptions
 *   (`exemptWhenPathMatches`), so omitting it can cost a false positive but
 *   never hides one.
 * @returns {{ rule: string, advisory: boolean, category: string|undefined, line: number, msg: string, text: string }[]}
 */
export function scanText(
  text,
  { isCss = false, isThemeFile = false, register = "product", path } = {},
) {
  const soften = softensBrandTells(register);
  // FILE-scoped exemptions, resolved once rather than per line.
  const allowed = allowedRuleIds(text);
  const exempt = new Set(
    RULES.filter(
      (r) =>
        (r.advisory && allowed.has(r.id)) ||
        (r.exemptWhenFileMatches && r.exemptWhenFileMatches.test(text)) ||
        (r.exemptWhenPathMatches && path !== undefined && r.exemptWhenPathMatches.test(path)),
    ).map((r) => r.id),
  );
  const findings = [];
  const lines = text.split("\n");
  // Comment-blanked twin, only consulted for `colorRule` — a bare issue
  // reference (#254) in prose reads as a colour literal to the raw regex, but
  // never appears outside a comment in real code (#140).
  const blanked = blankComments(text);
  const codeOnlyLines = blanked.text.split("\n");
  // Ended still inside a comment/string it never saw close — surface it
  // rather than silently trust an over-blanked buffer (#140 round 2).
  if (blanked.unterminated) {
    findings.push({
      rule: "unterminated-comment-or-string",
      advisory: false,
      category: undefined,
      line: lines.length,
      msg: "File ends inside an unclosed comment or string — raw-hex/rgb-literal/arbitrary-color checks may have been blind for part of this file; re-check it by hand.",
      text: (lines[lines.length - 1] ?? "").trim().slice(0, 100),
    });
  }
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (exempt.has(rule.id)) continue; // file-scoped exemption / opt-out marker
      if (isThemeFile && rule.colorRule) continue; // themes.css owns raw color
      if (rule.colorRule && SERVICE_LOGO_MARKER.test(line)) continue; // registered service mark — its own brand colour (icons.md)
      if (isCss && rule.copyRule) continue; // no JSX/prose copy in .css
      const target = rule.colorRule ? codeOnlyLines[i] : line;
      if (rule.re.test(target)) {
        findings.push({
          rule: rule.id,
          advisory: Boolean(rule.advisory) || (soften && Boolean(rule.brandTolerant)),
          category: rule.category,
          line: i + 1,
          msg: rule.msg,
          text: line.trim().slice(0, 100),
        });
      }
    }
  });
  return findings;
}

/**
 * Every CONTENT-slop occurrence in `text`, with line + the matched string. Uses
 * a global clone of each (non-global) CONTENT_SLOP_RULES pattern so repeated
 * matches on one line all count. This is the gate's source of truth.
 * @param {string} text
 * @returns {{ id: string, line: number, match: string, msg: string }[]}
 */
export function findContentSlop(text) {
  const out = [];
  const globals = CONTENT_SLOP_RULES.map((r) => ({
    id: r.id,
    msg: r.msg,
    g: new RegExp(r.re.source, r.re.flags.includes("g") ? r.re.flags : r.re.flags + "g"),
  }));
  text.split("\n").forEach((line, i) => {
    for (const { id, msg, g } of globals) {
      g.lastIndex = 0;
      for (const m of line.matchAll(g)) out.push({ id, line: i + 1, match: m[0], msg });
    }
  });
  return out;
}

/** Total CONTENT-slop occurrences in `text` (the ratchet count). */
export function countContentSlop(text) {
  return findContentSlop(text).length;
}
