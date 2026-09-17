import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collectStoryIds, docsIdFromTitle, indexStoryDocsPages } from "../lib/story-ids.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("docsIdFromTitle matches the ids Storybook actually serves", () => {
  // Pinned against the live index of this repo's Storybook — the slugifier is a
  // copy of `storybook/internal/csf`'s `sanitize`, so it has to be pinned.
  assert.equal(docsIdFromTitle("Core/Button"), "core-button--docs");
  assert.equal(docsIdFromTitle("Charts/BarChart"), "charts-barchart--docs");
  assert.equal(
    docsIdFromTitle("Patterns/Templates/AI Assistant"),
    "patterns-templates-ai-assistant--docs",
  );
  assert.equal(
    docsIdFromTitle("Patterns/Blocks/KPI Cards/What's the headline? Hero + satellites"),
    "patterns-blocks-kpi-cards-what-s-the-headline-hero-satellites--docs",
  );
  assert.equal(docsIdFromTitle(""), "", "no title → no id, never a bare '--docs'");
});

test("indexStoryDocsPages finds this repo's autodocs pages and is deterministic", () => {
  const first = indexStoryDocsPages(REPO_ROOT);
  assert.ok(first.pages.length > 300, `expected 300+ docs pages, got ${first.pages.length}`);
  assert.equal(first.byComponent.Button, "core-button--docs");
  assert.equal(first.byComponent.DataTable, "data-datatable--docs");
  // A meta declared under another name (`decisionMeta`) is still the default
  // export, so its page must be indexed.
  assert.equal(first.byComponent.DecisionCard, "editor-aiobjects-decisioncard--docs");
  const ids = first.pages.map((p) => p.storyId);
  assert.deepEqual([...ids].sort(), ids, "pages come back in a stable, sorted order");
  assert.equal(new Set(ids).size, ids.length, "no duplicate docs ids");
});

test("collectStoryIds returns only the components a package exports", () => {
  const got = collectStoryIds(REPO_ROOT, [{ name: "Button" }, { name: "NotAComponentThatExists" }]);
  assert.deepEqual(got, { Button: "core-button--docs" });
});
