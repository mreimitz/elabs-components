/**
 * #310 — Streamdown renders its own chrome (code-block copy/download, table
 * menus, Mermaid toolbar, external-link interstitial) from a `translations`
 * prop we never passed, so a `<LocaleProvider>` stopped at the markdown
 * boundary and every streamed surface leaked English.
 *
 * These assertions run against the REAL Streamdown (no mock) — a stand-in would
 * prove nothing about the shipped surface.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@elabs-ai/components-ui";
import { MessageResponse } from "./message";
import { MarkdownView } from "./markdown-view";
import { Reasoning, ReasoningContent } from "./reasoning";

const CODE_MARKDOWN = "```js\nconst a = 1;\n```";
// `MarkdownView` re-maps `code` onto `ProseInlineCode`, so its Streamdown chrome
// surfaces on the table toolbar rather than the code-block header.
const TABLE_MARKDOWN = "| a | b |\n| --- | --- |\n| 1 | 2 |\n";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--code-keyword");
});

/** The token span whose text is `keyword` — waits until it's actually highlighted (not the raw fallback). */
async function findHighlightedKeywordSpan(container: HTMLElement, keyword: string) {
  return waitFor(() => {
    const span = [...container.querySelectorAll("pre code span")].find(
      (el) => el.textContent === keyword,
    );
    const style = span?.getAttribute("style") ?? "";
    if (!/--sdm-c:\s*#/.test(style)) throw new Error("not yet highlighted");
    return span as HTMLElement;
  });
}

describe("Streamdown chrome microcopy (#310)", () => {
  it("MessageResponse resolves Streamdown's copy control through the locale seam", async () => {
    render(
      <LocaleProvider messages={{ "ai.streamdown.copyCode": "Kopieren" }}>
        <MessageResponse>{CODE_MARKDOWN}</MessageResponse>
      </LocaleProvider>,
    );

    expect(await screen.findByRole("button", { name: "Kopieren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Code" })).not.toBeInTheDocument();
  });

  it("MessageResponse keeps streamdown's English default when nothing is overridden", async () => {
    render(<MessageResponse>{CODE_MARKDOWN}</MessageResponse>);

    // Byte-identical to streamdown@2.5.0's `defaultTranslations` — wiring the
    // seam must be a no-op for consumers that override nothing (ADR 0017).
    expect(await screen.findByRole("button", { name: "Copy Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download file" })).toBeInTheDocument();
  });

  it("MarkdownView resolves the chrome through the locale seam", async () => {
    render(
      <LocaleProvider messages={{ "ai.streamdown.copyTable": "Tabelle kopieren" }}>
        <MarkdownView>{TABLE_MARKDOWN}</MarkdownView>
      </LocaleProvider>,
    );

    expect(await screen.findByRole("button", { name: "Tabelle kopieren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy table" })).not.toBeInTheDocument();
    // Un-overridden keys still fall through to streamdown's English default.
    expect(screen.getByRole("button", { name: "Download table" })).toBeInTheDocument();
  });

  it("ReasoningContent resolves the chrome through the locale seam", async () => {
    render(
      <LocaleProvider messages={{ "ai.streamdown.copyCode": "Kopieren" }}>
        <Reasoning open>
          <ReasoningContent>{CODE_MARKDOWN}</ReasoningContent>
        </Reasoning>
      </LocaleProvider>,
    );

    expect(await screen.findByRole("button", { name: "Kopieren" })).toBeInTheDocument();
  });

  it("lets an explicit `translations` prop win over the locale seam", async () => {
    render(
      <LocaleProvider messages={{ "ai.streamdown.copyCode": "Kopieren" }}>
        <MessageResponse translations={{ copyCode: "Copiar" }}>{CODE_MARKDOWN}</MessageResponse>
      </LocaleProvider>,
    );

    expect(await screen.findByRole("button", { name: "Copiar" })).toBeInTheDocument();
  });
});

/**
 * #315 follow-up — the "major" carve-out: only `<CodeBlock>` had been
 * de-GitHub-ed; every fenced code block rendered through `MessageResponse`/
 * `MarkdownView`/`ReasoningContent`'s shared Streamdown instance still went
 * through `@streamdown/code`'s pre-configured plugin, whose `getThemes()` is
 * frozen to `["github-light", "github-dark"]`. These assertions render the
 * REAL components (no mock) and read the resolved inline color custom
 * properties Streamdown's own code-block renderer emits per token
 * (`--sdm-c`/`--shiki-dark`, see `chunk-BO2N2NFS.js`'s `HighlightedCodeBlockBody`).
 */
describe("Streamdown code-block theme (#315 follow-up)", () => {
  it("MessageResponse derives fenced code-block colors from brand --code-* tokens, not a static github palette", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.38 0.16 264)");

    const { container } = render(<MessageResponse>{CODE_MARKDOWN}</MessageResponse>);

    const span = await findHighlightedKeywordSpan(container, "const");
    // oklch(0.38 0.16 264) → #133796 — never a github-light/dark literal
    // (github-light's keyword is #d73a49, github-dark's is #ff7b72).
    expect(span.getAttribute("style")).toContain("--sdm-c: #133796");
    // Both dual-theme slots are pinned to the SAME active-theme color (#315
    // follow-up design: brand-ui has three themes, not the two Shiki's
    // light/dark mechanism expects), so `.dark` never resolves a different palette.
    expect(span.getAttribute("style")).toContain("--shiki-dark: #133796");
  });

  it("re-derives MessageResponse's code colors when data-theme changes at runtime", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.38 0.16 264)");

    const { container } = render(
      <MessageResponse>{"```js\nconst streamdownThemeMarker = 1;\n```"}</MessageResponse>,
    );

    await findHighlightedKeywordSpan(container, "const");

    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.92 0.02 240)");

    await waitFor(() => {
      const span = [...container.querySelectorAll("pre code span")].find(
        (el) => el.textContent === "const",
      );
      const style = (span?.getAttribute("style") ?? "").toLowerCase();
      // Must differ from the light color above (case-insensitive — Shiki's
      // own re-serialization may differ in hex letter case from ours), proving
      // the plugin re-derived rather than staying frozen on whichever theme was
      // active at first mount.
      expect(style).not.toContain("--sdm-c: #133796");
      expect(style).toMatch(/--sdm-c: #[0-9a-f]{6}/);
    });
  });
});
