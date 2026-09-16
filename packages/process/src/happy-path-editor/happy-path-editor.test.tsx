import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liftHappyPath, type HappyPath } from "../core/reference-model";
import { replayActivities } from "../core/token-replay";
import {
  HappyPathEditor,
  insertHappyPathStep,
  nextHappyPathActivity,
  removeHappyPathStep,
  updateHappyPathStep,
} from "./happy-path-editor";

// React Flow needs `DOMMatrixReadOnly` to mount; jsdom lacks it (see process-map.test.tsx).
if (typeof globalThis.DOMMatrixReadOnly === "undefined") {
  class DOMMatrixReadOnlyPolyfill {
    m22 = 1;
    constructor(_init?: unknown) {}
  }
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyPolyfill as unknown as typeof DOMMatrixReadOnly;
}

afterEach(cleanup);

/**
 * Find a control by its `aria-label`. React Flow keeps nodes `visibility: hidden` until
 * measured — which never happens under jsdom — so role and accessible-name queries see
 * nothing inside the canvas here. The computed names are asserted in the browser, by the
 * story's play function.
 */
async function byLabel(name: string): Promise<HTMLElement> {
  return waitFor(() => {
    const found = document.querySelector<HTMLElement>(`[aria-label="${name}"]`);
    if (!found) throw new Error(`no element labelled "${name}"`);
    return found;
  });
}

const path: HappyPath = {
  id: "p",
  label: "Order",
  steps: [{ activity: "Register" }, { activity: "Approve" }],
};
const available = ["Register", "Check credit", "Approve", "Pay"];

describe("happy-path edits", () => {
  it("inserting via an edge point then toggling repeatable replays a repeat without deviation", () => {
    // What the FlowButtonEdge between Register and Approve does (index 1).
    const inserted = insertHappyPathStep(path, 1, {
      activity: nextHappyPathActivity(path, available),
    });
    expect(inserted.steps.map((s) => s.activity)).toEqual(["Register", "Check credit", "Approve"]);

    const repeatable = updateHappyPathStep(inserted, 1, { repeatable: true });
    const model = liftHappyPath(repeatable);
    const result = replayActivities(
      "c",
      ["Register", "Check credit", "Check credit", "Check credit", "Approve"],
      model,
    );
    expect(result.deviations).toEqual([]);
    expect(result.fitness).toBe(1);

    // Without the flag the same trace deviates — the toggle is what the model reads.
    const strict = replayActivities(
      "c",
      ["Register", "Check credit", "Check credit", "Approve"],
      liftHappyPath(inserted),
    );
    expect(strict.deviations.length).toBeGreaterThan(0);
  });

  it("removing a step reconnects its neighbours and clearing a flag drops it", () => {
    const three = insertHappyPathStep(path, 1, { activity: "Check credit", optional: true });
    expect(removeHappyPathStep(three, 1)).toEqual(path);
    expect(updateHappyPathStep(three, 1, { optional: false }).steps[1]).toEqual({
      activity: "Check credit",
    });
  });

  it("picks the first unused available activity for a new step", () => {
    expect(nextHappyPathActivity(path, available)).toBe("Check credit");
    expect(nextHappyPathActivity(path, undefined)).toBe("");
  });
});

function Controlled({ onChange }: { onChange: (path: HappyPath) => void }) {
  const [value, setValue] = useState(path);
  return (
    <div style={{ width: 600, height: 800 }}>
      <HappyPathEditor
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    </div>
  );
}

describe("HappyPathEditor", () => {
  it("fires a complete HappyPath on toggle, rename and remove", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);

    const repeatable = await byLabel("Repeatable — Approve");
    await user.click(repeatable);
    expect(onChange).toHaveBeenLastCalledWith({
      ...path,
      steps: [{ activity: "Register" }, { activity: "Approve", repeatable: true }],
    });

    const field = await byLabel("Activity for step 1");
    await user.type(field, "!");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        steps: [{ activity: "Register!" }, { activity: "Approve", repeatable: true }],
      }),
    );

    fireEvent.click(await byLabel("Remove Register!"));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith({
        ...path,
        steps: [{ activity: "Approve", repeatable: true }],
      }),
    );
  });

  it("appends a step from the tail placeholder", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(await byLabel("Add step"));
    expect(onChange).toHaveBeenLastCalledWith({
      ...path,
      steps: [...path.steps, { activity: "" }],
    });
  });
});
