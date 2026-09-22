import assert from "node:assert/strict";
import { test } from "node:test";

import { hasMaintainerMarker, visitorCopy, visitorLead } from "./visitor-copy.mjs";

test("drops a breadcrumb first sentence and maintainer sentences, keeps the rest", () => {
  const text =
    "Charts / Recipes / River (RM-126). Four chart deep-dives, rebuilt from merged props. " +
    "Every fixture is seeded (`seededRnd`). The fifth recipe lives in `apps/docs/stories/x.stories.tsx`.";
  assert.equal(visitorCopy(text), "Four chart deep-dives, rebuilt from merged props.");
});

test("strips an inline reference without losing the sentence", () => {
  assert.equal(
    visitorCopy(
      "The in-chat agent workspace graph surface (ADR 0018). Renders inside a conversation (D2).",
    ),
    "The in-chat agent workspace graph surface. Renders inside a conversation.",
  );
});

test("prose with slashes is not a breadcrumb; e.g. does not split a sentence", () => {
  assert.equal(
    visitorCopy("Opt-in chart wrapper adding expand / flip-to-table / download-CSV to any child."),
    "Opt-in chart wrapper adding expand / flip-to-table / download-CSV to any child.",
  );
  assert.equal(
    visitorLead("Keyboard key hint, e.g. <Kbd>⌘K</Kbd>. More."),
    "Keyboard key hint, e.g. <Kbd>⌘K</Kbd>.",
  );
});

test("a chart story is prose; a story file is not", () => {
  assert.equal(
    visitorCopy("The rows the story is about are stacked."),
    "The rows the story is about are stacked.",
  );
  assert.equal(visitorCopy("These stories exercise the reveal primitive."), "");
});

test("hasMaintainerMarker names the offending token", () => {
  assert.equal(hasMaintainerMarker("Illustrates usage (RM-041)."), "RM-041");
  assert.equal(hasMaintainerMarker("A plain sentence."), null);
});
