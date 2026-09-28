/** Exercises actual Monaco suggestions and snippet tab stops in the existing isolated editor suite. */
import assert from "node:assert/strict";
export async function checkStoryAuthoring({ page, prepare, accept, state, selectedText }) {
  const base =
    'diagram: "1"\nnodes: [{id: source}, {id: target}]\nflows:\n  - source -> target: Data\n';
  await prepare(`${base}sto`);
  await page.keyboard.press("Control+Space");
  await accept(
    "story step",
    `${base}story:\n  steps:\n    - title: Step title\n      targets: [node]\n      text: Explain this step.\n      duration: 8`,
  );
  assert.equal(await selectedText(), "Step title");
  await page.keyboard.type("Customer journey");
  await page.keyboard.press("Tab");
  assert.equal(await selectedText(), "node");
  await page.keyboard.type("source");
  await page.keyboard.press("Tab");
  assert.equal(await selectedText(), "Explain this step.");
  await page.keyboard.press("Escape");

  await prepare(`${base}story:\n  ste`);
  await page.keyboard.press("Control+Space");
  await accept("steps", `${base}story:\n  steps: `);
  await prepare(`${base}story:\n  steps:\n    - ti`);
  await page.keyboard.press("Control+Space");
  await accept("title", `${base}story:\n  steps:\n    - title: `);

  const targetBase = `${base}story:\n  steps:\n    - title: A\n      targets: [`;
  await prepare(`${targetBase}sou`);
  await page.keyboard.press("Control+Space");
  await accept("source", `${targetBase}source`);
  await prepare(`${targetBase}"source -> tar`);
  await page.keyboard.press("Control+Space");
  await accept("source -> target", `${targetBase}"source -> target"`);
  const block = `${base}story:\n  steps:\n    - title: A\n      targets:\n        - `;
  await prepare(`${block}'source -> tar`);
  await page.keyboard.press("Control+Space");
  await accept("source -> target", `${block}'source -> target'`);
  assert((await state()).text.endsWith("'source -> target'"));
  return [
    "story root snippet and tab stops",
    "story/step schema keys",
    "node target completion",
    "quoted flow target completion",
    "block target completion",
  ];
}
