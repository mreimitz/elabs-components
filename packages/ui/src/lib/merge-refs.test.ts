import { createRef, type ForwardedRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { mergeRefs } from "./merge-refs";

describe("mergeRefs", () => {
  it("writes the node to object refs and calls callback refs", () => {
    const objectRef = createRef<HTMLDivElement>();
    const callbackRef = vi.fn();
    const node = document.createElement("div");

    mergeRefs<HTMLDivElement>(objectRef, callbackRef)(node);

    expect(objectRef.current).toBe(node);
    expect(callbackRef).toHaveBeenCalledWith(node);
  });

  it("propagates unmount (null) to every ref", () => {
    const objectRef = createRef<HTMLDivElement>();
    const callbackRef = vi.fn();
    const merged = mergeRefs<HTMLDivElement>(objectRef, callbackRef);

    merged(document.createElement("div"));
    merged(null);

    expect(objectRef.current).toBeNull();
    expect(callbackRef).toHaveBeenLastCalledWith(null);
  });

  it("skips null/undefined refs — the common `forwardRef` case where no ref was passed", () => {
    const objectRef = createRef<HTMLDivElement>();
    const node = document.createElement("div");
    const forwarded: ForwardedRef<HTMLDivElement> = null;

    expect(() => mergeRefs<HTMLDivElement>(forwarded, undefined, objectRef)(node)).not.toThrow();
    expect(objectRef.current).toBe(node);
  });
});
