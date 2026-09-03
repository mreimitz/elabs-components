import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, waitFor, within } from "storybook/test";
import { useMemo, useState } from "react";
import * as monaco from "monaco-editor";
import { CodeEditor } from "./code-editor";
import { EditorToolbar } from "../editor-toolbar";
import { buildBrandThemeData } from "../lib/monaco-theme-bridge";

const meta = {
  title: "Editor/CodeEditor",
  component: CodeEditor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The real Monaco EDITING surface; a read-only highlighted block is `AI/CodeBlock` " +
          "and a tool-output viewer is `AI/Sandbox` — see " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). " +
          "A token-themed Monaco editor. The editing surface + widgets are Monaco; " +
          "brand-ui supplies the chrome (toolbar/Select/Button). Colors track the " +
          "active `data-theme` across every theme via the theming bridge.",
      },
    },
  },
} satisfies Meta<typeof CodeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

const TS_SAMPLE = `import { useState } from "react";

interface CounterProps {
  /** Starting value. */
  start?: number;
}

export function Counter({ start = 0 }: CounterProps) {
  const [count, setCount] = useState(start);
  // Increment on click.
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
`;

const JSON_SAMPLE = `{
  "name": "@elabs-ai/components-editor",
  "version": "0.1.0",
  "private": true,
  "keywords": ["monaco", "editor", "tokens"],
  "engines": { "node": ">=20" }
}
`;

export const Default: Story = {
  render: () => (
    <div className="h-[440px] w-full border-border [&]:border">
      <CodeEditor language="typescript" defaultValue={TS_SAMPLE} />
    </div>
  ),
};

export const WithToolbar: Story = {
  render: function WithToolbarStory() {
    const [language, setLanguage] = useState("typescript");
    const [value, setValue] = useState(TS_SAMPLE);
    return (
      <div className="flex h-[440px] w-full flex-col overflow-hidden rounded-lg border border-border">
        <EditorToolbar
          filename="counter.tsx"
          language={language}
          onLanguageChange={setLanguage}
          copyValue={value}
        />
        <div className="min-h-0 flex-1">
          <CodeEditor language={language} value={value} onChange={setValue} />
        </div>
      </div>
    );
  },
};

/**
 * Locks #90: Monaco's `vs`/`vs-dark` base themes ship LANGUAGE-SUFFIXED JSON
 * scopes (`string.key.json`, `string.value.json`, `keyword.json`) that beat the
 * bridge's shorter, unsuffixed rules in Monaco's token-theme trie (deepest scope
 * wins) — so JSON rendered in stock VS Code colors instead of brand colors. The
 * play function reads REAL computed colors off the rendered `.mtk*` token spans
 * and asserts none of them is a stock JSON color, in whichever theme this story
 * is rendered under (`globals=theme:light|dark`).
 */
