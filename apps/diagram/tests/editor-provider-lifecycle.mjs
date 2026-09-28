/** Exercise the real providers against real Monaco models, holding catalog readiness so
 * cancellation/model replacement cannot pass merely because a request finished first. */
/* global window, performance, URL, document */
export async function checkProviderLifecycle(page) {
  return page.evaluate(async () => {
    const monacoURL = performance
      .getEntriesByType("resource")
      .findLast((entry) => new URL(entry.name).pathname.endsWith("/monaco-editor.js"))?.name;
    const monaco = await import(monacoURL);
    const { registerDiagramLanguage } = await window.__completionModule(
      "/src/editor/language-service.ts",
    );
    const { catalogService } = await window.__completionModule("/src/catalog/catalog-service.ts");
    await catalogService.ready();
    const originalReady = catalogService.ready;
    const results = [];
    for (const mutation of [
      "cancel",
      "edit",
      "readOnly",
      "replaceModel",
      "disposeModel",
      "disposeEditor",
    ]) {
      const host = document.createElement("div");
      host.style.display = "none";
      document.body.append(host);
      const model = monaco.editor.createModel(
        'diagram: "1"\nnodes:\n  - id: db\n    ref: catalog/aws/rds',
        "yaml",
      );
      // These disposable editors exercise provider lifetime only. Monaco's unrelated word
      // highlighter leaves a rejected Delayer promise when destroyed in the same task.
      const editor = monaco.editor.create(host, { model, occurrencesHighlight: "off" });
      let completion,
        hover,
        released = 0,
        replacement;
      const release = registerDiagramLanguage(editor, {
        ...monaco,
        languages: {
          ...monaco.languages,
          registerCompletionItemProvider(_language, provider) {
            completion = provider;
            return {
              dispose() {
                released++;
              },
            };
          },
          registerHoverProvider(_language, provider) {
            hover = provider;
            return {
              dispose() {
                released++;
              },
            };
          },
        },
      });
      const position = model.getPositionAt(model.getValueLength());
      const token = new monaco.CancellationTokenSource();
      // A successful control proves this registration/model actually produces suggestions.
      const positive = await completion.provideCompletionItems(model, position, {}, token.token);
      if (!positive.suggestions.some((item) => item.label === "catalog/aws/rds"))
        throw new Error("Provider positive control failed");
      let unblock;
      catalogService.ready = () =>
        new Promise((resolve) => {
          unblock = resolve;
        });
      let finishCompletion, finishHover;
      // Keep independent gates: both providers must cross their own asynchronous boundary.
      const pendingCompletion = completion.provideCompletionItems(model, position, {}, token.token);
      finishCompletion = unblock;
      const pendingHover = hover.provideHover(model, position, token.token);
      finishHover = unblock;
      try {
        if (mutation === "cancel") token.cancel();
        if (mutation === "edit") model.setValue('diagram: "1"\ntitle: New buffer');
        if (mutation === "readOnly") editor.updateOptions({ readOnly: true });
        if (mutation === "replaceModel") {
          replacement = monaco.editor.createModel('diagram: "1"', "yaml");
          editor.setModel(replacement);
        }
        if (mutation === "disposeModel") model.dispose();
        if (mutation === "disposeEditor") editor.dispose();
        finishCompletion();
        finishHover();
        const suggestions = await pendingCompletion;
        const hoverResult = await pendingHover;
        if (suggestions.suggestions.length) throw new Error(`Stale completion after ${mutation}`);
        // Read-only permits useful hover information but never edit suggestions.
        if (mutation !== "readOnly" && hoverResult !== null)
          throw new Error(`Stale hover after ${mutation}`);
        if (mutation === "readOnly" && !hoverResult) throw new Error("Read-only hover disappeared");
        if ((mutation === "disposeModel" || mutation === "disposeEditor") && released !== 2)
          throw new Error("Editor/model disposal did not release the providers");
        release();
        release();
        if (released !== 2) throw new Error(`Provider disposal count ${released}`);
        results.push({
          mutation,
          suggestions: 0,
          hover: hoverResult ? "available" : "discarded",
          disposed: released,
        });
      } finally {
        catalogService.ready = originalReady;
        finishCompletion?.();
        finishHover?.();
        release();
        token.dispose();
        editor.dispose();
        if (!model.isDisposed()) model.dispose();
        replacement?.dispose();
        host.remove();
      }
    }
    return results;
  });
}
