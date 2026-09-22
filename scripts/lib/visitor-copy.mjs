/**
 * visitor-copy.mjs — the one filter between maintainer prose and the public website.
 *
 * Story files, component sources and the intent map are written for maintainers and agents:
 * they cite roadmap items (RM-126), ADRs, issues (#221), review documents, fixtures, story
 * ids and repo paths. None of that belongs in a component page's header on elabs-ai.com.
 * The catalog generator passes every candidate lead through `visitorCopy`, and the
 * `catalog-visitor-copy` check rule fails when the generated pages still carry a marker.
 *
 * Pure, dependency-free: the check rule's fixtures run it on strings.
 */

/** A whole sentence is dropped when it carries one of these. */
export const MAINTAINER_SENTENCE = [
  /\bRM-\d+/, // roadmap item
  /\bRS-\d+/, // research topic
  /\bWP-\d+/, // work package
  /\bWI-\d+/, // work item
  /\bADR\s?\d/, // decision record
  /\bD[1-7]\b(?![.-]\d)/, // "the SAFE path (D2)"
  /#\d{2,}\b/, // issue / PR number
  // Storybook stories — but "the chart story" or "a user story" is ordinary prose.
  /\b(?:this|these|each|every|first|second|one|two|three|four|five|six|\d+) stor(?:y|ies)\b/i,
  /\bstor(?:y|ies) (?:files?|ids?|exports?|tests?)\b/i,
  /\bStorybook\b/,
  /\bfixtures?\b/i,
  /\bseededRnd\b/,
  /\bvi\.mock\b/,
  /\bjsdom\b/,
  /\bdemos?\b/i,
  /\bround \d/i,
  /\bgap analysis\b/i,
  /\bregression\b/i,
  /\bmust never import\b/i,
  /\bdedupe\b/i,
  /\bsource of truth\b/i,
  /\bVerify (?:across|with)\b/,
  /\bRemember `import/,
  /\bCompose-only from\b/,
  /(?:^|[\s(`])(?:apps|packages|scripts|docs|registry|skills)\/[\w./-]+/, // repo paths
  /\.(?:stories|test|spec)\.tsx?\b/,
  /\b[\w-]+\.(?:tsx?|mjs|cjs|css|json|md)\b/, // a file name ("see date-format.ts")
  /\b\d{4}-\d{2}-\d{2}\b/, // a date stamp ("enumerated 2026-09-04")
  /\benumerated\b/i,
  /\bTODO\b|\bFIXME\b/,
];

/** Inline references stripped from a sentence that otherwise stays. */
const INLINE_REFS = [
  /\s*\((?:ADR|RM|RS|WP|WI|D\d|#)[^)]*\)/g, // "(ADR 0018)", "(D2)", "(WP-03 #80)"
  /\s*\((?:see|per|cf\.?)\s[^)]*\)/gi, // "(see docs/…)"
];

/**
 * A first sentence that is only a breadcrumb: "Charts / Recipes / River (RM-126)." — every
 * segment a short Title-case label (≤ 3 words). "Opt-in wrapper adding expand / flip-to-table
 * / download-CSV to any child." is prose with slashes, not a breadcrumb.
 */
const BREADCRUMB =
  /^[A-Z][\w'’-]*(?:\s[\w'’-]+){0,2}(?:\s\/\s[A-Z][\w'’-]*(?:\s[\w'’-]+){0,2})+\s*(?:\([^)]*\))?\.?$/;

function splitSentences(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\bvs\.)(?<!\betc\.)(?<!\bcf\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Prose for a visitor: maintainer sentences removed, inline references stripped, a leading
 * breadcrumb dropped. Returns "" when nothing visitor-worthy remains.
 */
export function visitorCopy(text) {
  if (!text) return "";
  const kept = [];
  for (const [i, raw] of splitSentences(String(text)).entries()) {
    if (i === 0 && BREADCRUMB.test(raw)) continue;
    // Strip the inline references first: "(ADR 0018)" at the end of a good sentence must
    // not cost the sentence.
    let sentence = raw;
    for (const re of INLINE_REFS) sentence = sentence.replace(re, "");
    sentence = sentence.replace(/\s+([.,;:])/g, "$1").trim();
    if (MAINTAINER_SENTENCE.some((re) => re.test(sentence))) continue;
    // Code spans read as plain words on the site; the backticks are noise there.
    sentence = sentence.replace(/`|\*\*/g, "");
    if (sentence.length < 12) continue;
    kept.push(sentence);
  }
  return kept.join(" ");
}

/** The first sentence of visitor copy — a card summary or a page lead. */
export function visitorLead(text) {
  const copy = visitorCopy(text);
  return copy ? (splitSentences(copy)[0] ?? "") : "";
}

/** True when `text` still carries a maintainer marker (the check rule's test). */
export function hasMaintainerMarker(text) {
  if (!text) return null;
  const plain = String(text);
  for (const re of MAINTAINER_SENTENCE) {
    const hit = plain.match(re);
    if (hit) return hit[0];
  }
  for (const re of INLINE_REFS) {
    const hit = plain.match(re);
    if (hit) return hit[0].trim();
  }
  return null;
}