export const JsonReadOnly: Story = {
  name: "JSON (read-only)",
  render: () => (
    <div className="h-[300px] w-full border border-border">
      <CodeEditor language="json" defaultValue={JSON_SAMPLE} readOnly />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Monaco mounts asynchronously, and syntax tokenization is a SEPARATE,
    // later pass: the editor first paints one un-highlighted `.mtk*` span per
    // line, then re-renders with per-scope spans once the JSON monarch
    // tokenizer finishes (observed to take ~1-3s in a headless test browser).
    // Waiting for "any `.mtk*` span" resolves on that FIRST, un-highlighted
    // paint — a false green that passes identically whether the fix is
    // present or not (#90 fix-round-1 finding). Wait for the actual `"name"`
    // key to have tokenized into its own span instead — that only exists once
    // real per-scope highlighting has landed.
    const surface = await within(canvasElement).findByTestId("code-editor", {}, { timeout: 10000 });
    let spans: HTMLSpanElement[] = [];
    await waitFor(
      () => {
        spans = Array.from(
          surface.querySelectorAll<HTMLSpanElement>('.view-line span[class*="mtk"]'),
        );
        const keySpan = spans.some((span) => span.textContent?.trim() === '"name"');
        if (!keySpan) {
          throw new Error(
            `Monaco has not tokenized the "name" key into its own span yet (spans=${spans.length})`,
          );
        }
      },
      { timeout: 20000, interval: 100 },
    );

    // Stock `vs`/`vs-dark` colors for string.key.json / string.value.json /
    // keyword.json (extracted straight from monaco-editor's own base themes —
    // see monaco-theme-bridge.test.ts's "Monaco real trie resolution" block for
    // the same values as raw hex). If the bridge's brand rules ever stop beating
    // the base theme's suffixed scopes, a token renders one of these again.
    const stockColors = new Set([
      "rgb(163, 21, 21)", // vs: string.key.json / string (maroon)
      "rgb(4, 81, 165)", // vs: string.value.json / keyword.json (navy)
      "rgb(156, 220, 254)", // vs-dark: string.key.json (cyan)
      "rgb(206, 145, 120)", // vs-dark: string.value.json / keyword.json / string (orange)
    ]);

    const offenders = spans
      .map((span) => getComputedStyle(span).color)
      .filter((color) => stockColors.has(color));
    await expect(offenders).toEqual([]);

    // Positive check, not just an absence check: the "name" key span must be
    // colored with the bridge's OWN live `string.key.json` brand ink (read
    // straight off the currently-applied CSS custom properties), not merely
    // "some color that isn't stock" — a fix that mapped the scope to the
    // wrong token would pass the negative check above but fail this one.
    const hexToRgb = (hex: string) => {
      const n = Number.parseInt(hex.replace("#", ""), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    const liveRules = buildBrandThemeData().rules ?? [];
    const expectedKeyForeground = liveRules.find(
      (rule) => rule.token === "string.key.json",
    )?.foreground;
    await expect(expectedKeyForeground).toBeDefined();
    const keySpan = spans.find((span) => span.textContent?.trim() === '"name"');
    await expect(keySpan).toBeDefined();
    await expect(getComputedStyle(keySpan!).color).toEqual(hexToRgb(expectedKeyForeground!));
  },
};

/**
 * The minimap (right-edge "mini navigation view") enabled + themed, and the
 * brand-ui context menu (right-click) that replaces Monaco's built-in one. The
 * play test right-clicks the editor and asserts the brand menu items render.
 */
export const ContextMenuAndMinimap: Story = {
  name: "Context menu + minimap",
  parameters: {
    docs: {
      description: {
        story:
          "Right-click the editor: the menu is brand-ui's `ContextMenu` (not Monaco's), " +
          "wired to the editor's actions. The minimap on the right edge is enabled via " +
          "`options` and themed from tokens.",
      },
    },
  },
  render: () => (
    <div className="h-[440px] w-full border border-border">
      <CodeEditor
        language="typescript"
        defaultValue={TS_SAMPLE}
        contextMenu="brand"
        options={{ minimap: { enabled: true } }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Monaco mounts asynchronously — wait for the editor surface, then right-click.
    const surface = await within(canvasElement).findByTestId("code-editor", {}, { timeout: 10000 });
    fireEvent.contextMenu(surface);
    const menu = within(document.body);
    // `findBy*` retries only until the node EXISTS — but ContextMenuContent carries
    // `data-[state=open]:fade-in-0`, so it starts at opacity 0 and a one-shot
    // `toBeVisible()` races the entrance animation (#51, #278 pattern D). waitFor
    // rides it out — the dropdown-menu.stories.tsx precedent.
    const copy = await menu.findByRole("menuitem", { name: /copy/i });
    await waitFor(() => expect(copy).toBeVisible());
    const palette = await menu.findByRole("menuitem", { name: /command palette/i });
    await waitFor(() => expect(palette).toBeVisible());
  },
};

/**
 * Accessibility: the editor forwards `ariaLabel` / `ariaInvalid` / `ariaDescribedBy`
 * onto Monaco's inner screen-reader `<textarea>` (its real focusable surface) — NOT
 * the wrapper div. This is the locking test for #34, asserted against REAL Monaco in
 * a browser (a jsdom mock that swaps in a `<textarea>` cannot prove the real surface).
 */
export const Accessibility: Story = {
  name: "Accessibility (aria forwarding)",
  render: () => (
    <div className="h-[300px] w-full border border-border">
      <CodeEditor
        language="typescript"
        defaultValue={TS_SAMPLE}
        ariaLabel="Source code editor"
        ariaInvalid
        ariaDescribedBy="editor-help"
      />
      <span id="editor-help" className="sr-only">
        Edit the source code.
      </span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Wait for Monaco to mount, then assert its inner screen-reader <textarea> (the
    // real focusable surface) carries the aria-* — proving they reached Monaco, not
    // just the wrapper div. We query the element directly (Monaco also stamps
    // role="textbox" on a wrapper div, so a role query is ambiguous).
    const surface = await within(canvasElement).findByTestId("code-editor", {}, { timeout: 10000 });
    let textarea: HTMLTextAreaElement | null = null;
    await waitFor(
      () => {
        textarea = surface.querySelector("textarea");
        if (!textarea) throw new Error("Monaco textarea not mounted yet");
      },
      { timeout: 10000 },
    );
    await expect(textarea!).toHaveAttribute("aria-label", "Source code editor");
    await expect(textarea!).toHaveAttribute("aria-invalid", "true");
    await expect(textarea!).toHaveAttribute("aria-describedby", "editor-help");
  },
};

/**
 * Demonstrates the `actions` prop: a declarative array of Monaco editor actions
 * that register commands in the keybinding system and the command palette. Press
 * `Ctrl+K` / `Cmd+K` (or open the command palette and search "Say Hi") to
 * trigger the action. The action is memoized to avoid re-registering on every
 * render.
 */
export const WithActions: Story = {
  name: "Declarative actions",
  tags: ["autodocs"],
  render: function WithActionsStory() {
    const [feedback, setFeedback] = useState<string | null>(null);
    const actions = useMemo(
      () => [
        {
          id: "demo.sayHi",
          label: "Say Hi",
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
          contextMenuGroupId: "navigation",
          contextMenuOrder: 1,
          run: () => {
            setFeedback("Action fired! (Ctrl+K / Cmd+K)");
            setTimeout(() => setFeedback(null), 2500);
          },
        },
      ],
      [],
    );
    return (
      <div className="flex h-[380px] w-full flex-col gap-2">
        <div className="flex-1 rounded-md border border-border overflow-hidden">
          <CodeEditor
            language="typescript"
            defaultValue={TS_SAMPLE}
            actions={actions}
            contextMenu="monaco"
            ariaLabel="Actions demo editor"
          />
        </div>
        <p className="text-caption text-muted-foreground">
          {feedback ?? "Press Ctrl+K / Cmd+K — or open the command palette and search “Say Hi”."}
        </p>
      </div>
    );
  },
};
