import { describe, expect, it } from "vitest";
import { resolveMediaShortcut, type MediaShortcutContext } from "./media-shortcuts";

const video: MediaShortcutContext = { isRootTarget: false, kind: "video", duration: 100 };
const button = () => document.createElement("button");

function key(k: string, extra: Partial<KeyboardEvent> = {}, target: EventTarget = button()) {
  return {
    key: k,
    defaultPrevented: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target,
    ...extra,
  } as KeyboardEvent;
}

describe("resolveMediaShortcut", () => {
  it.each([
    ["k", { type: "toggle" }],
    ["K", { type: "toggle" }],
    ["ArrowLeft", { type: "seekBy", seconds: -5 }],
    ["ArrowRight", { type: "seekBy", seconds: 5 }],
    ["j", { type: "seekBy", seconds: -10 }],
    ["l", { type: "seekBy", seconds: 10 }],
    ["ArrowUp", { type: "volumeBy", delta: 0.1 }],
    ["ArrowDown", { type: "volumeBy", delta: -0.1 }],
    ["m", { type: "toggleMute" }],
    ["f", { type: "toggleFullscreen" }],
    ["0", { type: "seekToPercent", percent: 0 }],
    ["5", { type: "seekToPercent", percent: 50 }],
    ["9", { type: "seekToPercent", percent: 90 }],
  ])("maps %s", (k, expected) => {
    expect(resolveMediaShortcut(key(k), video)).toEqual(expected);
  });

  it("toggles on Space only when the root itself is the target", () => {
    expect(resolveMediaShortcut(key(" "), video)).toBeNull();
    expect(resolveMediaShortcut(key(" "), { ...video, isRootTarget: true })).toEqual({
      type: "toggle",
    });
  });

  it("ignores f for audio and digits without a finite duration", () => {
    expect(resolveMediaShortcut(key("f"), { ...video, kind: "audio" })).toBeNull();
    expect(resolveMediaShortcut(key("5"), { ...video, duration: Number.NaN })).toBeNull();
    expect(resolveMediaShortcut(key("5"), { ...video, duration: Infinity })).toBeNull();
  });

  it.each([{ defaultPrevented: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    "returns null for %o",
    (extra) => {
      expect(resolveMediaShortcut(key("k", extra), video)).toBeNull();
    },
  );

  it("returns null when the target owns the keys", () => {
    const slider = document.createElement("span");
    slider.setAttribute("role", "slider");
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    const inMenu = document.createElement("div");
    inMenu.setAttribute("role", "menuitemradio");
    menu.append(inMenu);
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    for (const target of [
      slider,
      inMenu,
      document.createElement("input"),
      document.createElement("textarea"),
      document.createElement("select"),
      editable,
    ]) {
      expect(resolveMediaShortcut(key("ArrowLeft", {}, target), video)).toBeNull();
    }
  });

  it("ignores unmapped keys", () => {
    expect(resolveMediaShortcut(key("x"), video)).toBeNull();
    expect(resolveMediaShortcut(key("Enter"), video)).toBeNull();
  });
});
