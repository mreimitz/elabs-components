import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroupedParts } from "./grouped-parts";
import {
  buildPartGroups,
  groupPartByType,
  isGroupNode,
  partsFingerprint,
  type GroupablePart,
  type GroupBy,
} from "./part-groups";

interface P extends GroupablePart {
  type: string;
  state?: string;
  text?: string;
  id?: string;
}

describe("part-groups — coalescing", () => {
  it("coalesces an adjacent reasoning+tool run into one group, leaves text alone", () => {
    const parts: P[] = [
      { type: "text", text: "Hi" },
      { type: "reasoning", state: "done" },
      { type: "tool-search", state: "output-available" },
      { type: "text", text: "Done" },
    ];
    const tree = buildPartGroups(parts, groupPartByType<P>());
    expect(tree).toHaveLength(3);
    expect(tree[0]).toMatchObject({ kind: "leaf", part: { type: "text" } });
    const group = tree[1];
    expect(group).toMatchObject({ kind: "group" });
    if (group?.kind === "group") {
      expect(group.group.type).toBe("group-work");
      expect(group.group.indices).toEqual([1, 2]);
      expect(group.children).toHaveLength(2);
    }
    expect(tree[2]).toMatchObject({ kind: "leaf", part: { type: "text" } });
  });

  it("does NOT merge two groups separated by a standalone part", () => {
    const parts: P[] = [
      { type: "reasoning", state: "done" },
      { type: "approval-request" },
      { type: "reasoning", state: "done" },
    ];
    const tree = buildPartGroups(parts, groupPartByType<P>());
    expect(tree).toHaveLength(3);
    expect(tree[1]).toMatchObject({ kind: "leaf", part: { type: "approval-request" } });
  });

  it("nests multi-element paths", () => {
    const groupBy: GroupBy<P> = (p) =>
      p.type === "a" ? ["group-outer", "group-inner"] : p.type === "b" ? ["group-outer"] : [];
    const parts: P[] = [{ type: "a" }, { type: "a" }, { type: "b" }];
    const tree = buildPartGroups(parts, groupBy);
    expect(tree).toHaveLength(1);
    const outer = tree[0];
    expect(outer).toMatchObject({ kind: "group", group: { type: "group-outer" } });
    if (outer?.kind === "group") {
      expect(outer.children).toHaveLength(2);
      expect(outer.children[0]).toMatchObject({ kind: "group", group: { type: "group-inner" } });
      expect(outer.children[1]).toMatchObject({ kind: "leaf", part: { type: "b" } });
    }
  });
});

describe("part-groups — status rollup + identity", () => {
  it("rolls up to running when any member is running", () => {
    const parts: P[] = [
      { type: "reasoning", state: "streaming" },
      { type: "tool-x", state: "output-available" },
    ];
    const tree = buildPartGroups(parts, groupPartByType<P>());
    expect(tree[0]).toMatchObject({ kind: "group", group: { status: "running" } });
  });

  it("uses a part id for a stable leaf key across re-renders", () => {
    const before = buildPartGroups([{ type: "text", id: "abc" }] as P[], groupPartByType<P>());
    const after = buildPartGroups(
      [{ type: "text", id: "abc", text: "grown" }] as P[],
      groupPartByType<P>(),
    );
    expect(before[0]!.key).toBe(after[0]!.key);
  });

  it("fingerprint changes on status change but not on unrelated identity churn", () => {
    const a = partsFingerprint([{ type: "tool-x", state: "input-available", id: "1" }] as P[]);
    const b = partsFingerprint([{ type: "tool-x", state: "output-available", id: "1" }] as P[]);
    expect(a).not.toBe(b);
  });
});

describe("groupPartByType — classification", () => {
  it("honors an explicit inline classifier", () => {
    const gb = groupPartByType<P>({ classify: (p) => (p.type === "text" ? "inline" : undefined) });
    const tree = buildPartGroups([{ type: "text" }, { type: "text" }] as P[], gb);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ kind: "group" });
  });

  it("forces standalone parts out of a group even when classified inline elsewhere", () => {
    const gb = groupPartByType<P>();
    expect(gb({ type: "human-input" } as P, { index: 0, parts: [] })).toEqual([]);
  });

  it("isGroupNode narrows synthetic nodes", () => {
    expect(isGroupNode({ type: "group-work" })).toBe(true);
    expect(isGroupNode({ type: "reasoning" })).toBe(false);
  });
});

describe("GroupedParts — component", () => {
  it("renders a default open trace for a running group", () => {
    render(
      <GroupedParts
        parts={[
          { type: "reasoning", state: "streaming", text: "thinking" },
          { type: "tool-search", state: "input-available", input: {} },
        ]}
      />,
    );
    // Running → the trace label + the tool header inside are visible.
    expect(screen.getByText("Working…")).toBeInTheDocument();
    expect(screen.getByText("search")).toBeInTheDocument();
  });

  it("renders the ToolOutput skeleton for an in-flight tool part (#269/#8 — no output area gap)", async () => {
    const user = userEvent.setup();
    render(
      <GroupedParts
        parts={[{ type: "tool-search", state: "input-streaming", input: {}, id: "call-1" }]}
      />,
    );
    // The outer trace opens by default (running), but the individual Tool's
    // own disclosure still defaults closed — expand it to reach ToolContent.
    await user.click(screen.getByText("search"));
    // Previously the output area was gated behind `output !== undefined ||
    // errorText`, so an `input-streaming` tool rendered NOTHING here. Now it
    // shows the settled "Result" heading + a loading live region instead of a
    // gap.
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("passes group nodes (with children) and leaves to the render-prop", () => {
    render(
      <GroupedParts parts={[{ type: "reasoning", state: "done" }, { type: "approval-request" }]}>
        {({ part, isGroup, children }) =>
          isGroup ? (
            <div data-testid="group">
              group:{part.type}
              {children}
            </div>
          ) : (
            <div data-testid={`leaf-${part.type}`}>leaf:{part.type}</div>
          )
        }
      </GroupedParts>,
    );
    expect(screen.getByTestId("group")).toHaveTextContent("group:group-work");
    // The reasoning leaf renders INSIDE the group; the approval is a standalone leaf.
    expect(screen.getByTestId("group")).toContainElement(screen.getByTestId("leaf-reasoning"));
    expect(screen.getByTestId("leaf-approval-request")).toHaveTextContent("leaf:approval-request");
  });
});
