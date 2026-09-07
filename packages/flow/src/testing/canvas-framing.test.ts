/**
 * The one property of {@link waitForSettledCanvas} that is testable outside a browser:
 * a canvas that is still MOVING is not settled, even when it measures as still.
 *
 * jsdom reports every box as 0×0, so the rect half of `canvasSignature` is constant here
 * by construction — which is precisely the shape of the CI failure this locks. Two polls
 * taken close enough together read the identical signature while the node-position
 * transition is mid-flight (on a loaded runner, "close enough together" means inside one
 * rendered frame), and the framing assertions then measure a picture in which React Flow
 * has already drawn every edge at its final coordinate while the node elements, and with
 * them the handle dots, are still sliding towards it — nine edges reported hanging up to
 * 142 px off their dots on a canvas that is correct a fifth of a second later.
 */
import { afterEach, describe, expect, it } from "vitest";
import { waitForSettledCanvas } from "./canvas-framing";

type AnimationCapableElement = { getAnimations: () => Animation[] };

/** A canvas whose nodes already hold distinct laid-out positions. */
function canvasWithLaidOutNodes(): HTMLElement {
  const canvas = document.createElement("div");
  for (const [id, x] of [
    ["a", 0],
    ["b", 240],
  ] as const) {
    const node = document.createElement("div");
    node.className = "react-flow__node";
    node.setAttribute("data-id", id);
    node.style.transform = `translate(${x}px, 0px)`;
    canvas.append(node);
  }
  document.body.append(canvas);
  return canvas;
}

/** A finite, still-running animation whose end this test controls. */
function pendingAnimation(): { animation: Animation; finish: () => void } {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = () => resolve();
  });
  return {
    animation: {
      playState: "running",
      effect: { getTiming: () => ({ iterations: 1 }) },
      finished,
    } as unknown as Animation,
    finish,
  };
}

function stubAnimations(read: () => Animation[]) {
  (Element.prototype as unknown as AnimationCapableElement).getAnimations = read;
}

afterEach(() => {
  delete (Element.prototype as unknown as Partial<AnimationCapableElement>).getAnimations;
  document.body.innerHTML = "";
});

describe("waitForSettledCanvas", () => {
  it("does not settle while a finite animation is still running", async () => {
    const canvas = canvasWithLaidOutNodes();
    const { animation, finish } = pendingAnimation();
    let running: Animation[] = [animation];
    stubAnimations(() => running);

    let settled = false;
    const wait = waitForSettledCanvas(canvas, { timeout: 4_000, interval: 10 }).then(() => {
      settled = true;
    });

    // Long enough for many polls: under the old two-identical-polls rule this canvas —
    // whose signature never changes in jsdom — settled on the second one.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(settled).toBe(false);

    running = [];
    finish();
    await wait;
    expect(settled).toBe(true);
  });

  it("settles once nothing is animating", async () => {
    const canvas = canvasWithLaidOutNodes();
    stubAnimations(() => []);
    await expect(
      waitForSettledCanvas(canvas, { timeout: 4_000, interval: 10 }),
    ).resolves.toBeUndefined();
  });

  it("throws, naming the reason, when the nodes never take distinct positions", async () => {
    const canvas = document.createElement("div");
    for (const id of ["a", "b"]) {
      const node = document.createElement("div");
      node.className = "react-flow__node";
      node.setAttribute("data-id", id);
      node.style.transform = "translate(0px, 0px)";
      canvas.append(node);
    }
    document.body.append(canvas);
    stubAnimations(() => []);
    await expect(waitForSettledCanvas(canvas, { timeout: 120, interval: 10 })).rejects.toThrow(
      /layout has not run/,
    );
  });
});
