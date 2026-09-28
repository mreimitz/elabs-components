/** Real Monaco completion for the authored visual layer. */
import assert from "node:assert/strict";
export async function checkVisualAuthoring({ page, prepare, accept, state }) {
  const base =
    'diagram: "1"\nnodes: [{id: source}, {id: target}]\nvisual:\n  lanes: [{id: cloud, role: vendor-cloud, title: Cloud}]\n';
  await prepare(`${base}  boxes:\n    - id: app\n      lane: cl`);
  await page.keyboard.press("Control+Space");
  await accept("cloud", `${base}  boxes:\n    - id: app\n      lane: cloud`);
  const boxes = `${base}  boxes: [{id: app, lane: cloud, title: App, members: [source]}]\n`;
  await prepare(`${boxes}  flows:\n    - from: ap`);
  await page.keyboard.press("Control+Space");
  await accept("app", `${boxes}  flows:\n    - from: app`);
  for (const prefix of [
    `${base}  hide: [`,
    `${base}  controlPlane:\n    - `,
    `${base}  boxes:\n    - id: app\n      members: [`,
  ]) {
    await prepare(`${prefix}'sou`);
    await page.keyboard.press("Control+Space");
    await accept("source", `${prefix}'source'`);
    assert((await state()).text.endsWith("'source'"));
  }
  return ["visual lane and box identifiers", "visual inline and block member identifiers"];
}
