/** Real Monaco lifecycle: rapid diff teardown and surviving editor suggestion/hover. */
/* global process, console, window, document, localStorage, performance, URL, setTimeout */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const base = process.env.DIAGRAM_URL ?? "http://127.0.0.1:5441";
const project =
  process.env.DIFF_PROJECT ??
  fileURLToPath(new URL("../../../", import.meta.url)).replace(/\/$/, "");
const evidence = process.env.DIFF_EVIDENCE;
const browser = await chromium.launch();
const results = [];
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack ?? String(error)));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.addInitScript((theme) => {
      localStorage.setItem("brand-ui-theme", theme);
      performance.setResourceTimingBufferSize(20000);
    }, theme);
    await page.goto(base + "/#home");
    await page.locator("body").waitFor();
    const state = await page.evaluate(
      async ({ project }) => {
        const loaded = (suffix) =>
          performance
            .getEntriesByType("resource")
            .findLast((entry) => new URL(entry.name).pathname.endsWith(suffix))?.name;
        const reactModule = await import(loaded("/react.js"));
        const React = reactModule.default ?? reactModule;
        const domModule = await import(loaded("/react-dom_client.js"));
        const { createRoot } = domModule.default ?? domModule;
        const coreDom = await import(loaded("/react-dom.js"));
        const { flushSync } = coreDom.default ?? coreDom;
        const { DiffEditor } = await import(
          "/@fs/" + project + "/packages/editor/src/diff-editor/diff-editor.tsx"
        );
        const original = Array.from({ length: 800 }, (_, i) => `item_${i}: original ${i}`).join(
          "\n",
        );
        const modified = original.replaceAll("original", "changed");
        let monaco;
        let mountCount = 0;
        for (let iteration = 0; iteration < 30; iteration++) {
          const host = document.createElement("div");
          host.style.cssText = "position:fixed;inset:20px;width:900px;height:600px;z-index:10000";
          document.body.append(host);
          const root = createRoot(host);
          let mounted;
          const promise = new Promise((resolve) => (mounted = resolve));
          flushSync(() =>
            root.render(
              React.createElement(
                React.StrictMode,
                null,
                React.createElement(DiffEditor, {
                  original,
                  modified: modified + iteration,
                  language: "yaml",
                  ariaLabel: "Rapid comparison",
                  renderSideBySide: iteration % 2 === 0,
                  onMount: (_editor, api) => {
                    monaco = api;
                    mountCount++;
                    mounted();
                  },
                }),
              ),
            ),
          );
          await promise;
          flushSync(() => root.unmount());
          host.remove();
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        const remaining = monaco.editor.getModels().length;
        const mainHost = document.createElement("div");
        mainHost.style.cssText = "position:fixed;inset:20px;width:900px;height:600px;z-index:9999";
        document.body.append(mainHost);
        const main = monaco.editor.create(mainHost, {
          value: "hello",
          language: "plaintext",
          suggest: { showStatusBar: true },
          automaticLayout: true,
          occurrencesHighlight: "off",
        });
        const completion = monaco.languages.registerCompletionItemProvider("plaintext", {
          provideCompletionItems: () => ({
            suggestions: [
              {
                label: "hello world",
                kind: monaco.languages.CompletionItemKind.Text,
                insertText: "hello world",
                range: new monaco.Range(1, 1, 1, 6),
              },
            ],
          }),
        });
        const hover = monaco.languages.registerHoverProvider("plaintext", {
          provideHover: () => ({
            range: new monaco.Range(1, 1, 1, 6),
            contents: [{ value: "Shared hover after diff closes.\n\n```text\nhello\n```" }],
          }),
        });
        const host = document.createElement("div");
        host.style.cssText = "position:fixed;inset:20px;width:900px;height:600px;z-index:10000";
        document.body.append(host);
        const root = createRoot(host);
        let ready;
        const done = new Promise((resolve) => (ready = resolve));
        let editor;
        flushSync(() =>
          root.render(
            React.createElement(DiffEditor, {
              original,
              modified,
              language: "yaml",
              ariaLabel: "Stable comparison",
              onMount: (instance) => {
                editor = instance;
                const listener = instance.onDidUpdateDiff(() => {
                  if (instance.getLineChanges()) {
                    listener.dispose();
                    ready();
                  }
                });
              },
            }),
          ),
        );
        await done;
        const changes = editor.getLineChanges().length;
        window.finishDiff = () => {
          flushSync(() => root.unmount());
          host.remove();
          main.focus();
          main.setPosition({ lineNumber: 1, column: 6 });
          main.trigger("lifecycle-test", "editor.action.triggerSuggest", {});
          return monaco.editor.getModels().length;
        };
        window.hoverMain = () => main.getAction("editor.action.showHover").run();
        window.finishMain = () => {
          completion.dispose();
          hover.dispose();
          const model = main.getModel();
          main.dispose();
          model.dispose();
          mainHost.remove();
          return monaco.editor.getModels().length;
        };
        return { mountCount, remaining, changes };
      },
      { project },
    );
    assert.equal(state.mountCount, 30);
    assert.equal(state.remaining, 0);
    assert.ok(state.changes > 0);
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/diff-${theme}.png` });
    }
    assert.equal(await page.evaluate(() => window.finishDiff()), 1);
    await page.locator(".suggest-widget.visible").waitFor();
    assert.ok(await page.locator(".suggest-widget.visible").innerText());
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.hoverMain());
    await page.getByText("Shared hover after diff closes.").waitFor();
    if (evidence) await page.screenshot({ path: `${evidence}/surviving-editor-${theme}.png` });
    assert.equal(await page.evaluate(() => window.finishMain()), 0);
    await page.waitForTimeout(300);
    assert.deepEqual(errors, []);
    results.push({ theme, ...state, survivingSuggestionAndMarkdownHover: true, errors });
    await context.close();
  }
  if (evidence)
    await writeFile(`${evidence}/diff-lifecycle.json`, JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ results }, null, 2));
} finally {
  await browser.close();
}
